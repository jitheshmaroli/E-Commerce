const Cart = require("../models/cart");
const User = require("../models/user");
const Product = require("../models/product");
const Wishlist = require("../models/wishList");
const mongoose = require("mongoose");
const Order = require("../models/order");
const Address = require("../models/address");
const Category = require("../models/category");
const Razorpay = require('razorpay');
const Coupon = require('../models/coupon');

const razorpay = new Razorpay({
  // eslint-disable-next-line no-undef
  key_id: process.env.KEY_ID,
  // eslint-disable-next-line no-undef
  key_secret: process.env.KEY_SECRET
});


 
const addToCart = async (req, res) => {
  try {
    const productId = req.body.productId;
    const quantity = req.body.quantity || 1;
    const discountCode = req.body.discountCode;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });

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

    res.json({ message: 'Product added to cart successfully', discountPercentage });
  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const cartView = async (req,res) => {
  try {
    const user = await User.findOne({email : req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    const userId = user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0 ) {
      return res.render('cart/cart', {items:"", message:"NO ITEMS IN CART", categoryList });
    }



    const items = cart.items.map((item) => {
      const product = item.productId;
      return {
        productId: product._id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image: product.photos && product.photos.length > 0 ? product.photos[0].filename : '/images/no-image.jpg', 
        quantity: item.quantity,
        totalPrice:item.quantity * product.price,
        selected:item.selected,
      };
    });

    res.render('cart/cart', { items,message:"",categoryList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


const checkoutView = async (req, res) => {
  const productId = req.params.productId; 
  const quantity = req.params.quantity;
  console.log("the quantity is: " + productId)
  const queryString = req.query;
  let checkoutItems=[];

  const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
  const userId = user._id;
  const address = await Address.findOne({ userId });

  if(productId && quantity){
    const product = await Product.findById(productId);
    console.log("the product is :" + product)
    let cart = await Cart.findOne({ userId: user._id });

    if(productId){
      checkoutItems.push({product})
      if (!checkoutItems) {
        return res.status(404).send('items not found');
      }
      
      if (!cart) {
        cart = new Cart({ userId: user._id, items: [] });
      }
      const hasMatch = cart.items.some(item => item.productId.equals(productId));
      if(hasMatch){
        if (quantity > product.stock) {
             return res.status(400).json({ error: 'Not enough stock available', availableStock: product.stock });
         }
      }else {
        cart.items.push({ productId, quantity });
        await cart.save();
      }
      return res.render('userSide/checkout', { cart:null, checkoutItems, quantity, addresses: address  });
    }
  }else if(queryString){
    console.log("cart")
    if (!queryString.cartItems) {
      return res.status(400).send('Missing cart items data'); // Handle missing data
    }
    const cartItemsString = queryString.cartItems;
    const cartItems = JSON.parse(cartItemsString);
   
    checkoutItems = await Promise.all(
      cartItems.map(async item => {
        const product = await Product.findById(item.productId);
        return {
          product,
          quantity: item.quantity
        };
      })
    );
    checkoutItems.forEach(item => {
      console.log("cart:"+item.product)
    });
    
    return res.render('userSide/checkout', { cart:null, checkoutItems, addresses: address  });
  }

};

 

const placeOrder =  async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const userId = user._id;
    const { orderItems, totalCost, paymentMode, couponCode, priceDetails, addressDetails} = req.body;

    if(paymentMode === "cod"){
      const validatedOrderItems = await validateOrderItems(orderItems);
      if (validatedOrderItems.length === 0) {
        return res.status(400).json({ success: false, error: 'One or more items are out of stock.' });
      }

      const order = await Order.create({
        userId,
        items: validatedOrderItems,
        totalCost,
        paymentMethod: 'cod',
        couponCode: couponCode,
        priceDetails: {
          discountAmount: priceDetails.discountAmount,
          salesTax: priceDetails.salesTax,
          deliveryCharge: priceDetails.deliveryCharge,
          subTotal: priceDetails.subTotal
        },
        deliveryAddress:addressDetails
      });

      await updateProductStock(validatedOrderItems);
      return res.status(200).json({ cod: true, order });

    }else if(paymentMode === "online"){
      var options = {
        amount: totalCost * 100, 
        currency: 'INR',
        receipt: 'order_receipt_xyz' // Replace with a unique order receipt (e.g., order ID)
      }
      // Create an order
      razorpay.orders.create(options, (err, order) => {
        if (err) {
          // Handle error
          console.error('Error creating Razorpay order:', err);
          return res.status(500).json({ error: 'Error creating Razorpay order' });
        }

        // Send the order details to the client
        res.json({ online: true, order });
      });
    }
  } catch (error) {
    console.error('Error placing order:', error);
    return res.status(500).json({ success: false, error: 'An error occurred while placing the order.' });
  }
};

// Validate order items and check stock availability
const validateOrderItems = async (orderItems) => {
  const validatedOrderItems = [];

  console.log(orderItems,"orderitemsss")
  for (const { productId, quantity } of orderItems) {
    const product = await Product.findById(productId);

    if (product && product.stock >= quantity) {
      const { name, price, photos } = product;
      const image = photos.length > 0 ? photos[0].filename : '';

      validatedOrderItems.push({ productId, name, price, quantity, image });
    }
  }

  return validatedOrderItems;
};

// Update stock for ordered products
const updateProductStock = async (orderedItems) => {
  for (const { productId, quantity } of orderedItems) {
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -quantity } });
  }
};

const paymentSuccess = async(req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const userId = user._id;
    const {orderData, orderItems, totalCost, couponCode, priceDetails, addressDetails} = req.body;
    const validatedOrderItems = await validateOrderItems(orderItems);
      if (validatedOrderItems.length === 0) {
        return res.status(400).json({ success: false, error: 'One or more items are out of stock.' });
      }

      console.log(orderItems,"orderitemss")
      const order =  await Order.create({
          userId,
          items: validatedOrderItems,
          totalCost: totalCost,
          paymentMethod: 'online',
          couponCode:couponCode,
          paymentDetails: {
              paymentId: orderData.paymentId,
              orderId: orderData.orderId,
              signature: orderData.signature
          },
          priceDetails: {
            discountAmount: priceDetails.discountAmount,
            salesTax: priceDetails.salesTax,
            deliveryCharge: priceDetails.deliveryCharge,
            subTotal: priceDetails.subTotal
        },
        deliveryAddress:addressDetails
      });

      console.log(order)
      await updateProductStock(validatedOrderItems);
      return res.status(200).json({ success: true });

  } catch (error) {
    console.log(error);
    res.status(500).send('Error');
  }
}


const orderHistory = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({isBlocked:false});
    if (!user) {
      return res.status(404).send('User not found');
    }
    const userId = user._id;

    const perPage = 4; 
    const page = parseInt(req.query.page) || 1; 

    const totalOrders = await Order.countDocuments({ userId });

    const totalPages = Math.ceil(totalOrders / perPage);

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate({ path: "items.productId", model: "products" })
      .populate('deliveryAddress');

      console.log(orders)
      function formatDate(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
      
      const formattedDate = orders.map(order => ({
        order,
        orderDate: formatDate(order.createdAt)
      }));

    res.render('orders/orderHistory', { orders, user, totalPages, currentPage: page , categoryList,formattedDate});
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving order history');
  }
};



const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;

    console.log("orderid:" + orderId)

    const order = await Order.findById(orderId);
    const coupon = await Coupon.findOne({code:order.couponCode});
    
    if (!order) {
      return res.status(404).send('Order not found');
    }

    const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).send('Item not found in the order');
    }

    const item = order.items[itemIndex];
    const product = await Product.findById(item.productId);

    if (product) {
      product.stock += item.quantity;
      await product.save();
    }

    if(coupon){
      const couponDiscount = coupon.discount / 100;
      const discountPrice = item.price * item.quantity * couponDiscount;
      order.totalCost += discountPrice;
      order.totalCost -= item.price * item.quantity;
    }else{
      order.totalCost -= item.price * item.quantity;
    }
    
    item.status =  'Cancelled';

    await order.save();

    res.redirect('/order-history');
  } catch (error) {
    console.log(error);
    res.status(500).send('Error cancelling order item');
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
      res.json({success:true, message: 'Quantity updated successfully' });
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



const toggleWishList = async (req, res) => {
  const { productId } = req.body;
  
  try {
    const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId}) 
    const userId = user._id;
      let wishlist = await Wishlist.findOne({ userId: userId });
      
      if (!wishlist) {
          wishlist = new Wishlist({ userId: userId, products: [] });
      }

      const productIndex = wishlist.products.findIndex(item => item.toString() === productId);
      
      if (productIndex > -1) {
          // Product is in wishlist, remove it
          wishlist.products.splice(productIndex, 1);
      } else {
          // Product is not in wishlist, add it
          console.log(productId+"wislist")
          wishlist.products.push(productId);
      }
      
      await wishlist.save();
      res.json({ success: true, isInWishlist: productIndex === -1 });
  } catch (error) {
      console.error(error);
      res.json({ success: false, message: 'Error toggling wishlist item' });
  }
};


const moveToWishList = async (req, res) => {
  const  productId = req.body.productId;
  const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId}) 
  const userId = user._id;


  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ error: 'Invalid userId or productId' });
  }

  try {
 
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }
    wishlist.products.push( productId );
    await wishlist.save();

    res.status(200).json({success:true, message: 'Product moved to wishlist successfully.' });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const removeFromWishList = async (req, res) => {
  const { userId, productId } = req.body;
  
  try {
      const wishlist = await Wishlist.findOne({ userId: userId });
      if (wishlist) {
          wishlist.products = wishlist.products.filter(item => item.toString() !== productId);
          await wishlist.save();
          res.json({ success: true });
      } else {
          res.json({ success: false, message: 'Wishlist not found' });
      }
  } catch (error) {
      console.error(error);
      res.json({ success: false, message: 'Error removing item from wishlist' });
  }
};

const wishListView = async(req,res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });

    const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
    const categoryList = await Category.find({isBlocked:false});

    const wishlistProducts = wishlist ? wishlist.products : [];
    res.render('cart/wishlist', { wishlist:wishlistProducts , categoryList});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

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

const orderDetails = async (req,res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({isBlocked:false});
    if (!user) {
      return res.status(404).send('User not found');
    }
    const userId = user._id;


    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

      function formatDate(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
      
      const formattedDate = orders.map(order => ({
        order,
        orderDate: formatDate(order.createdAt)
      }));

      console.log(orders)
    res.render('orders/orderDetails', { orders, user, categoryList, formattedDate});
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving order history');
  }
}



module.exports = {
    addToCart,
    cartView,
    updateQuantity,
    checkStock,
    toggleWishList,
    moveToWishList,
    removeFromWishList,
    wishListView,
    removeFromCart,
    checkoutView,
    placeOrder,
    paymentSuccess,
    orderHistory,
    cancelOrder,
    orderDetails
}
