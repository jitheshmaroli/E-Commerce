const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");
const Coupon = require("../models/coupon");
const Category = require("../models/category");
const userController = require("../controllers/userController");
const cartController = require("../controllers/cartController");
const offerController = require("../controllers/offerController");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");

const generateUniqueOrderId = () => {
  const prefix = "ORD";
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  return `${prefix}-${timestamp}-${randomSuffix}`;
};

const placeOrder = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const userId = user._id;
    const { orderItems, totalCost, paymentMode, couponCode, priceDetails, addressDetails } =
      req.body;

    const validatedOrderItems = await validateOrderItems(orderItems);
    if (validatedOrderItems.length === 0) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: "One or more items are out of stock." });
    }

    const uniqueOrderId = generateUniqueOrderId();

    const order = {
      userId,
      uniqueOrderId,
      items: validatedOrderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        status: "Pending",
      })),
      totalCost,
      paymentMethod: paymentMode,
      couponCode,
      priceDetails,
      paymentStatus: paymentMode === "cod" ? "pending" : "pending", // COD starts as pending
      deliveryAddress: addressDetails,
    };

    if (paymentMode === "cod") {
      order.paymentMethod = "cod";
      order.paymentStatus = "confirmed";
      await Order.create(order);
      await cartController.updateProductStock(validatedOrderItems);
      return res.status(HTTP_STATUS.OK).json({ cod: true, order });
    } else if (paymentMode === "online") {
      var options = {
        amount: totalCost * 100,
        currency: "INR",
        receipt: "order_receipt_xyz",
      };
      console.log(totalCost, options, order);
      const razorpay = new Razorpay({
        key_id: process.env.KEY_ID,

        key_secret: process.env.KEY_SECRET,
      });

      const razorpayOrder = await razorpay.orders.create(options);
      if (razorpayOrder) {
        order.paymentMethod = "online";
        order.paymentStatus = "pending";
        await Order.create(order);
        await cartController.updateProductStock(validatedOrderItems);
        const lastOrder = await Order.findOne({ userId: userId })
          .sort({ createdAt: -1 })
          .limit(1)
          .select({ _id: 1 });
        const orderId = lastOrder ? lastOrder._id : null;

        return res.status(HTTP_STATUS.OK).json({ online: true, orderId, razorpayOrder });
      }
    } else if (paymentMode === "wallet") {
      if (user.wallet < totalCost) {
        return res.status(400).json({
          success: false,
          error: "Insufficient wallet balance",
          currentBalance: user.wallet,
          required: totalCost,
        });
      }

      order.paymentMethod = "wallet";
      order.paymentStatus = "pending";

      const createdOrder = await Order.create(order);

      const type = "debit";
      const walletResult = await userController.updateUserWallet(
        user._id,
        totalCost,
        createdOrder._id,
        type
      );

      if (!walletResult || walletResult.success === false) {
        await Order.findByIdAndDelete(createdOrder._id);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: walletResult?.error || "Failed to deduct wallet balance",
        });
      }

      const confirmedOrder = await Order.findByIdAndUpdate(
        createdOrder._id,
        { $set: { paymentStatus: "confirmed" } },
        { new: true }
      );

      if (!confirmedOrder) {
        return res.status(500).json({
          success: false,
          error: "Failed to confirm order status",
        });
      }

      await cartController.updateProductStock(validatedOrderItems);

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        wallet: true,
        order: confirmedOrder,
      });
    }
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "An error occurred while placing the order.",
    });
  }
};

const validateOrderItems = async (orderItems) => {
  const validatedOrderItems = [];

  for (const { productId, quantity } of orderItems) {
    const product = await Product.findById(productId);
    if (product && product.stock >= quantity) {
      // Get best offer and calculate current price
      const bestOffer = await offerController.getBestOffer(product);
      const currentPrice = bestOffer
        ? offerController.calculateDiscountedPrice(product.price, bestOffer)
        : product.price;

      validatedOrderItems.push({
        productId,
        quantity,
        price: currentPrice,
      });
    }
  }
  return validatedOrderItems;
};

const orderHistory = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "User not found" });
    }
    const userId = user._id;

    const perPage = 4;
    const page = parseInt(req.query.page) || 1;

    const totalOrders = await Order.countDocuments({ userId });

    const totalPages = Math.ceil(totalOrders / perPage);

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate({ path: "items.productId", model: "products" })
      .populate("deliveryAddress");

    function formatDate(date) {
      const d = date.getDate().toString().padStart(2, "0");
      const m = (date.getMonth() + 1).toString().padStart(2, "0");
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }

    const formattedDate = orders.map((order) => ({
      order,
      orderDate: formatDate(order.createdAt),
    }));

    res.render("orders/orderHistory", {
      orders,
      user,
      totalPages,
      currentPage: page,
      categoryList,
      formattedDate,
    });
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error retrieving order history");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;

    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate("deliveryAddress");

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Order not found" });
    }

    const itemIndex = order.items.findIndex((item) => item.productId._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Item not found in the order" });
    }

    const item = order.items[itemIndex];
    const product = await Product.findById(item.productId._id);

    if (product) {
      product.stock += item.quantity;
      await product.save();
    }

    const coupon = await Coupon.findOne({ code: order.couponCode });

    let itemPrice = item.productId.price * item.quantity;
    let discountPrice = 0;

    if (coupon) {
      const couponDiscount = coupon.discount / 100;
      discountPrice = itemPrice * couponDiscount;
      itemPrice -= discountPrice;
    }

    const salesTaxRate =
      order.priceDetails.salesTax /
      (order.priceDetails.subTotal + order.priceDetails.discountAmount);
    const itemSalesTax = itemPrice * salesTaxRate;
    const deliveryCharge = order.priceDetails.deliveryCharge;

    order.totalCost -= itemPrice + itemSalesTax;

    order.priceDetails.subTotal -= item.productId.price * item.quantity;
    order.priceDetails.discountAmount -= discountPrice;
    order.priceDetails.salesTax -= itemSalesTax;

    item.status = "Cancelled";

    const allItemsCancelled = order.items.every((item) => item.status === "Cancelled");
    if (allItemsCancelled) {
      order.totalCost = 0;
      order.priceDetails.subTotal = 0;
      order.priceDetails.discountAmount = 0;
      order.priceDetails.salesTax = 0;
    }

    if (order.paymentMethod === "online" || order.paymentMethod === "wallet") {
      const refundAmount = itemPrice + itemSalesTax + deliveryCharge;
      const type = "credit";
      await userController.updateWallet(order.userId, refundAmount, order._id, type);
    }
    await order.save();

    res.redirect("/order-history");
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Error cancelling order item" });
  }
};

const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "User not found" });
    }

    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate("deliveryAddress");

    order.priceDetails.subTotal = order.priceDetails.subTotal.toFixed(2);
    order.priceDetails.salesTax = order.priceDetails.salesTax.toFixed(2);
    order.priceDetails.discountAmount = order.priceDetails.discountAmount.toFixed(2);
    const invoiceData = calculateInvoice(order);

    const canReturnItem = (deliveredAt) => {
      if (!deliveredAt) return false;
      const daysDiff = (Date.now() - new Date(deliveredAt)) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    };

    res.render("orders/orderDetails", { order, user, categoryList, invoiceData, canReturnItem });
  } catch (error) {
    console.log(error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ message: "Error retrieving order history" });
  }
};

const returnProductPage = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId).populate("items.productId");
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Order not found" });
    }

    const item = order.items.find((item) => item.productId._id.toString() === itemId);

    if (!item) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Item not found in order" });
    }

    res.render("orders/returnProduct", { order, item, user });
  } catch (error) {
    console.error("Error rendering return product page:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send("An error occurred while loading the return page");
  }
};

const initiateReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { returnReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Order not found" });
    }

    const item = order.items.find((item) => item.productId.toString() === itemId);
    if (!item) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Item not found in order" });
    }

    if (item.status !== "Delivered") {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Only delivered items can be returned" });
    }

    const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS) || 7;
    const deliveredAt = item.deliveredAt;
    if (!deliveredAt) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Delivery date not recorded" });
    }
    const daysSinceDelivery = (Date.now() - deliveredAt) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
      return res
        .status(400)
        .json({ error: `Return period of ${RETURN_WINDOW_DAYS} days has expired` });
    }

    item.returnStatus = "Requested";
    item.returnReason = returnReason;

    await order.save();

    res.redirect("/order-history");
  } catch (error) {
    console.error("Error initiating return:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: "An error occurred while initiating the return" });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Order not found" });
    }

    const item = order.items.find((i) => i.productId._id.toString() === itemId);
    if (!item) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Item not found" });
    }

    if (item.returnStatus !== "Requested") {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Return not requested for this item" });
    }

    const shouldRefund =
      (order.paymentMethod === "cod" && item.status === "Delivered") ||
      (["online", "wallet"].includes(order.paymentMethod) && order.paymentStatus === "confirmed");

    // Calculate refund amount
    const itemBasePrice = item.price * item.quantity;
    const originalSubTotal = order.priceDetails.subTotal;
    const originalDiscount = order.priceDetails.discountAmount;
    const originalTax = order.priceDetails.salesTax;

    // discount
    let discountPortion = 0;
    if (originalDiscount > 0 && originalSubTotal > 0) {
      discountPortion = (itemBasePrice / originalSubTotal) * originalDiscount;
    }

    const itemPriceAfterDiscount = itemBasePrice - discountPortion;

    let itemTax = 0;
    const taxableBase = originalSubTotal - originalDiscount;
    if (taxableBase > 0) {
      const taxRate = originalTax / taxableBase;
      itemTax = itemPriceAfterDiscount * taxRate;
    }

    const refundAmount = itemPriceAfterDiscount + itemTax;

    // Update stock
    const product = await Product.findById(item.productId._id);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }

    // Update order totals
    order.totalCost -= refundAmount;
    order.priceDetails.subTotal -= itemBasePrice;
    order.priceDetails.discountAmount -= discountPortion;
    order.priceDetails.salesTax -= itemTax;

    item.refundedAmount = refundAmount;
    item.returnStatus = "Refunded";
    item.status = "Returned";

    if (shouldRefund) {
      await userController.updateUserWallet(
        order.userId,
        refundAmount,
        order._id,
        "credit",
        item.productId._id
      );
    }

    await order.save();

    return res.status(HTTP_STATUS.OK).json({ message: "Return approved and refund processed" });
  } catch (error) {
    console.error("Error approving return:", error);
    return res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: "Error processing return approval" });
  }
};

const cancelSingleItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const user = await User.findOne({
      email: req.session.userId || req.session.passport?.user?.userId,
    });

    if (!user)
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, error: "Unauthorized" });

    const order = await Order.findById(orderId).populate("items.productId");

    if (!order)
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: "Order not found" });

    const itemIndex = order.items.findIndex((i) => i.productId._id.toString() === itemId);

    if (itemIndex === -1)
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: "Item not found" });

    const item = order.items[itemIndex];

    if (item.status !== "Pending") {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, error: "Only pending items can be cancelled" });
    }

    const product = await Product.findById(item.productId._id);
    if (product) {
      product.stock += Number(item.quantity);
      await product.save();
    }

    const productPrice = Number(item.productId.price || 0);
    const quantity = Number(item.quantity || 0);

    const itemBasePrice = productPrice * quantity;

    let discountPortion = 0;
    const originalSubTotal = Number(order.priceDetails?.subTotal || 0);

    if (
      order.couponCode &&
      Number(order.priceDetails?.discountAmount) > 0 &&
      originalSubTotal > 0
    ) {
      const itemContribution = itemBasePrice / originalSubTotal;
      discountPortion = Number(order.priceDetails.discountAmount) * itemContribution;
    }

    const itemPriceAfterDiscount = itemBasePrice - discountPortion;

    let itemTax = 0;
    const originalTotalBeforeTax =
      originalSubTotal - Number(order.priceDetails?.discountAmount || 0);

    if (originalTotalBeforeTax > 0) {
      const taxRate = Number(order.priceDetails?.salesTax || 0) / originalTotalBeforeTax;
      itemTax = itemPriceAfterDiscount * taxRate;
    }

    let refundAmount = itemPriceAfterDiscount + itemTax;

    refundAmount = Math.max(0, Number(refundAmount.toFixed(2)));

    if (isNaN(refundAmount) || refundAmount <= 0) {
      console.error(" Refund calculation error:", {
        itemBasePrice,
        discountPortion,
        itemTax,
        refundAmount,
      });
      return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({ success: false, error: "Refund calculation failed" });
    }

    order.totalCost = Math.max(0, Number(order.totalCost || 0) - refundAmount);
    order.priceDetails.subTotal = Math.max(0, originalSubTotal - itemBasePrice);
    order.priceDetails.discountAmount = Math.max(
      0,
      Number(order.priceDetails.discountAmount || 0) - discountPortion
    );
    order.priceDetails.salesTax = Math.max(0, Number(order.priceDetails.salesTax || 0) - itemTax);

    item.refundedAmount = refundAmount;
    item.status = "Cancelled";
    item.cancelledAt = item.cancelledAt || new Date();

    //refund
    const shouldRefund =
      (order.paymentMethod === "cod" && item.status === "Delivered") ||
      (["online", "wallet"].includes(order.paymentMethod) && order.paymentStatus === "confirmed");

    if (shouldRefund) {
      const walletResult = await userController.updateUserWallet(
        user._id,
        refundAmount,
        order._id,
        "credit",
        item.productId._id
      );

      if (!walletResult?.success) {
        console.error("Wallet refund failed:", walletResult?.error);
      }
    }

    await order.save();

    if (order.items.every((i) => i.status === "Cancelled")) {
      order.totalCost = 0;
      order.priceDetails.subTotal = 0;
      order.priceDetails.discountAmount = 0;
      order.priceDetails.salesTax = 0;
      await order.save();
    }

    req.session.success_msg = `Item cancelled successfully. ₹${refundAmount.toFixed(
      2
    )} refunded to wallet.`;

    res.redirect("/order-history");
  } catch (err) {
    console.error("Cancel item error:", err);
    req.session.error_msg = "Failed to cancel item. Please try again.";
    res.redirect("/order-history");
  }
};

function calculateInvoice(order) {
  const deliveredItems = order.items.filter((item) => item.status === "Delivered");
  if (deliveredItems.length === 0) return null;

  // Subtotal of delivered items using stored price
  const deliveredSubtotal = deliveredItems.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // Original subtotal (from order.priceDetails)
  const originalSubtotal = order.priceDetails.subTotal;

  if (originalSubtotal === 0) return null;

  const proportion = deliveredSubtotal / originalSubtotal;

  // discount and tax proportionally, delivery charge remains full
  const discountAmount = order.priceDetails.discountAmount * proportion;
  const taxAmount = order.priceDetails.salesTax * proportion;
  const deliveryCharge = order.priceDetails.deliveryCharge;

  const total = deliveredSubtotal - discountAmount + taxAmount + deliveryCharge;

  return {
    deliveredItems,
    deliveredSubtotal,
    discountAmount,
    taxAmount,
    deliveryCharge,
    total,
  };
}

const rejectReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Order not found" });

    const item = order.items.find((i) => i.productId.toString() === itemId);
    if (!item) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Item not found" });
    if (item.returnStatus !== "Requested") {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Return not requested" });
    }

    item.returnStatus = "Rejected";
    await order.save();
    res.status(HTTP_STATUS.OK).json({ message: "Return rejected" });
  } catch (error) {
    console.error("Reject return error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Server error" });
  }
};

module.exports = {
  placeOrder,
  orderDetails,
  cancelOrder,
  orderHistory,
  validateOrderItems,
  returnProductPage,
  initiateReturn,
  approveReturn,
  cancelSingleItem,
  rejectReturn,
};
