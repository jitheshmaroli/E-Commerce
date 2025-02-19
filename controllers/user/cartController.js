const Cart = require("../../models/cart");
const User = require("../../models/user");
const Product = require("../../models/product");
const Wishlist = require("../../models/wishList");
const Category = require("../../models/category");
const { applyOffers, getBestOffer, calculateDiscountedPrice } = require('../admin/offerController');
 
const addToCart = async (req, res) => {
  try {
    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;
    const discountCode = req.body.discountCode;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    if(!user){
      return res.json({success: false, message: 'please log in to continue'})
    }

    if (!productId || !quantity || typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'Invalid product details' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await Cart.findOne({ userId: user._id });
    if (!cart) {
      cart = new Cart({ userId: user._id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (existingItemIndex !== -1) {
      const updatedQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (updatedQuantity > product.stock) {
        return res.status(400).json({ error: 'Not enough stock available', availableStock: product.stock });
      }
      cart.items[existingItemIndex].quantity = updatedQuantity;
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({ error: 'Not enough stock available', availableStock: product.stock });
      }
      cart.items.push({ productId, quantity });
    }

    let discountPercentage = 0;
    if (discountCode) {
      const response = await fetch(`/couponDiscount/${discountCode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch coupon discount');
      }
      const data = await response.json();
      discountPercentage = data.discountPercentage;
    }

    await cart.save();
    await Wishlist.findOneAndUpdate(
      { userId: user._id },
      { $pull: { items: { productId } } }
    );

    res.json({ success: true, message: 'Product added to cart successfully', discountPercentage });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const moveToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
  const userId = user._id; 

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));

    if (itemIndex !== -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();

   res.redirect("/wishlist");
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ success: false, error: 'An error occurred while adding the product to the cart.' });
  }
};


const cartView = async (req, res) => {
  try {
    applyOffers();
    const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked: false});
    const userId = user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.render('users/cart/cart', {items: "", message: "NO ITEMS IN CART", user, categoryList});
    }

    const items = await Promise.all(cart.items.map(async (item) => {
      const product = item.productId;
      const bestOffer = await getBestOffer(product);
      const currentPrice = bestOffer ? calculateDiscountedPrice(product.price, bestOffer) : product.price;

      return {
        productId: product._id,
        name: product.name,
        price: product.price,
        currentPrice: currentPrice,
        stock: product.stock,
        image: product.photos && product.photos.length > 0 ? product.photos[0].filename : '/images/no-image.jpg',
        quantity: item.quantity,
        totalPrice: item.quantity * currentPrice,
        selected: item.selected,
        offer: bestOffer ? {
          name: bestOffer.name,
          discountType: bestOffer.discountType,
          discountValue: bestOffer.discountValue
        } : null
      };
    }));

    res.render('users/cart/cart', { items, user, message: "", categoryList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProductStock = async (orderedItems) => {
  for (const { productId, quantity } of orderedItems) {
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -quantity } });
  }
};

const updateQuantity = async (req, res) => {
    const { productId, quantity } = req.body;
    console.log("quantity:"+quantity)
    console.log("updating1")
    const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId}) 
  
    console.log("updating2")
    const userId = user._id;
    console.log(productId+"proid"+quantity+"qty")
    try {
      console.log("updating3")
       await Cart.findOneAndUpdate(
        { userId, 'items.productId': productId },
        { $set: { 'items.$.quantity': quantity } },
        { new: true }
      );
      res.json({success:true,quantity, message: 'Quantity updated successfully' });
    } catch (error) {
      res.status(500).send({ message: 'Error updating quantity', error });
    }
  };
    

  const checkStock =  async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.query;

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const availableStock = product.stock;

        if (quantity > availableStock) {
            return res.json({ availableStock });
        } else {
            return res.json({ availableStock: quantity });
        }
    } catch (error) {
        console.error('Error checking stock availability:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const removeFromCart =  async (req, res) => {
  try {
    const productId = req.body.productId;
    const user = await User.findOne({ email: req.session.userId ||  req.session.passport.user.userId });

     await Cart.findOneAndUpdate(
      { userId: user._id },
      { $pull: { items: { productId } } },
      { new: true }
    );

    res.json({success:true});
  } catch (error) {
    console.error('Error removing product from cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
 
const invoice = async ( req, res) => {
  try {
    res.render('users/orders/invoice');
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
}

module.exports = {
    addToCart,
    cartView,
    updateQuantity,
    checkStock,
    removeFromCart,
    moveToCart,
    invoice,
    updateProductStock
}
