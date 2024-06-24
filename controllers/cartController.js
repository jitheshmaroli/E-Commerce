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
const { applyOffers, getBestOffer, calculateDiscountedPrice } = require('../controllers/offerController');
const Wallet = require('../models/Wallet');

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

// const cartView = async (req,res) => {
//   try {
//     const user = await User.findOne({email : req.session.userId || req.session.passport.user.userId});
//     const categoryList = await Category.find({isBlocked:false});
//     const userId = user._id;
//     const cart = await Cart.findOne({ userId }).populate('items.productId');
//     if (!cart || cart.items.length === 0 ) {
//       return res.render('cart/cart', {items:"", message:"NO ITEMS IN CART", categoryList });
//     }



//     const items = cart.items.map((item) => {
//       const product = item.productId;
//       return {
//         productId: product._id,
//         name: product.name,
//         price: product.price,
//         stock: product.stock,
//         image: product.photos && product.photos.length > 0 ? product.photos[0].filename : '/images/no-image.jpg', 
//         quantity: item.quantity,
//         totalPrice:item.quantity * product.price,
//         selected:item.selected,
//       };
//     });

//     res.render('cart/cart', { items,message:"",categoryList });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: 'Internal server error' });
//   }
// }

const cartView = async (req, res) => {
  try {
    applyOffers();
    const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked: false});
    const userId = user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.render('cart/cart', {items: "", message: "NO ITEMS IN CART", categoryList});
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

    res.render('cart/cart', { items, message: "", categoryList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// const checkoutView = async (req, res) => {
//   const productId = req.params.productId; 
//   const quantity = req.params.quantity;
//   console.log("the quantity is: " + productId)
//   const queryString = req.query;
//   let checkoutItems=[];

//   const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
//   const userId = user._id;
//   const address = await Address.findOne({ userId });

//   if(productId && quantity){
//     const product = await Product.findById(productId);
//     console.log("the product is :" + product)
//     let cart = await Cart.findOne({ userId: user._id });

//     if(productId){
//       checkoutItems.push({product})
//       if (!checkoutItems) {
//         return res.status(404).send('items not found');
//       }
      
//       if (!cart) {
//         cart = new Cart({ userId: user._id, items: [] });
//       }
//       const hasMatch = cart.items.some(item => item.productId.equals(productId));
//       if(hasMatch){
//         if (quantity > product.stock) {
//              return res.status(400).json({ error: 'Not enough stock available', availableStock: product.stock });
//          }
//       }else {
//         cart.items.push({ productId, quantity });
//         await cart.save();
//       }
//       return res.render('userSide/checkout', { cart:null, checkoutItems, quantity, addresses: address, user });
//     }
//   }else if(queryString){
//     console.log("cart")
//     if (!queryString.cartItems) {
//       return res.status(400).send('Missing cart items data'); // Handle missing data
//     }
//     const cartItemsString = queryString.cartItems;
//     const cartItems = JSON.parse(cartItemsString);
   
//     checkoutItems = await Promise.all(
//       cartItems.map(async item => {
//         const product = await Product.findById(item.productId);
//         return {
//           product,
//           quantity: item.quantity
//         };
//       })
//     );
//     checkoutItems.forEach(item => {
//       console.log("cart:"+item.product)
//     });
    
//     return res.render('userSide/checkout', { cart:null, checkoutItems, addresses: address, user });
//   }

// };

const checkoutView = async (req, res) => {
  try {
    applyOffers();
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

      const bestOffer = await getBestOffer(product);
      const currentPrice = bestOffer ? calculateDiscountedPrice(product.price, bestOffer) : product.price;

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
          const bestOffer = await getBestOffer(product);
          const currentPrice = bestOffer ? calculateDiscountedPrice(product.price, bestOffer) : product.price;
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
        receipt: 'order_receipt_xyz' 
      }

      razorpay.orders.create(options, (err, order) => {
        if (err) {
          console.error('Error creating Razorpay order:', err);
          return res.status(500).json({ error: 'Error creating Razorpay order' });
        }

        res.json({ online: true, order });
      });
    }else if( paymentMode === "wallet"){
      const validatedOrderItems = await validateOrderItems(orderItems);
      if (validatedOrderItems.length === 0) {
        return res.status(400).json({ success: false, error: 'One or more items are out of stock.' });
      }

      if(!user.wallet >= totalCost){
        return res.status(400).json({ wallet: false, error: "insufficient balance" });
      }
      const order = await Order.create({
        userId,
        items: validatedOrderItems,
        totalCost,
        paymentMethod: 'wallet',
        couponCode: couponCode,
        priceDetails: {
          discountAmount: priceDetails.discountAmount,
          salesTax: priceDetails.salesTax,
          deliveryCharge: priceDetails.deliveryCharge,
          subTotal: priceDetails.subTotal
        },
        deliveryAddress:addressDetails
      });

       //user.wallet -= totalCost;
       const type = 'debit';
       await updateWallet(order.userId, totalCost, order._id, type);
       //await user.save();

      await updateProductStock(validatedOrderItems);
      return res.status(200).json({ cod: true, order });

    }
  } catch (error) {
    console.error('Error placing order:', error);
    return res.status(500).json({ success: false, error: 'An error occurred while placing the order.' });
  }
};

const validateOrderItems = async (orderItems) => {
  const validatedOrderItems = [];

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
    //const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });

    console.log("orderid:" + orderId);

    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate('deliveryAddress');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const itemIndex = order.items.findIndex(item => item.productId._id.toString() === itemId);

    if (itemIndex === -1) {
      return res.status(404).send('Item not found in the order');
    }

    const item = order.items[itemIndex];
    const product = await Product.findById(item.productId._id);

    if (product) {
      product.stock += item.quantity;
      await product.save();
    }

    const coupon = await Coupon.findOne({ code: order.couponCode });

    let itemPrice = item.productId.price * item.quantity;
    let discountPrice = 0;

    if (coupon) {
      const couponDiscount = coupon.discount / 100;
      discountPrice = itemPrice * couponDiscount;
      itemPrice -= discountPrice;
    }

    const salesTaxRate = order.priceDetails.salesTax / (order.priceDetails.subTotal + order.priceDetails.discountAmount);
    const itemSalesTax = itemPrice * salesTaxRate;
    const deliveryCharge = order.priceDetails.deliveryCharge;

    order.totalCost -= (itemPrice + itemSalesTax);

    order.priceDetails.subTotal -= item.productId.price * item.quantity;
    order.priceDetails.discountAmount -= discountPrice;
    order.priceDetails.salesTax -= itemSalesTax;

    item.status = 'Cancelled';

    const allItemsCancelled = order.items.every(item => item.status === 'Cancelled');
    if (allItemsCancelled) {
      order.totalCost = 0;
      order.priceDetails.subTotal = 0;
      order.priceDetails.discountAmount = 0;
      order.priceDetails.salesTax = 0;
    }

    if (order.paymentMethod === 'online' || order.paymentMethod === 'wallet') {
      const refundAmount = itemPrice + itemSalesTax + deliveryCharge;
      const type = 'credit';
      await updateWallet(order.userId, refundAmount, order._id, type);
    }
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
    const isProductInWishlist = wishlist.products.some(product => product.equals(productId));

    if (isProductInWishlist) {
      return res.status(200).json({success: true, message: 'Product is already in the wishlist' });
    }

    wishlist.products.push( productId );
    await wishlist.save();

    res.status(200).json({success:true, message: 'Product moved to wishlist successfully.' });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
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
    const orderId = req.params.orderId;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({isBlocked:false});
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    const order = await Order.findById({ _id: orderId })
      .populate("userId", "name email photo isVerified isAdmin isBlocked")
      .populate({ path: "items.productId", model: "products" })
      .populate('deliveryAddress');


      console.log(order)
    res.render('orders/orderDetails', { order, user, categoryList});
  } catch (error) {
    console.log(error);
    res.status(500).send('Error retrieving order history');
  }
}

const removeFromWishList = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const userId = user._id; 

    // Find the wishlist document for the user
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({ error: 'Wishlist not found' });
    }

    // Remove the product from the products array
    wishlist.products = wishlist.products.filter(
      (product) => !product.equals(productId)
    );

    // Save the updated wishlist document
    await wishlist.save();

    res.redirect("/wishlist");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

 
const walletView = async( req, res ) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId}).populate({ path: 'walletTransactions', options: { sort: { createdAt: -1 } }});
    const categoryList = await Category.find({isBlocked:false});
    console.log(user.walletTransactions)
    res.render("users/wallet",{user,categoryList});
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
}

async function updateWallet(userId, amount, orderId, type) {
  try {
      const user = await User.findById(userId);
      if (!user) {
          throw new Error('User not found');
      }

      // Update wallet balance
      if (type === 'credit') {
        user.wallet += amount;
      } else if(type === 'debit') {
        user.wallet -= amount;
      }
      

      // Create new wallet transaction
      const walletTransaction = new Wallet({
          userId: user._id,
          amount: amount,
          type: type,
          description: 'Order refund',
          orderId: orderId
      });

      // Save the wallet transaction
      await walletTransaction.save();

      // Add transaction reference to user's walletTransactions
      user.walletTransactions.push(walletTransaction._id);

      // Save the updated user
      await user.save();

      console.log('Refund processed successfully');
      console.log("Transaction:", walletTransaction);
  } catch (error) {
      console.error('Error processing refund:', error);
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
    orderDetails,
    moveToCart,
    walletView
}
