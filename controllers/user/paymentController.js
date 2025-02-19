const Order = require("../../models/order");
const crypto = require('crypto');
const Razorpay = require("razorpay");

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

     // eslint-disable-next-line no-undef
     let hmac = crypto.createHmac('sha256',process.env.KEY_SECRET)
     hmac.update(razorpay_order_id+'|'+razorpay_payment_id)
     hmac=hmac.digest('hex')
     if(hmac === razorpay_signature){
      console.log('Payment verified successfully!');

      console.log(orderId)
      const updatedOrder = await updateOrderStatus(orderId, 'confirmed'); 

      if (updatedOrder) {
        console.log("success")
        res.json({ orderId, message: 'Payment verified' });
      } else {
        console.error('Error updating order status!');
        res.status(500).json({ message: 'Payment verified but order update failed' });
      }
    } else {
      console.error('Payment verification failed!');
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
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
    console.error('Error updating order status:', error);
    return null;
  }
}

const retryPayment = async (req, res) => {
  const orderId = req.body.orderId; // Get order ID from request
  const orderData = await Order.findById(orderId); // Fetch order details
  console.log(orderId,"totalcost")
  const razorpay = new Razorpay({
    // eslint-disable-next-line no-undef
    key_id: process.env.KEY_ID,
    // eslint-disable-next-line no-undef
    key_secret: process.env.KEY_SECRET
  });

  const options = {
    amount: orderData.totalCost * 100,
    currency: 'INR',
    receipt: `order_retry_${orderId}`,
  };

  try {
    const razorpayOrder = await razorpay.orders.create(options);
    console.log(razorpayOrder)
    res.json({ success: true, orderId, razorpayOrder });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate retry payment.' });
  }
};

module.exports = {
    verifyPayment,
    retryPayment
}
