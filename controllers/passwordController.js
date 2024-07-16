const bcrypt = require("bcrypt")
const User = require("../models/user");
const otpController = require("../controllers/otpController");
const Otp = require("../models/otp");
const Category = require("../models/category");

//forgot password view

const forgotPasswordView = async (req, res) => {
    try {
        res.render("auth/forgotPassword",{message:""})

      } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
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
  
        res.render('auth/login',{message:'password changed successfully,Login for shopping'}); 
     
    }
   
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Internal server error' });
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

 
  const forgotPassword = async(req , res) => {
    
    const email = req.body.email;
    const userDataDb = await User.findOne({email})
    if(!userDataDb){
      console.log("no userdata with this email")
      res.render("auth/forgotPassword",{message:"no userdata with this email"})
    }else{
      const otp = otpController.generateOTP();

     await Otp.deleteMany({ email });
     const otpEntry = new Otp({ email, otp, expiry: Date.now() + 5 * 60 * 1000 });

 
    try {
       await otpEntry.save();
       otpController.sendOTP(email, otp);

      req.session.userData = email ; 
 
      return res.redirect('/forgot-password-verify-otp');

    }catch (error) {
    console.error('Error :', error);
    res.status(500).send('Internal server error');
  }
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
  
   
  
  
   const changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
  
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirm password do not match' });
    }
  
    try {
        const user = await User.findOne({ email: req.session.userId });
        const categoryList = await Category.find({isBlocked:false});
  
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
  
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.render("users/changePassword",{user, categoryList, message: 'Incorrect current password' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
  
        user.password = hashedPassword;
        await user.save();
  
        return res.render("users/changePassword",{user, categoryList, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
  };

  module.exports = {
    forgotPassword,
    forgotPasswordView,
    changePassword,
    changePasswordView,
    resetPassword,
    validatePassword
  }