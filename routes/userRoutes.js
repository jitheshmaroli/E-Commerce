const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const passport = require("passport");
const userController = require("../controllers/userController");
const couponController = require("../controllers/couponController");
const authentication = require("../middlewares/authMiddleware");
const cartController = require("../controllers/cartController");
const addressController = require("../controllers/addressController");
const authController = require("../controllers/authController");
const passwordController = require("../controllers/passwordController");
const otpController = require("../controllers/otpController");
const shopController = require("../controllers/shopController");
const wishlistController = require("../controllers/wishlistController");
const orderController = require("../controllers/orderController");
const paymentController = require("../controllers/paymentController");
const reviewController = require("../controllers/reviewController");

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
router.get("/login", authentication.redirectToDashboard, authController.loginViewUser);
router.get("/signup", authentication.redirectToDashboard,authController.signupView);
router.post("/signup", authController.userSignup);
router.post("/login", authController.verifyLogin);
router.get("/logout", authController.logoutViewUser);

//otp
router.get("/verify-otp", authentication.otpAuthentication, otpController.verifyOtpView);
router.post("/verify-otp", otpController.verifyOtpSignup);
router.post("/resend-otp", otpController.resendSignupOtp);

//home
router.get("/", shopController.shoppingHomeView);

//user profile
router.get("/profile", authentication.isUserAuthenticated, userController.userProfileView);
router.post("/update-profile", userController.profilePhotoUpload, userController.updateProfile);

//user address
router.get("/address", authentication.isUserAuthenticated, addressController.addressesView);
router.get("/addresses/add", authentication.isUserAuthenticated, addressController.addAddressView);
router.post("/addresses/add", addressController.addAddress);
router.post("/set-default-address/:addressId", addressController.setDefaultAddress);
router.get("/address/edit/:addressId",authentication.isUserAuthenticated, addressController.editAddressView);
router.post("/address/edit", addressController.updateAddress);
router.get("/address/delete/:addressId",authentication.isUserAuthenticated, addressController.deleteAddress);
router.post("/set-default", addressController.setDefault);
router.post("/address/add", addressController.addNewAddress);
router.get("/get-address/:addressId", addressController.getAddress);

//password
router.get("/change-password",authentication.isUserAuthenticated, passwordController.changePasswordView);
router.post("/change-password", passwordController.changePassword);
router.get("/forgot-password", passwordController.forgotPasswordView);
router.post("/forgot-password", passwordController.forgotPassword);
router.get("/forgot-password-verify-otp",authentication.otpAuthentication, otpController.forgotPasswordVerifyOtpView);
router.post("/forgot-password-verify-otp",otpController.resetPasswordVerifyOtp);
router.post("/reset-password", passwordController.resetPassword);

//wallet
router.get('/wallet', authentication.isUserAuthenticated,userController.walletView);

//cart
router.get("/cart", authentication.isUserAuthenticated, cartController.cartView);
router.post("/remove-from-cart", cartController.removeFromCart);
router.post("/move-to-cart/:productId", cartController.moveToCart);

//checkout
router.get("/checkout", authentication.isUserAuthenticated, shopController.checkoutView);
router.get("/checkout/:productId/:quantity", authentication.isUserAuthenticated, shopController.checkoutView);
router.post("/place-order", orderController.placeOrder);
router.post("/add-to-cart", cartController.addToCart);
router.post("/update-quantity", cartController.updateQuantity);
router.get("/check-stock/:productId",authentication.isUserAuthenticated,cartController.checkStock);
router.post("/checkout/verify", paymentController.verifyPayment);


//wishlist
router.post("/toggle-wishlist", wishlistController.toggleWishList);
router.post("/cart/move-to-wishlist", wishlistController.moveToWishList);
router.post("/wishlist/remove/:productId",wishlistController.removeFromWishList);
router.get("/wishlist", authentication.isUserAuthenticated, wishlistController.wishListView);

//orders
router.get("/order-history", authentication.isUserAuthenticated, orderController.orderHistory);
router.get("/order-details/:orderId", authentication.isUserAuthenticated,orderController.orderDetails)
router.post("/cancel-order/:orderId/:itemId", orderController.cancelOrder);
router.get('/review/:orderId/:productId', authentication.isUserAuthenticated,reviewController.reviewView);
router.post('/review/:orderId/:productId',reviewController.review);
router.get('/invoice', authentication.isUserAuthenticated,cartController.invoice);
router.post('/retry-payment', paymentController.retryPayment);
router.get('/return-product/:orderId/:itemId', orderController.returnProductPage);
router.post('/return-product/:orderId/:itemId', orderController.initiateReturn);

//product search
router.get("/search",shopController.productSearchView);
router.get("/product-details/:productId", shopController.productDetailsView);

//coupon
router.get("/coupon-discount/:couponCode", authentication.isUserAuthenticated,couponController.couponDiscount);

module.exports = router;
