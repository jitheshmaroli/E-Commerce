const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const passport = require("passport");
const userController = require("../controllers/userController");
const productController = require("../controllers/productController");
const couponController = require("../controllers/couponController");
const authentication = require("../middlewares/authMiddleware");
const cartController = require("../controllers/cartController");

// passport
require("../passport");
router.use(passport.initialize());
router.use(passport.session());

//bodyparser
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

//google routes
router.get("/auth/google", passport.authenticate("google", { scope: ["email", "profile"] }));
router.get("/auth/google/callback", passport.authenticate("google", { successRedirect: "/", failureRedirect: "/login" }));

// login, logout, signup routes
router.get("/login", authentication.redirectToDashboard, userController.loginViewUser);
router.get("/signup", authentication.redirectToDashboard, userController.signupView);
router.post("/signup", userController.userSignup);
router.post("/login", userController.verifyLogin);
router.get("/logout", userController.logoutViewUser);

//otp
router.get("/verify-otp", authentication.otpAuthentication, userController.verifyOtpView);
router.post("/verify-otp", userController.verifyOtpSignup);
router.post("/resend-otp", userController.resendSignupOtp);

//home
router.get("/", authentication.isUserAuthenticated, userController.shoppingHomeView);

//user profile
router.get("/profile", authentication.isUserAuthenticated, userController.userProfileView);
router.post("/update-profile", userController.profilePhotoUpload, userController.updateProfile);

//user address
router.get("/address", authentication.isUserAuthenticated, userController.addressesView);
router.get("/addresses/add", authentication.isUserAuthenticated, userController.addAddressView);
router.post("/addresses/add", userController.addAddress);
router.post("/set-default-address/:addressId",userController.setDefaultAddress);
router.get("/address/edit/:addressId",authentication.isUserAuthenticated,userController.editAddressView);
router.post("/address/edit", userController.updateAddress);
router.get("/address/delete/:addressId",authentication.isUserAuthenticated,userController.deleteAddress);
router.post("/set-default", userController.setDefault);
router.post("/address/add", userController.addNewAddress);
router.get("/get-address/:addressId",userController.getAddress);

//password
router.get("/change-password",authentication.isUserAuthenticated,userController.changePasswordView);
router.post("/change-password", userController.changePassword);
router.get("/forgot-password", userController.forgotPasswordView);
router.post("/forgot-password", userController.forgotPassword);
router.get("/forgot-password-verify-otp",authentication.otpAuthentication,userController.forgotPasswordVerifyOtpView);
router.post("/forgot-password-verify-otp",userController.resetPasswordVerifyOtp);
router.post("/reset-password", userController.resetPassword);

//wallet
router.get('/wallet',cartController.walletView);

//cart
router.get("/cart", authentication.isUserAuthenticated, cartController.cartView);
router.post("/remove-from-cart", cartController.removeFromCart);
router.post("/move-to-cart/:productId", cartController.moveToCart);

//checkout
router.get("/checkout", authentication.isUserAuthenticated, cartController.checkoutView);
router.get("/checkout/:productId/:quantity", authentication.isUserAuthenticated, cartController.checkoutView);
router.post("/place-order", cartController.placeOrder);
router.post("/add-to-cart", cartController.addToCart);
router.post("/update-quantity", cartController.updateQuantity);
router.get("/check-stock/:productId",authentication.isUserAuthenticated,cartController.checkStock);
router.post("/handle-payment-success",cartController.paymentSuccess);

//wishlist
router.post("/toggle-wishlist", cartController.toggleWishList);
router.post("/cart/move-to-wishlist", cartController.moveToWishList);
router.post("/wishlist/remove/:productId",cartController.removeFromWishList);
router.get("/wishlist", cartController.wishListView);

//orders
router.get("/order-history", authentication.isUserAuthenticated, cartController.orderHistory);
router.get("/order-details/:orderId",cartController.orderDetails)
router.post("/cancel-order/:orderId/:itemId", cartController.cancelOrder);
router.get('/review/:orderId/:productId',productController.reviewView);
router.post('/review/:orderId/:productId',productController.review);

//product search
router.get("/search",authentication.isUserAuthenticated,productController.productSearchView);
router.get("/:category",authentication.isUserAuthenticated,productController.loadCategoryItems);
router.get("/product-details/:productId",authentication.isUserAuthenticated,productController.productDetailsView);

//coupon
router.get("/coupon-discount/:couponCode",couponController.couponDiscount);

module.exports = router;
