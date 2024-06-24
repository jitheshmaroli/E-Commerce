const Product = require("../models/product");
const User = require("../models/user");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const Category = require("../models/category");
const Wishlist = require("../models/wishList");
const Review = require("../models/review");
const Order = require("../models/order");
const fs = require("fs").promises;
const { getBestOffer, calculateDiscountedPrice } = require('../controllers/offerController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // eslint-disable-next-line no-undef
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const photoUpload = upload.array("photos", 4);


const addProductView = async (req, res) => {
  try {
    const categoryList = await Category.find({ isBlocked: false });
    res.render("admin/addProduct", { categoryList, message: "" });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const productDetails = async (req, res) => {
  try {
    res.render("admin/productDetails");
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};


const newProduct = async (req, res) => {
  try {
    const { name, description, category, brandName, stock, price, tags } = req.body;

    if (!name || !category || !brandName || !stock || !price) {
      const categoryList = await Category.find();
      return res.render("admin/addProduct", {
        categoryList,
        message: "Incomplete data",
      });
    }

    const existingProduct = await Product.findOne({
      name: name,
      brandName: brandName,
    });

    if (!existingProduct) {
      let uploadedPhotos = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {       
            uploadedPhotos.push({
              filename: file.filename,
              originalname: file.originalname,
              mimetype: 'image/jpeg',
            });
        }
      }

      const getCategoryObjectId = async (categoryName) => {
        const category = await Category.findOne({ categoryName: categoryName });
        return category ? category._id : null;
      };

      const categoryId = await getCategoryObjectId(category);

      const newProduct = new Product({
        name,
        description,
        category: categoryId,
        brandName,
        stock,
        price,
        tags,
        photos: uploadedPhotos,
      });

      await newProduct.save();

      res.redirect("/admin/allproducts");
      console.log("New product added");
    } else {
      res.redirect("/admin/allproducts");
      console.log("Product already exists");
    }
  } catch (error) {
    console.error("An error occurred while adding the product:", error.message);
    res.status(500).send("An error occurred while adding the product.");
  }
};

//update product view

const updateProductView = async (req, res) => {
  try {
    const productData = [
      await Product.findById(req.params.productId).populate("category"),
    ];
    const categoryList = await Category.find({ isBlocked: false });
    if (!productData) {
      return res.status(404).json({ message: "Product not found" });
    } else {
      res.render("admin/updateProduct", { productData, categoryList });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};
//update product data

const updateProduct = async (req, res) => {
  const productId = req.params.productId;
  const { existingPhotos } = req.body || [];
  const newPhotos = req.files || [];

  console.log("existing photos type:" + typeof(existingPhotos))

  try {
    console.log("trying");
    async function getCategoryObjectId(categoryName) {
      console.log("function called");
      const category = await Category.findOne({ categoryName: categoryName });
      console.log(`${category}:category`);
      console.log(`${categoryName}:category name`);
      return category ? category._id : null;
    }
    const categoryId = await getCategoryObjectId(req.body.category);
    console.log(categoryId);

    const product = await Product.findById(productId);
    product.name = req.body.name;
    product.description = req.body.description;
    product.category = categoryId;
    product.brandName = req.body.brandName;
    product.stock = req.body.stock;
    product.price = req.body.price;
    product.tags = req.body.tags;

   

    if (Array.isArray(newPhotos) && newPhotos.length > 0) {
      console.log("Adding new photos");
      newPhotos.forEach((photo) => {
        product.photos.push({
          filename: photo.filename,
          originalname: photo.originalname,
          mimetype: photo.mimetype,
        });
      });
    }

    console.log("updated product" + product);
    await product
      .save()
      .then(() => {
        console.log("Product updated successfully");
        res.redirect("/admin/allProducts");
      })
      .catch((error) => {
        console.error("Error updating product:", error);
        res.status(500).send("An error occurred while updating the product.");
      });
  } catch (error) {
    res.status(500).send(error);
  }
};

const removeImage =  async (req, res) => {
  try {
    console.log("image removing")
    const { filename } = req.body;

    const imagePath = path.join('public/uploads', filename);
    console.log(imagePath)
    fs.unlink(imagePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error removing file:', unlinkErr);
        return res.status(500).json({ error: 'Failed to remove image' });
      }


    res.status(200).json({success:true , message: 'Image removed successfully' });
    });
  } catch (error) {
    console.error('Error removing image:', error);
    res.status(500).json({ error: 'Failed to remove image' });
  }
};


const updatePhotos = async (req, res) => {
  try {
    const { productId } = req.params;
    const { photos } = req.body;

    const product = await Product.findByIdAndUpdate(productId, { photos }, { new: true });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Error updating product photos:', error);
    res.status(500).json({ error: 'Failed to update product photos' });
  }
};

const allProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false });
    res.render("admin/allProducts", { products });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};


const productSearchView = async (req, res) => {
  const searchQuery = req.query.query || "";
  const selectedCategory = req.query.category || "all";
  console.log(searchQuery);

  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    let wishlistProducts = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user._id }).populate("products");
      wishlistProducts = wishlist ? wishlist.products : [];
    }

    const page = req.query.page ? parseInt(req.query.page) : 1;
    const productsPerPage = 8;
    const skip = (page - 1) * productsPerPage;

    let productCount;
    let products;
    if (selectedCategory === "all") {
      productCount = await Product.countDocuments({
        name: { $regex: searchQuery, $options: "i" },
        isDeleted: false,
        photos: { $ne: [] }
      });

      products = await Product.find({
        name: { $regex: searchQuery, $options: "i" },
        isDeleted: false,
        photos: { $ne: [] }
      })
      .populate("reviews")
      .skip(skip)
      .limit(productsPerPage);
    } else {
      const category = await Category.findOne({ categoryName: selectedCategory, isBlocked: false });
      if (!category) {
        console.error("Category not found");
        return res.status(404).send("Category not found");
      }

      productCount = await Product.countDocuments({
        name: { $regex: searchQuery, $options: "i" },
        category: category._id,
        isDeleted: false,
        photos: { $ne: [] }
      });

      products = await Product.find({
        name: { $regex: searchQuery, $options: "i" },
        category: category._id,
        isDeleted: false,
        photos: { $ne: [] }
      })
      .populate("reviews")
      .skip(skip)
      .limit(productsPerPage);
    }

    const totalPages = Math.ceil(productCount / productsPerPage);

    const productsWithRating = products.map(product => {
      const reviews = product.reviews;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
      return {
        ...product.toObject(),
        averageRating: averageRating.toFixed(1)
      };
    });

    res.render("userSide/shoppingHome", {
      products: productsWithRating,
      productsToSort: productsWithRating,
      wishlistProducts: wishlistProducts,
      user,
      categoryList,
      currentPage: page,
      totalPages: totalPages,
      productsPerPage: productsPerPage,
      totalProducts: productCount,
      searchQuery: searchQuery,
      selectedCategory: selectedCategory
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// const productDetailsView = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
//     const productId = req.params.productId;
//     let wishlistProducts = [];
//     if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
//       return res.status(400).send("Invalid product ID");
//     }

//     if (user) {
//       const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
//       console.log(wishlist);
//       wishlistProducts = wishlist ? wishlist.products : [];
//     }

   
//     const product = await Product.findById(productId).populate({path: 'reviews',
//       populate: {
//         path: 'userId',
//         select: 'name'
//       }
//     });
//     const categoryList = await Category.find({ isBlocked: false });

//     if (!product) {
//       return res
//         .status(404)
//         .render("userSide/productNotFound", { message: "Product not found" });
//     }
//      const reviews = product.reviews;
//      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
//      const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
 
//      const productWithRating = {
//        ...product.toObject(),
//        averageRating: averageRating.toFixed(1)
//      };
//     res.render("userSide/prodcutDetails", {
//       product:productWithRating,
//       categoryList,
//       wishlistProducts
//     });
//   } catch (err) {
//     console.error(err);
//     res
//       .status(500)
//       .render("userSide/error", { message: "Internal server error" });
//   }
// };

const productDetailsView = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const productId = req.params.productId;
    let wishlistProducts = [];

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).send("Invalid product ID");
    }

    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
      console.log(wishlist);
      wishlistProducts = wishlist ? wishlist.products : [];
    }

    const product = await Product.findById(productId).populate({
      path: 'reviews',
      populate: {
        path: 'userId',
        select: 'name'
      }
    });

    const categoryList = await Category.find({ isBlocked: false });

    if (!product) {
      return res
        .status(404)
        .render("userSide/productNotFound", { message: "Product not found" });
    }

    const reviews = product.reviews;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Get the best offer for the product
    const bestOffer = await getBestOffer(product);
    
    const currentPrice = bestOffer 
      ? calculateDiscountedPrice(product.price, bestOffer) 
      : product.price;

    const productWithRatingAndOffer = {
      ...product.toObject(),
      averageRating: averageRating.toFixed(1),
      bestOffer: bestOffer,
      currentPrice: currentPrice
    };

    res.render("userSide/prodcutDetails", {
      product: productWithRatingAndOffer,
      categoryList,
      wishlistProducts
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .render("userSide/error", { message: "Internal server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.productId;
    const productData = await Product.findOne({ _id: productId });
    if (productData) {
      productData.isDeleted = true;
      await productData.save();
    }
    res.redirect("/admin/allProducts");
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .render("userSide/error", { message: "Internal server error" });
  }
};



const loadCategoryItems = async (req, res) => {
  const categoryName = req.params.category;
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    let wishlistProducts = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user._id }).populate(
        "products"
      );
      wishlistProducts = wishlist ? wishlist.products : [];
    }

    const page = req.query.page ? parseInt(req.query.page) : 1;
    const productsPerPage = 8;
    const skip = (page - 1) * productsPerPage;

    let products;
    let categoryId;
    let productsWithRating;
    let totalPages;
    let productCount;

    if (categoryName === "all") {
      productCount = await Product.countDocuments({ isDeleted: false, photos: { $ne: [] } });
      totalPages = Math.ceil(productCount / productsPerPage);
      products = await Product.find({ isDeleted: false, photos: { $ne: [] } })
        .populate("reviews")
        .skip(skip)
        .limit(productsPerPage);
         productsWithRating = await Promise.all( products.map( async (product) => {
          const bestOffer = await getBestOffer(product);
          if(bestOffer){
            product.currentPrice = calculateDiscountedPrice(product.price, bestOffer);
            product.offer = bestOffer;
          }else{
            product.currentPrice = product.price;
          }
          const reviews = product.reviews;
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
          return {
            ...product.toObject(),
            averageRating: averageRating.toFixed(1)
          };
        }));
    } else {
      const category = categoryList.find(
        (cat) => cat.categoryName === categoryName
      );
      if (category) {
        categoryId = category.id;
      } else {
        console.error("Category not found");
      }
      productCount = await Product.countDocuments({
        category: categoryId,
        isDeleted: false,
        photos: { $ne: [] }
      });
      totalPages = Math.ceil(productCount / productsPerPage);

      products = await Product.find({
        category: categoryId,
        isDeleted: false,
        photos: { $ne: [] },
      })
      .populate("reviews")
      .skip(skip)
      .limit(productsPerPage);

      productsWithRating = await Promise.all( products.map( async (product) => {
        const bestOffer = await getBestOffer(product);
        if(bestOffer){
          product.currentPrice = calculateDiscountedPrice(product.price, bestOffer);
          product.offer = bestOffer;
        }else{
          product.currentPrice = product.price;
        }
        const reviews = product.reviews;
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
        return {
          ...product.toObject(),
          averageRating: averageRating.toFixed(1)
        };
      }));
    }

    res.render("userSide/shoppingHome", {
      products: productsWithRating,
      productsToSort: productsWithRating,
      wishlistProducts: wishlistProducts,
      user,
      categoryList,
      currentPage: page,
      totalPages: totalPages,
      productsPerPage: productsPerPage,
      totalProducts: productCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};


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
  productDetails,
  newProduct,
  addProductView,
  photoUpload,
  allProducts,
  updateProduct,
  updateProductView,
  productSearchView,
  productDetailsView,
  deleteProduct,
  loadCategoryItems,
  reviewView,
  review,
  removeImage,
  updatePhotos
};
