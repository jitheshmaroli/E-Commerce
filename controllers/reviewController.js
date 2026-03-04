const Order = require("../models/order");
const Product = require("../models/product");
const User = require("../models/user");
const Category = require("../models/category");
const Review = require("../models/review");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");

const reviewView = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.params.productId;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "User not found" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Order not found" });
    }

    const product = order.items.find((item) => item.productId.toString() === productId);

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Product not found in the order" });
    }

    const productDetails = await Product.findById(productId);

    if (!productDetails) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Product details not found" });
    }

    res.render("orders/review", {
      orderId,
      productId,
      product: productDetails,
      user,
      categoryList,
    });
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error retrieving product details");
  }
};

const review = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const userId = user._id;
    const { orderId, productId } = req.params;

    const existingReview = await Review.findOne({
      userId,
      productId,
      orderId,
    });

    if (existingReview) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "You have already reviewed this product" });
    }

    const review = new Review({
      userId,
      productId,
      orderId,
      rating,
      comment,
    });

    await review.save();
    await Product.findByIdAndUpdate(productId, { $push: { reviews: review._id } }, { new: true });

    await Order.findOneAndUpdate(
      {
        _id: orderId,
        "items.productId": productId,
      },
      {
        $set: {
          "items.$.reviewed": true,
          "items.$.reviewedAt": new Date(),
        },
      }
    );

    res.redirect("/order-history");
  } catch (error) {
    console.log(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Error submitting review");
  }
};

module.exports = {
  review,
  reviewView,
};
