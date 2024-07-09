const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");
const Category = require("../models/category");
const Review = require("../models/review");


const reviewView = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.params.productId;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({ isBlocked: false });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const product = order.items.find(item => item.productId.toString() === productId);

    if (!product) {
      return res.status(404).send('Product not found in the order');
    }
 
    const productDetails = await Product.findById(productId);

    console.log(productDetails)
    if (!productDetails) {
      return res.status(404).send('Product details not found');
    }

    res.render('orders/review', { orderId, productId, product: productDetails, user, categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving product details');
  }
};


const review = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const userId = user._id;
    const { orderId, productId } = req.params;

    // Create a new review
    const review = new Review({
      userId,
      productId,
      orderId,
      rating,
      comment
    });

    await review.save();
    await Product.findByIdAndUpdate(
      productId,
      { $push: { reviews: review._id } },
      { new: true }
    );

    res.redirect('/order-history');
  } catch (error) {
    console.log(error);
    res.status(500).send('Error submitting review');
  }
};

module.exports = {
    review,
    reviewView
}