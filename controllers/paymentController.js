const Order = require("../models/order");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

    let hmac = crypto.createHmac("sha256", process.env.KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    hmac = hmac.digest("hex");
    if (hmac === razorpay_signature) {
      const updatedOrder = await updateOrderStatus(orderId, "confirmed");

      if (updatedOrder) {
        res.json({ orderId, message: "Payment verified" });
      } else {
        console.error("Error updating order status!");
        res
          .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
          .json({ message: "Payment verified but order update failed" });
      }
    } else {
      console.error("Payment verification failed!");
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Failed to verify payment" });
  }
};

async function updateOrderStatus(orderId, newStatus) {
  try {
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      { paymentStatus: newStatus },
      { new: true }
    );

    return updatedOrder;
  } catch (error) {
    console.error("Error updating order status:", error);
    return null;
  }
}

const retryPayment = async (req, res) => {
  const orderId = req.body.orderId;
  const orderData = await Order.findById(orderId);
  const razorpay = new Razorpay({
    key_id: process.env.KEY_ID,

    key_secret: process.env.KEY_SECRET,
  });

  const options = {
    amount: orderData.totalCost * 100,
    currency: "INR",
    receipt: `order_retry_${orderId}`,
  };

  try {
    const razorpayOrder = await razorpay.orders.create(options);
    res.status(HTTP_STATUS.OK).json({ success: true, orderId, razorpayOrder });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, error: "Failed to initiate retry payment." });
  }
};

const paymentFailed = (req, res) => {
  try {
    const { orderId, reason } = req.query;
    res.render("errors/paymentFailed", { orderId, reason });
  } catch {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, error: "Failed to load." });
  }
};

module.exports = {
  verifyPayment,
  retryPayment,
  paymentFailed,
};
