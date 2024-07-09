const mongoose = require("mongoose");
const Product = require("../models/product");
const User = require("../models/user");
const Wishlist = require("../models/wishList");
const Category = require("../models/category");
const Cart = require("../models/cart");
const Address = require("../models/address");

const offerController = require("../controllers/offerController");

const shoppingHomeView = async (req, res) => {
    try {
      console.log(req.session)
      // const sortBy = req.query.sort || 'default';
      await offerController.applyOffers();
      let wishlistProducts = [];
      let user = null;
      if(req.session.userId || req?.session?.passport?.user?.userId){
        user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
        if (user) {
          const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
          wishlistProducts = wishlist ? wishlist.products : [];
        }
      }
      
      const categoryList = await Category.find({ isBlocked: false });  
  
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const productsPerPage = 8;
      const skip = (page - 1) * productsPerPage;
  
      const productCount = await Product.countDocuments({ isDeleted: false, photos: { $ne: [] } });
      const totalPages = Math.ceil(productCount / productsPerPage);
  
  
      const products = await Product.find({ isDeleted: false, photos: { $ne: [] } })
        .populate('offer')
        .populate('category')
        .populate('reviews')
        .skip(skip)
        .limit(productsPerPage);
        
      const productsWithRating = await Promise.all ( products.map( async (product) => {
            const bestOffer = await offerController.getBestOffer(product);
            if(bestOffer){
            product.currentPrice = offerController.calculateDiscountedPrice(product.price, bestOffer);
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
      
      res.render('userSide/shoppingHome', {
        products: productsWithRating,
        wishlistProducts: wishlistProducts,
        categoryList,
        user,
        currentPage: page,
        totalPages: totalPages,
        productsPerPage: productsPerPage,
        totalProducts: productCount,
        title: 'Shopping Home'
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  };

const checkoutView = async (req, res) => {
  try {
    offerController.applyOffers();
    const productId = req.params.productId;
    const quantity = req.params.quantity;
    const queryString = req.query;
    let checkoutItems = [];

    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const userId = user._id;
    const address = await Address.findOne({ userId });

    if (productId && quantity) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).send('Product not found');
      }

      const bestOffer = await offerController.getBestOffer(product);
      const currentPrice = bestOffer ? offerController.calculateDiscountedPrice(product.price, bestOffer) : product.price;

      checkoutItems.push({
        product: {
          ...product.toObject(),
          bestOffer,
          currentPrice
        },
        quantity: parseInt(quantity)
      });

      let cart = await Cart.findOne({ userId: user._id });
      if (!cart) {
        cart = new Cart({ userId: user._id, items: [] });
      }

      const cartItem = cart.items.find(item => item.productId.equals(productId));
      if (cartItem) {
        if (parseInt(quantity) > product.stock) {
          return res.status(400).json({ error: 'Not enough stock available', availableStock: product.stock });
        }
        cartItem.quantity = parseInt(quantity);
      } else {
        cart.items.push({ productId, quantity: parseInt(quantity) });
      }
      await cart.save();

    } else if (queryString && queryString.cartItems) {
      const cartItems = JSON.parse(queryString.cartItems);
      checkoutItems = await Promise.all(
        cartItems.map(async item => {
          const product = await Product.findById(item.productId);
          if (!product) {
            throw new Error(`Product not found: ${item.productId}`);
          }
          const bestOffer = await offerController.getBestOffer(product);
          const currentPrice = bestOffer ? offerController.calculateDiscountedPrice(product.price, bestOffer) : product.price;
          return {
            product: {
              ...product.toObject(),
              bestOffer,
              currentPrice
            },
            quantity: item.quantity
          };
        })
      );
    } else {
      return res.status(400).send('Invalid request');
    }

    console.log(checkoutItems)
    return res.render('userSide/checkout', { cart: null, checkoutItems, addresses: address, user });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).send('An error occurred during checkout');
  }
};
 
const productSearchView = async (req, res) => {
  try {
    await offerController.applyOffers();
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const categoryList = await Category.find({ isBlocked: false });
    console.log('page:',page,'limit:',limit,'skip:',skip)

    let wishlistProducts = [];
    let user;
    if(req.session.userId){
      user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
      if (user) {
        const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
        wishlistProducts = wishlist ? wishlist.products : [];
      }
    }

    async function convertCategoryNameToId(categoryName) {
          try {
            const category = await Category.findOne({ categoryName: categoryName.toUpperCase() });
            if (category) {
              return category._id;
            }
          } catch (error) {
            console.error('Error converting category name to ID:', error);
          }
      }

    let query = {isDeleted: false, photos: { $ne: [] }};
    if (req.query.query) {
      query.name = { $regex: req.query.query, $options: 'i' };
    }
    if (req.query.brand) {
      query.brand = req.query.brand;
    }
    if (req.query.category) {
      query.category = await convertCategoryNameToId(req.query.category);
    }
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = parseFloat(req.query.maxPrice);
    }

    let sort = {};
    switch (req.query.sortby) {
      case 'price_Asc':
        sort = { price: 1 };
        break;
      case 'price_Desc':
        sort = { price: -1 };
        break;
      case 'name_Asc':
        sort = { name: 1 };
        break;
      case 'name_Desc':
        sort = { name: -1 };
        break;
      case 'rating_Asc':
        sort = { averageRating: 1 };
        break;
      case 'rating_Desc':
        sort = { averageRating: -1 };
        break;
      case 'newArrivals':
        sort = { createdAt: -1 };
        break;
      default:
        sort = { popularity: -1 };
    }

    const collation = {
        locale: 'en',
        strength: 2 
      };

    const products = await Product.find(query)
      .populate('category')
      .sort(sort)
      .collation(collation)
      .skip(skip)
      .limit(limit);
    
    const productsWithRating = await Promise.all ( products.map( async (product) => {
        const bestOffer = await offerController.getBestOffer(product);
        if(bestOffer){
        product.currentPrice = offerController.calculateDiscountedPrice(product.price, bestOffer);
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

    const totalProducts = await Product.countDocuments(query);

    const totalPages = Math.ceil(totalProducts / limit);

    const getCurrentFilters = () => {
        const urlParams = new URLSearchParams(req.query);
        urlParams.delete('page'); // Remove existing page parameter
        return '&' + urlParams.toString();
      };

    res.render('userSide/productSearch', {
      products: productsWithRating,
      wishlistProducts: wishlistProducts,
      user,
      currentPage: page,
      totalPages,
      totalProducts,
      query: req.query,
      sortby: req.query.sortby || 'popularity',
      categoryList,
      getCurrentFilters: getCurrentFilters
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('An error occurred while searching');
  }
};


  
  const productDetailsView = async (req, res) => {
    try {
      const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
      const productId = req.params.productId;
      const matchingCartItem = await Cart.findOne({
        userId: user._id,
        "items.productId": productId 
      });
  
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
      })
      .populate('category');
  
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
      const bestOffer = await offerController.getBestOffer(product);
      
      const currentPrice = bestOffer 
        ? offerController.calculateDiscountedPrice(product.price, bestOffer) 
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
        wishlistProducts,
        matchingCartItem,
        user
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .render("userSide/error", { message: "Internal server error" });
    }
  };

module.exports = {
    shoppingHomeView,
    checkoutView,
    productDetailsView,
    productSearchView
}