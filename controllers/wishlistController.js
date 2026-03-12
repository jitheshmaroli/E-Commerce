const Wishlist = require("../models/wishList");
const User = require("../models/user");
const Category = require("../models/category");
const mongoose = require("mongoose");
const Cart = require("../models/cart");
const { HTTP_STATUS } = require("../constants/httpStatusCodes");

const toggleWishList = async (req, res) => {
  const { productId } = req.body;

  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport?.user?.userId,
    });

    if (!user) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ success: false, message: "please log in to continue" });
    }

    const userId = user._id;
    let wishlist = await Wishlist.findOne({ userId: userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId: userId, products: [] });
    }

    const productIndex = wishlist.products.findIndex((item) => item.toString() === productId);

    if (productIndex > -1) {
      wishlist.products.splice(productIndex, 1);
    } else {
      console.log(productId + "wislist");
      wishlist.products.push(productId);
    }

    await wishlist.save();
    const cart = await Cart.findOne({ userId });
    const cartCount = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    const wishlistCount = wishlist.products.length;
    res
      .status(HTTP_STATUS.OK)
      .json({ success: true, isInWishlist: productIndex === -1, cartCount, wishlistCount });
  } catch (error) {
    console.error(error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Error toggling wishlist item" });
  }
};

const moveToWishList = async (req, res) => {
  const productId = req.body.productId;
  const user = await User.findOne({
    email: req.session.userId || req.session.passport.user.userId,
  });
  const userId = user._id;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: "Invalid userId or productId" });
  }

  try {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }
    const isProductInWishlist = wishlist.products.some((product) => product.equals(productId));

    if (isProductInWishlist) {
      return res.status(200).json({ success: true, message: "Product is already in the wishlist" });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Product moved to wishlist successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const wishListView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const wishlist = await Wishlist.findOne({ userId: user._id }).populate("products");
    const categoryList = await Category.find({ isBlocked: false });

    const wishlistProducts = wishlist ? wishlist.products : [];
    res.render("cart/wishlist", {
      wishlist: wishlistProducts,
      categoryList,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const removeFromWishList = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const userId = user._id;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter((product) => !product.equals(productId));

    await wishlist.save();

    res.redirect("/wishlist");
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

module.exports = {
  toggleWishList,
  moveToWishList,
  removeFromWishList,
  wishListView,
};
