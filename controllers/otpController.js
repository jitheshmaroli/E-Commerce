const Otp = require("../models/otp");
const nodemailer = require('nodemailer');
const User = require("../models/user");
 
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

  const forgotPasswordVerifyOtpView = async(req,res) => {
    try {
        const userData = req.session.userData
        res.render("auth/resetPasswordVerifyOtp",{userData,message:''})
    } catch (error) {
        console.log(error)
        res.status(500).send('Internal server error');
    }
  }

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
        
module.exports = {
  resendSignupOtp,
  verifyOtpSignup,
  forgotPasswordVerifyOtp,
  forgotPasswordVerifyOtpView,
  forgotPasswordResendOtp,
  resetPasswordSendOtp,
  resetPasswordVerifyOtp,
  verifyOtpView,
  sendOTP,
  generateOTP

}