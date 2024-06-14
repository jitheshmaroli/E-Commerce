const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const categoryController = require("../controllers/categoryController");
const authentication = require("../middlewares/authMiddleware");
const couponController = require("../controllers/couponController");


router.get("/", authentication.isAdminAuthenticated, adminController.adminHome);

router.get("/allproducts", authentication.isAdminAuthenticated, productController.allProducts);
router.get("/addProduct", authentication.isAdminAuthenticated, productController.addProductView);
router.post("/addProduct", productController.photoUpload, productController.newProduct);
router.get("/allProducts/:ProductId", authentication.isAdminAuthenticated, productController.productDetails);
router.get("/allProducts/edit/:productId", authentication.isAdminAuthenticated, productController.updateProductView);
router.post("/allProducts/edit/:productId", productController.photoUpload, productController.updateProduct);
router.post('/allProducts/removeImage',productController.removeImage);
router.put('/allProducts/updatePhotos/:productId', productController.updatePhotos);
router.get("/allProducts/delete/:productId", authentication.isAdminAuthenticated, productController.deleteProduct);
router.get("/orderslist", authentication.isAdminAuthenticated, adminController.ordersListView);
router.post("/updateOrderStatus/:orderId/:productId", adminController.updateOrderStatus);
router.post("/cancelOrder/:orderId/:productId", adminController.cancelOrder);
router.get("/couponlist", authentication.isAdminAuthenticated, couponController.couponListView);
router.delete("/removecoupon/:couponId", couponController.deleteCoupon);
router.get("/addcoupon", authentication.isAdminAuthenticated, couponController.addCouponView);
router.post("/addcoupon", couponController.addCoupon);
router.post("/editCoupon/:couponId", couponController.updateCoupon);
router.get("/categoryList", authentication.isAdminAuthenticated, categoryController.categoryListView);
router.get("/addcategory", authentication.isAdminAuthenticated, categoryController.addCategoryView);

router.post("/addcategory", categoryController.addCategory);
router.get("/categoryList/edit/:id", categoryController.editCategoryView);
router.post("/categoryList/edit/:id", categoryController.editCategory);
router.post("/categoryList/delete/:id", categoryController.deleteCategory);
router.get("/logout", adminController.logoutViewAdmin);

router.get('/sales-report',adminController.salesReport);
//user routes
router.get("/usersList", authentication.isAdminAuthenticated, adminController.userListView);
router.post("/usersList/:userEmail", adminController.blockUser);

module.exports = router;
