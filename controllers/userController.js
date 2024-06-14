const User = require("../models/user");
const Otp = require("../models/otp");
const bcrypt = require("bcrypt")
const nodemailer = require('nodemailer');
const Product = require("../models/product");
const Addresses = require("../models/address");
const multer = require('multer');
const path = require('path');
const Wishlist = require("../models/wishList");
const Category = require('../models/category');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // eslint-disable-next-line no-undef
    cb(null, path.join(__dirname, '../public/uploads')); 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); 
  }
});

const upload = multer({ 
  storage: storage,
});

const profilePhotoUpload = upload.array('photos',1); 

// nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      // eslint-disable-next-line no-undef
      user: process.env.EMAIL_ADDRESS,
      // eslint-disable-next-line no-undef
      pass: process.env.EMAIL_PASSWORD
    }
  });

// Generating OTP

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
  }

// Send OTP via email 

const sendOTP = function sendOTP(email, otp) {
    const mailOptions = {
      // eslint-disable-next-line no-undef
      from: process.env.EMAIL_ADDRESS,
      to: email,
      subject: 'Your OTP for verification',
      text: `Your OTP is ${otp}. It is valid for 5 minutes.`
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error occurred while sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });
  }
  const forgotPasswordVerifyOtpView = async(req,res) => {
    try {
        const userData = req.session.userData
        res.render("auth/resetPasswordVerifyOtp",{userData,message:''})
    } catch (error) {
        console.log(error)
        res.status(500).send('Internal server error');
    }
  }
  //verify otp view

  const verifyOtpView = async(req,res) => {
    try {
        const userData = req.session.userData
        res.render("auth/verifyOtp",{userData,message:''})
    } catch (error) {
      console.log(error);
        res.status(500).send('Internal server error');
    }
  }

// Function to verify OTP
const verifyOtp = async (email, enteredOtp) => {
  try {
    const otpEntry = await Otp.findOne({ email });
    console.log(otpEntry.otp + ": " + enteredOtp )
    if (!otpEntry || enteredOtp !== otpEntry.otp.toString()) {
      console.log("no data in db or OTP mismatch");
      return false; 
    }

    const currentTime = Date.now();
    if (currentTime > otpEntry.expiry) {
      await otpEntry.deleteOne(); 
      return 'OTP has expired. Please initiate a new request.';
    }

    await otpEntry.deleteOne(); 
    return true; 
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error; 
  }
};

//forgot password view

const forgotPasswordView = async (req, res) => {
    try {
        res.render("auth/forgotPassword",{message:""})

      } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
      }
  };

// function forgot password

const resetPasswordSendOtp = async (req, res) => {
  const { email } = req.body.email;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("auth/forgotPassword",{message:"Email not found"})
    }

    const otp = generateOTP();
    await Otp.deleteMany({ email });
    const otpEntry = new Otp({ email, otp, expiry: Date.now() + 5 * 60 * 1000 });
    await otpEntry.save();
    sendOTP(email, otp);

    res.render("auth/forgotPassword",{message:""})

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const resetPasswordVerifyOtp = async (req, res) => {
  const { email, otp } = req.body;
console.log(email + ":" + otp)
  req.session.userData = email;
  try {
    const isValidOtp = await verifyOtp(email, otp);

    if (!isValidOtp) {
      return res.status(401).json({ message: isValidOtp }); 
    }

    res.render('auth/resetPassword',{message:''}); 
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const resetPassword = async (req, res) => {
  const {  password , confirmPassword } = req.body;

  const email = req.session.userData;
  try {


    if(password !== confirmPassword){
      res.render("auth/resetPassword",{message:"password mismatch"});
    }

     
    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log(passwordError) 
    }else{
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.findOneAndUpdate({ email }, { password: hashedPassword });
  
        res.render('auth/loginregister',{message:'password changed successfully,Login for shopping'}); 
     
    }
   
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const forgotPasswordResendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const otpEntry = await Otp.findOne({ email });

    if (!otpEntry) {
      return res.status(400).send('No OTP request found for this email');
    }

    const currentTime = Date.now();
    if (currentTime > otpEntry.expiry) {
      await otpEntry.deleteOne(); 
      return res.status(400).send('OTP has expired. Please initiate a new forgot password request.');
    }

    
    const shouldResend = true;

    if (shouldResend) {
      const newOtp = generateOTP();
      otpEntry.otp = newOtp;
      otpEntry.expiry = Date.now() + 5 * 60 * 1000; 
      await otpEntry.save();
      sendOTP(email, newOtp);
      res.send('New OTP sent to your email');
    } else {
      res.send('OTP resend limit reached. Please try again later.');
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).send('Internal server error');
  }
};



//login signup view

const loginViewUser = async (req, res) => {
    try {
      console.log("login view user")
      let message = req.query.error;
      console.log("error message : " + message)
      if(!message){
        message = '' ;
      }
      console.log(message)
     res.render("auth/login",{message});

      } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
      }
  };
  
  const signupView = async (req, res) => {
    try {
      let message = req.query.error;
      console.log(message)
      if(!message || message == "timemout"){
        message = '' ;
      }
     res.render("auth/signup",{message});
    } catch (error) {
      console.error(error.message);
      res.status(500).send('Internal Server Error');
    }
  };

  function validatePassword(password) {
    
    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
 
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':".,<>/?\\|~`]/g.test(password);
 
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      return 'Password must contain at least one uppercase letter, lowercase letter, number, and symbol.';
    }
 
    return null; 
  }

//  Signup 

const userSignup = async (req, res) => {
    const { name, email, password } = req.body;
  
    // Validate user input
    if (!name || !email || !password ) {
      console.log("Incomplete credentials");
      return res.status(400).send("Please provide all required information (name, email, password).");
    }
  
    // Check for existing email
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.render("auth/loginregister",{message:'Email already exists. Please choose a different email address.'});
      }
    } catch (error) {
      console.error('Error checking for existing user:', error);
      return res.status(500).send('Internal server error. Please try again later.');
    }
   
    const passwordError = validatePassword(password);
    if (passwordError) {
      console.log(passwordError) 
    } else {
      // Generate OTP
       const otp = generateOTP();
  
       await Otp.deleteMany({ email });
       const otpEntry = new Otp({ email, otp, expiry: Date.now() + 5 * 60 * 1000 }); 
   
      try {
         await otpEntry.save();
         sendOTP(email, otp);
  
        const hashedPassword = await bcrypt.hash(password, 10);
        req.session.userData = { name, email, hashedPassword }; 
        return res.redirect('/verify-otp');
      } catch (error) {
        console.error('Error saving OTP:', error);
        return res.status(500).send('Internal server error. Please try again later.');
      }
    }
  };
   

//  const shoppingHomeView = async (req, res) => {
//   try {
//       const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
//       const categoryList = await Category.find({isBlocked:false});
//       let wishlistProducts = [];
//       if (user) {
//           const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
//           console.log(wishlist)
//           wishlistProducts = wishlist ? wishlist.products : [];
//       }

//       const products = await Product.find({ isDeleted: false, photos: { $ne: [] } }).populate('reviews');

//       res.render('userSide/shoppingHome', { products: products,productsToSort: products, wishlistProducts: wishlistProducts,user,categoryList });
//   } catch (error) {
//       console.error(error);
//       res.status(500).send("Internal Server Error");
//   }
// };

const shoppingHomeView = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const categoryList = await Category.find({ isBlocked: false });
    let wishlistProducts = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user._id }).populate('products');
      console.log(wishlist);
      wishlistProducts = wishlist ? wishlist.products : [];
    }

    const products = await Product.find({ isDeleted: false, photos: { $ne: [] } }).populate('reviews');

    // Calculate the average rating for each product
    const productsWithRating = products.map(product => {
      const reviews = product.reviews;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
      return {
        ...product.toObject(),
        averageRating: averageRating.toFixed(1)
      };
    });
    res.render('userSide/shoppingHome', {
      products: productsWithRating,
      productsToSort: productsWithRating,
      wishlistProducts: wishlistProducts,
      user,
      categoryList
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};


      //resend otp

const resendSignupOtp = async (req, res) => {
  const { email } = req.body;
      
  try {
    const otpEntry = await Otp.findOne({ email });
    if (!otpEntry) {
      return res.status(400).send('No OTP request found for this email');
    }
    
    const currentTime = Date.now();
    if (currentTime > otpEntry.expiry) {
      await otpEntry.deleteOne(); // Remove expired OTP
      return res.status(400).send('OTP has expired. Please initiate a new signup request.');
    }
    const shouldResend = true;
    if (shouldResend) {
      const newOtp = generateOTP();
      otpEntry.otp = newOtp;
      otpEntry.expiry = Date.now() + 5 * 60 * 1000;
      console.log(otpEntry)
      await otpEntry.save();
      sendOTP(email, newOtp);
      res.send('New OTP sent to your email');
    } else {
      res.send('OTP resend limit reached. Please try again later.');
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).send('Internal server error');
  }
};
      

  
const verifyLogin = async (req, res) => {
    const { email, password } = req.body;
    console.log("verify")
  
    if (!email || !password) {
      console.log("noemailnopassword")
      return res.render('auth/loginregister', { message: 'Incomplete fields' });
    }
  
    try {
      const userDataDb = await User.findOne({ email }); 
      if (!userDataDb) {
        console.log("no userdata")
        return res.render('auth/loginregister', { message: 'Invalid credentials' });
      }
  
      if(userDataDb.isBlocked){
        return res.render('auth/loginregister', { message: ' user is blocked from the site' });
      }

      const passwordMatch = await bcrypt.compare(password, userDataDb.password);
  
      if (passwordMatch) {
        if (userDataDb.isAdmin) {
          console.log("admin")
          req.session.isAdminAuthenticated =  true ;
          req.session.adminId = email ;
          res.render('admin/dashboard');
        } else {
          console.log("user")
          req.session.isUserAuthenticated =  true ;
          req.session.userId = email ;
          res.redirect("/");
        }
      } else {
        res.render('auth/loginregister', { message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error(error.message);
      res.status(500).send('Internal Server Error');
    }
  };
const verifyOtpSignup = async (req, res) => {
  try {
    const enteredOtp  = req.body.otp; 
    const userData = req.session.userData;
    console.log(userData);
  
    console.log(enteredOtp);
    console.log(userData)
    if (!userData || !enteredOtp) {
      console.log("nodata,no otp")
      return res.render('auth/verifyOtp', {userData, message: 'Invalid request' });
    }
  
    const isValidOtp = await verifyOtp(userData.email, enteredOtp);
  
    if (isValidOtp) {
       // OTP verified, redirect to login page
      console.log(userData.hashedPassword)
      const newUser = new User({ name: userData.name, email: userData.email, password: userData.hashedPassword, isVerified: true });

       console.log(newUser)
       await newUser.save();
       console.log("new user registered");
       req.session.isUserAuthenticated =  true ;
       req.session.userId = userData.email ;
       delete req.session.userData;
       res.redirect("/");
    } else {
       console.log("invalid otp")
       
       return res.render('auth/verifyOtp', {userData, message: 'Invalid OTP. Please try again.' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).send('Internal server error');
  }
};

  const forgotPassword = async(req , res) => {
    
      const email = req.body.email;
      const userDataDb = await User.findOne({email})
      if(!userDataDb){
        console.log("no userdata with this email")
        res.render("auth/forgotPassword",{message:"no userdata with this email"})
      }else{
        const otp = generateOTP();
  
       await Otp.deleteMany({ email });
       const otpEntry = new Otp({ email, otp, expiry: Date.now() + 5 * 60 * 1000 });

   
      try {
         await otpEntry.save();
         sendOTP(email, otp);
  
        req.session.userData = email ; 
   
        return res.redirect('/forgot-password-verify-otp');

      }catch (error) {
      console.error('Error :', error);
      res.status(500).send('Internal server error');
    }
  }
};

  const logoutViewUser = async (req,res) =>{
    try {
      req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('auth/login',{message:"logged out successfully"});
        }
    });
   } catch (error) {
       console.log(error.message);
       res.status(500).send('Internal Server Error');
   }
};

const forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const enteredOtp  = req.body.otp; 
    const userData = req.session.userData;
    console.log(userData);

    console.log(enteredOtp);
    console.log(userData)
    if (!userData || !enteredOtp) {
      console.log("nodata,no otp")
      return res.render('auth/verifyOtp', {userData, message: 'Invalid request' });
    }

    const isValidOtp = await verifyOtp(userData.email, enteredOtp);

    if (isValidOtp) {

      res.render("auth/resetPassword",{userData,message:''});
     
    } else {
      console.log("invalid otp")
     
      return res.render('auth/verifyOtp', {userData, message: 'Invalid OTP. Please try again.' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).send('Internal server error');
  }
};
  
const userProfileView = async (req,res) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    res.render("users/userProfile",{user,categoryList});
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
}

const addressesView = async (req, res) => {
  try {
    const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    const address = await Addresses.findOne({
      userId:user._id
    }).populate('address');
    if(!address){
      return res.render("users/address", { user, addresses:"" ,categoryList });
    }

    res.render("users/address", { user, addresses:address , categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
};

const addAddressView = async (req,res) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    res.render("users/addAddress",{user,message:'', categoryList});
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
};

const changePasswordView = async (req,res) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    res.render("users/changePassword",{user,message:'' , categoryList});
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
};

 
const addAddress = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const { name, houseName, street, city, district, state, pinCode } = req.body;

  
    const newAddress = {
      name,
      houseName,
      street,
      city,
      district,
      state,
      pinCode
    };

    let address = await Addresses.findOne({ userId: user._id });
    if (!address) {
      address = new Addresses({ userId: user._id, address: [] });
    }
    
    address.address.push(newAddress);

   
    await address.save();

    res.render("users/addAddress", { user, message: 'Address added successfully'});
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const addNewAddress = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
    const { name, houseName, street, city, district, state, pinCode, isDefault } = req.body;

    const newAddress = {
      name,
      houseName,
      street,
      city,
      district,
      state,
      pinCode,
      isDefault 
    };

    let address = await Addresses.findOne({ userId: user._id });
    if (!address) {
      address = new Addresses({ userId: user._id, address: [] });
    }

    // If the new address should be set as default
    if (newAddress.isDefault) {
      // Set all existing addresses to non-default
      address.address = address.address.map(addr => ({ ...addr, isDefault: false }));
    }

    address.address.push(newAddress);
    await address.save();
    res.json({success:true})
    // res.render("users/addAddress", { user, message: 'Address added successfully' });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

 const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match' });
  }

  try {
      const user = await User.findOne({ email: req.session.userId });

      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
          return res.render("users/changePassword",{user, message: 'Incorrect current password' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
      await user.save();

      return res.render("users/changePassword",{user, message: 'Password changed successfully' });
  } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({ message: 'Internal server error' });
  }
};



const setDefault = async (req, res) => {
  const { addressId } = req.body;

  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const userId = user._id;

    console.log(user._id)
    const addressDoc = await Addresses.findOne({ userId: userId});

    if (!addressDoc) {
      return res.status(404).json({ success: false, message: 'Address document not found' });
    }

    // Update isDefault for all addresses (using atomic operator)
    // await Addresses.updateOne(
    //   { userId: user._id },
    //   { $set: { 'address.$[].isDefault': false } }
    // );

   await Addresses.findOneAndUpdate(
      { userId: userId }, 
      { $set: { "address.$[].isDefault": false } },
      { upsert: false, returnOriginal: false }
    )


    
    await Addresses.updateOne(
      { userId: user._id, 'address._id': addressId },
      { $set: { 'address.$.isDefault': true } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};





const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId
    });
    const userId = user._id;
    const addressId = req.params.addressId;
    const isDefault = req.body.isDefault;

    await Addresses.updateMany(
      { userId, 'address._id': { $ne: addressId } },
      { $set: { 'address.$[].isDefault': false } }
    );

    const updatedAddress = await Addresses.findOneAndUpdate(
      { userId, 'address._id': addressId },
      { $set: { 'address.$.isDefault': isDefault } },
      { new: true }
    );
    updatedAddress.address.forEach((addr) => {
      addr.isDefaultForUI = addr._id.toString() === addressId;
    });

    res.json({
      message: 'Default address updated successfully',
      updatedAddress: updatedAddress.address
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const editAddressView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });

    const addressId = req.params.addressId;
    const addressDoc = await Addresses.findOne({ userId: user._id });
    const categoryList = await Category.find({isBlocked:false});

    if (!addressDoc) {
      return res.status(404).json({ error: 'No addresses found for this user' });
    }

    const address = addressDoc.address.find(
      (addr) => addr._id.toString() === addressId
    );

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.render("users/editAddress", { user, address,message:'' , categoryList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateAddress = async (req, res) => {
  const addressId = req.query.addressId;
  console.log("updating")
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const addressDoc = await Addresses.findOne({ userId: user._id });
    console.log(addressDoc)

    if (!addressDoc) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const addressIndex = addressDoc.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ error: 'Address not found' });
    }

    console.log(addressIndex);
    addressDoc.address[addressIndex].name = req.body.name;
    addressDoc.address[addressIndex].houseName = req.body.houseName;
    addressDoc.address[addressIndex].street = req.body.street;
    addressDoc.address[addressIndex].city = req.body.city;
    addressDoc.address[addressIndex].district = req.body.district;
    addressDoc.address[addressIndex].state = req.body.state;
    addressDoc.address[addressIndex].pinCode = req.body.pinCode;
    addressDoc.address[addressIndex].isDefault = req.body.isDefault === true;

    if (req.body.isDefault) {
      console.log("if consdtition")
      addressDoc.address.forEach((address) => {
        if (address._id.toString() !== addressId) {
          address.isDefault = false;
        }
      });
    }
    console.log(req.body.isDefault+"addresssss")
    console.log(addressDoc)
    await addressDoc.save();
    res.json({success:true});
    // res.redirect('/address');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const addressDoc = await Addresses.findOne({ userId: user._id });

    if (!addressDoc) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const addressIndex = addressDoc.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (addressDoc.address[addressIndex].isDefault) {
      return res.status(403).json({ error: 'Cannot delete default address' });
    }


    addressDoc.address.splice(addressIndex, 1);

    await addressDoc.save();

    res.redirect("/address")
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    console.log("form submitted")
      const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId});
 
      const { name, gender, email } = req.body;


      console.log(req.body.name )
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }
      let isDataChanged = false;

    if (name && name !== user.name) {
      console.log("name")
        user.name = name;
        isDataChanged = true;
    }
    if (gender && gender !== user.gender) {
        user.gender = gender;
        isDataChanged = true;
    }
    if (email && email !== user.email) {
        user.email = email;
        isDataChanged = true;
    }

    let uploadedPhoto = [];
if (req.file) {
  console.log(req.file.filename)
  isDataChanged = true;
  uploadedPhoto.push({
    filename: req.file.filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
  });
}

    if (isDataChanged) {
      console.log(user)
      const updatedUser = await User.findByIdAndUpdate(user._id, {
        name,
        gender,
        email
      });
      updatedUser.photo = uploadedPhoto;
        await updatedUser.save();
    }

    res.redirect("/profile");
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
  }
};


  module.exports = {
    verifyLogin,
    resendSignupOtp,
    shoppingHomeView,
    userSignup,
    loginViewUser,
    forgotPasswordResendOtp,
    forgotPassword,
    forgotPasswordView,
    verifyOtpView,
    signupView,
    verifyOtpSignup,
    resetPassword,
    resetPasswordSendOtp,
    resetPasswordVerifyOtp,
    logoutViewUser,
    forgotPasswordVerifyOtpView,
    forgotPasswordVerifyOtp,
    userProfileView,
    addressesView,
    addAddressView,
    changePasswordView,
    addAddress,
    addNewAddress,
    changePassword,
    setDefaultAddress,
    editAddressView,
    setDefault,
    updateAddress,
    deleteAddress,
    updateProfile,
    profilePhotoUpload
    
  }
  