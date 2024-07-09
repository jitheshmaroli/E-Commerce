const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");
const Coupon = require("../models/coupon");
const Category = require("../models/category");
const userController = require("../controllers/userController")
const cartController = require("../controllers/cartController");
const Razorpay = require('razorpay');
const crypto = require('crypto');

const generateUniqueOrderId = () => {
  const prefix = 'ORD';
  const timestamp = Date.now(); // Current timestamp in milliseconds
  const randomSuffix = crypto.randomBytes(3).toString('hex'); // Random 3-byte hex string
  return `${prefix}-${timestamp}-${randomSuffix}`;
};


const placeOrder =  async (req, res) => {
    try {
        console.log("placing order")
      const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
      const userId = user._id;
      const { orderItems, totalCost, paymentMode, couponCode, priceDetails, addressDetails} = req.body;
  
      const validatedOrderItems = await validateOrderItems(orderItems);
        if (validatedOrderItems.length === 0) {
          return res.status(400).json({ success: false, error: 'One or more items are out of stock.' });
        }

    
    const uniqueOrderId = generateUniqueOrderId();
      const order = {
        userId,
        uniqueOrderId,
        items: validatedOrderItems,
        totalCost,
        //paymentMethod: 'cod',
        couponCode: couponCode,
         priceDetails: priceDetails, // {
        //   discountAmount: priceDetails.discountAmount,
        //   salesTax: priceDetails.salesTax,
        //   deliveryCharge: priceDetails.deliveryCharge,
        //   subTotal: priceDetails.subTotal
        // },
        paymentStatus: 'pending',
        deliveryAddress:addressDetails
      };
  
      if(paymentMode === "cod"){
        order.paymentMethod = 'cod';
        order.paymentStatus = 'confirmed';
        await Order.create(order);
        await cartController.updateProductStock(validatedOrderItems);
        return res.status(200).json({ cod: true, order });
  
      }else if(paymentMode === "online"){
        var options = {
          amount: totalCost * 100, 
          currency: 'INR',
          receipt: 'order_receipt_xyz' 
        }
        console.log(totalCost, options, order);
        const razorpay = new Razorpay({
            // eslint-disable-next-line no-undef
            key_id: process.env.KEY_ID,
            // eslint-disable-next-line no-undef
            key_secret: process.env.KEY_SECRET
        });
  
        const razorpayOrder = await razorpay.orders.create(options);
        if( razorpayOrder) {
            order.paymentMethod = 'online';
            order.paymentStatus = 'pending';
            await Order.create(order);
            await cartController.updateProductStock(validatedOrderItems);
            const lastOrder = await Order.findOne({ userId: userId }).sort({ createdAt: -1 }).limit(1).select({ _id: 1 });
            const orderId = lastOrder ? lastOrder._id : null;

            return res.json({ online: true, orderId, razorpayOrder});
        }
      }else if( paymentMode === "wallet"){
        order.paymentMethod = 'wallet';
        order.paymentStatus = 'confirmed';
        await Order.create(order);
  
        if(!user.wallet >= totalCost){
          return res.status(400).json({ wallet: false, error: "insufficient balance" });
        }
         //user.wallet -= totalCost;
         const type = 'debit';
         await userController.updateWallet(order.userId, totalCost, order._id, type);
         //await user.save();
  
        await cartController.updateProductStock(validatedOrderItems);
        return res.status(200).json({ cod: true, order });
  
      }
    } catch (error) {
      console.error('Error placing order:', error);
      return res.status(500).json({ success: false, error: 'An error occurred while placing the order.' });
    }
  };
  
  const validateOrderItems = async (orderItems) => {
    const validatedOrderItems = [];
  
    for (const { productId, quantity } of orderItems) {
      const product = await Product.findById(productId);
  
      if (product && product.stock >= quantity) {
        const { name, price, photos } = product;
        const image = photos.length > 0 ? photos[0].filename : '';
  
        validatedOrderItems.push({ productId, name, price, quantity, image });
      }
    }
  
    return validatedOrderItems;
  };

const orderHistory = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({isBlocked:false});
    if (!user) {
      return res.status(404).send('User not found');
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
      .populate('deliveryAddress');

      console.log(orders)
      function formatDate(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
      
      const formattedDate = orders.map(order => ({
        order,
        orderDate: formatDate(order.createdAt)
      }));

    res.render('orders/orderHistory', { orders, user, totalPages, currentPage: page , categoryList,formattedDate});
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving order history');
  }
};



const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;
    //const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });

    console.log("orderid:" + orderId);

    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate('deliveryAddress');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const itemIndex = order.items.findIndex(item => item.productId._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).send('Item not found in the order');
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

    const salesTaxRate = order.priceDetails.salesTax / (order.priceDetails.subTotal + order.priceDetails.discountAmount);
    const itemSalesTax = itemPrice * salesTaxRate;
    const deliveryCharge = order.priceDetails.deliveryCharge;

    order.totalCost -= (itemPrice + itemSalesTax);

    order.priceDetails.subTotal -= item.productId.price * item.quantity;
    order.priceDetails.discountAmount -= discountPrice;
    order.priceDetails.salesTax -= itemSalesTax;

    item.status = 'Cancelled';

    const allItemsCancelled = order.items.every(item => item.status === 'Cancelled');
    if (allItemsCancelled) {
      order.totalCost = 0;
      order.priceDetails.subTotal = 0;
      order.priceDetails.discountAmount = 0;
      order.priceDetails.salesTax = 0;
    }

    if (order.paymentMethod === 'online' || order.paymentMethod === 'wallet') {
      const refundAmount = itemPrice + itemSalesTax + deliveryCharge;
      const type = 'credit';
      await userController.updateWallet(order.userId, refundAmount, order._id, type);
    }
    await order.save();

    res.redirect('/order-history');
  } catch (error) {
    console.log(error);
    res.status(500).send('Error cancelling order item');
  }
};

const orderDetails = async (req,res) => {
  try {
    const orderId = req.params.orderId;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({isBlocked:false});
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate('deliveryAddress');


      console.log(order)
    res.render('orders/orderDetails', { order, user, categoryList});
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving order history');
  }
}

const returnProductPage = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await Order.findById(orderId).populate('items.productId');
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    const item = order.items.find(item => item.productId._id.toString() === itemId);
    
    if (!item) {
      return res.status(404).send('Item not found in order');
    }

    res.render('orders/returnProduct', { order, item, user });
  } catch (error) {
    console.error('Error rendering return product page:', error);
    res.status(500).send('An error occurred while loading the return page');
  }
};

const initiateReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { returnReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const item = order.items.find(item => item.productId.toString() === itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found in order' });
    }

    if (item.returnStatus !== 'None') {
      return res.status(400).json({ error: 'Return already initiated for this item' });
    }

    item.returnStatus = 'Requested';
    item.returnReason = returnReason;

    await order.save();

    res.redirect('/order-history');
  } catch (error) {
    console.error('Error initiating return:', error);
    res.status(500).json({ error: 'An error occurred while initiating the return' });
  }
};

const approveReturn = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const itemId = req.params.itemId;
  
      const order = await Order.findById(orderId)
        .populate("userId", "name email photo isVerified isAdmin isBlocked")
        .populate({ path: "items.productId", model: "products" })
        .populate('deliveryAddress');
  
      if (!order) {
        return res.status(404).send('Order not found');
      }
  
      const itemIndex = order.items.findIndex(item => item.productId._id.toString() === itemId);
  
      if (itemIndex === -1) {
        return res.status(404).send('Item not found in the order');
      }
  
      const item = order.items[itemIndex];
  
      if (item.returnStatus !== 'Requested') {
        return res.status(400).send('Return has not been requested for this item');
      }
  
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
  
      const salesTaxRate = order.priceDetails.salesTax / (order.priceDetails.subTotal + order.priceDetails.discountAmount);
      const itemSalesTax = itemPrice * salesTaxRate;
      const deliveryCharge = order.priceDetails.deliveryCharge;
  
      const refundAmount = itemPrice + itemSalesTax + deliveryCharge;
  
      // Update order totals
      order.totalCost -= (itemPrice + itemSalesTax);
      order.priceDetails.subTotal -= item.productId.price * item.quantity;
      order.priceDetails.discountAmount -= discountPrice;
      order.priceDetails.salesTax -= itemSalesTax;
  
      // Update item status
      item.returnStatus = 'Approved';
  
      // Process refund
      const type = 'credit';
      await userController.updateWallet(order.userId, refundAmount, order._id, type);
  
      await order.save();
  
      res.status(200).json({ message: 'Return approved and refund processed' });
    } catch (error) {
      console.error('Error approving return:', error);
      res.status(500).send('Error processing return approval');
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
    approveReturn
}