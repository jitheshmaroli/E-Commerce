const Cart = require("../models/cart");
const Wishlist = require("../models/wishList");
const User = require("../models/user");

module.exports = async (req, res, next) => {
  try {
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    const userEmail = req.session.userId || req.session.passport?.user?.userId;
    if (userEmail) {
      const user = await User.findOne({ email: userEmail });
      if (user) {
        const userId = user._id;
        const [cart, wishlist] = await Promise.all([
          Cart.findOne({ userId }),
          Wishlist.findOne({ userId }),
        ]);

        res.locals.cartCount = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
      }
    }
    next();
  } catch (error) {
    console.error("Error in cart/wishlist count middleware:", error);
    next();
  }
};
