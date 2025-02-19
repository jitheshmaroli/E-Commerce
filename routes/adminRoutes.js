const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const productController = require("../controllers/admin/productController");
const categoryController = require("../controllers/admin/categoryController");
const authentication = require("../middlewares/authMiddleware");
const couponController = require("../controllers/admin/couponController");
const offerController = require('../controllers/admin/offerController');
const orderController = require("../controllers/user/orderController");

//admin home
router.get("/", authentication.isAdminAuthenticated, adminController.adminHome);
router.get('/dashboard', authentication.isAdminAuthenticated, adminController.dashboard);

//sales reports
router.get('/sales-report',adminController.salesReport);
router.get('/sales-report/download',adminController.downloadReport);


//products
router.get("/allproducts", authentication.isAdminAuthenticated, productController.allProducts);
router.get("/addProduct", authentication.isAdminAuthenticated, productController.addProductView);
router.post("/addProduct", productController.photoUpload, productController.newProduct);
router.get("/allProducts/edit/:productId", authentication.isAdminAuthenticated, productController.updateProductView);
router.post("/allProducts/edit/:productId", productController.photoUpload, productController.updateProduct);
router.post('/allProducts/removeImage',productController.removeImage);
router.get("/allProducts/delete/:productId", authentication.isAdminAuthenticated, productController.deleteProduct);

//orders
router.get("/orderslist", authentication.isAdminAuthenticated, adminController.ordersListView);
router.get("/orders/:orderId",authentication.isAdminAuthenticated,adminController.orderDetails);
router.post("/updateOrderStatus/:orderId/:productId", adminController.updateOrderStatus);
router.post("/cancelOrder/:orderId/:productId", adminController.cancelOrder);
router.post('/approve-return/:orderId/:itemId', orderController.approveReturn);

//coupons
router.get("/couponlist", authentication.isAdminAuthenticated, couponController.couponListView);
router.delete("/removecoupon/:couponId", couponController.deleteCoupon);
router.get("/addcoupon", authentication.isAdminAuthenticated, couponController.addCouponView);
router.post("/addcoupon", couponController.addCoupon);
router.put("/editCoupon/:couponId", couponController.updateCoupon);

//offers
router.get('/offers',offerController.listOffers);
router.get("/offers/add-offer",offerController.addOfferView);
router.post("/offers/add-offer",offerController.addOffer);
router.get('/offers/edit/:id', offerController.editOfferView);
router.post('/offers/edit/:id', offerController.updateOffer);
router.post('/offers/delete/:id', offerController.deleteOffer);

//category
router.get("/categoryList", authentication.isAdminAuthenticated, categoryController.categoryListView);
router.get("/addcategory", authentication.isAdminAuthenticated, categoryController.addCategoryView);
router.post("/addcategory", categoryController.addCategory);
router.get("/categoryList/edit/:id", categoryController.editCategoryView);
router.put("/categoryList/edit/:id", categoryController.editCategory);
// router.delete("/categoryList/delete/:id", categoryController.deleteCategory);
router.post('/categoryList/toggleStatus/:id',categoryController.toggleCategory);


//user routes
router.get("/usersList", authentication.isAdminAuthenticated, adminController.userListView);
router.post("/usersList/:userEmail", adminController.blockUser);

//logout
router.get("/logout", adminController.logoutViewAdmin);


module.exports = router;
