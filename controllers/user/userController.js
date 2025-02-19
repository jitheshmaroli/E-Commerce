const User = require("../../models/user");
const multer = require('multer');
const path = require('path');
const Category = require('../../models/category');
const Wallet = require("../../models/wallet");

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
  
const userProfileView = async (req,res) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId});
    const categoryList = await Category.find({isBlocked:false});
    res.render("users/pages/userProfile",{user,categoryList});
  } catch (error) {
    console.log(error)
    res.status(500).send("internal error")
  }
}

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

const walletView = async( req, res ) => {
  try {
    const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId}).populate({ path: 'walletTransactions', options: { sort: { createdAt: -1 } }});
    const categoryList = await Category.find({isBlocked:false});
    console.log(user.walletTransactions)
    res.render("users/pages/wallet",{user,categoryList});
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

          

      // Create new wallet transaction
      const walletTransaction = new Wallet({
          userId: user._id,
          amount: amount,
          type: type,
          orderId: orderId
      });

       // Update wallet balance
       if (type === 'credit') {
        user.wallet += amount;
        walletTransaction.description = 'Order refund';
      } else if(type === 'debit') {
        user.wallet -= amount;
        walletTransaction.description = 'Order payment';
      }

      
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
  userProfileView,
  updateProfile,
  profilePhotoUpload,
  walletView,
  updateWallet
}
  