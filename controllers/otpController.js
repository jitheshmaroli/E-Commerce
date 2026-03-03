const Otp = require("../models/otp");
const nodemailer = require("nodemailer");
const User = require("../models/user");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

const sendOTP = function sendOTP(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: email,
    subject: "Your OTP for verification",
    text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error occurred while sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

const verifyOtp = async (email, enteredOtp) => {
  const otpEntry = await Otp.findOne({ email }).sort({ createdAt: -1 });
  if (!otpEntry) return { valid: false, message: "OTP expired" };

  if (Date.now() > otpEntry.expiry) {
    await Otp.deleteOne({ _id: otpEntry._id });
    return { valid: false, message: "OTP expired" };
  }

  if (enteredOtp !== otpEntry.otp.toString()) {
    return { valid: false, message: "Invalid OTP" };
  }

  await Otp.deleteOne({ _id: otpEntry._id });
  return { valid: true };
};

const getRemainingTime = async (email) => {
  const latestOtp = await Otp.findOne({ email }).sort({ createdAt: -1 });
  if (!latestOtp) return 0;

  const elapsed = Math.floor((Date.now() - latestOtp.createdAt.getTime()) / 1000);
  return Math.max(60 - elapsed, 0);
};

const verifyOtpView = async (req, res) => {
  if (!req.session.userData) return res.redirect("/signup");

  const email = req.session.userData.email;
  const remainingTime = await getRemainingTime(email);
  const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");

  res.render("auth/verifyOtp", {
    userData: req.session.userData,
    maskedEmail,
    message: "",
    remainingTime,
    otp: "",
  });
};

const forgotPasswordVerifyOtpView = async (req, res) => {
  if (!req.session.userData) return res.redirect("/forgot-password");

  const email = req.session.userData;
  const remainingTime = await getRemainingTime(email);

  const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");

  res.render("auth/resetPasswordVerifyOtp", {
    userData: email,
    maskedEmail,
    message: "",
    remainingTime,
    otp: "",
  });
};

const verifyOtpSignup = async (req, res) => {
  const { otp } = req.body;
  const userData = req.session.userData;

  const maskedEmail = userData.email.replace(/(.{2}).*(@.*)/, "$1***$2");
  if (!userData || !otp) {
    return res.render("auth/verifyOtp", {
      userData,
      maskedEmail,
      message: "Invalid request",
      remainingTime: await getRemainingTime(userData.email),
      otp: otp || "",
    });
  }

  const { valid, message } = await verifyOtp(userData.email, otp);
  if (!valid) {
    return res.render("auth/verifyOtp", {
      userData,
      maskedEmail,
      message,
      remainingTime: await getRemainingTime(userData.email),
      otp,
    });
  }

  const newUser = new User({
    name: userData.name,
    email: userData.email,
    password: userData.hashedPassword,
    isVerified: true,
  });
  await newUser.save();

  req.session.isUserAuthenticated = true;
  req.session.userId = userData.email;
  delete req.session.userData;

  res.redirect("/");
};

const forgotPasswordVerifyOtp = async (req, res) => {
  const { otp } = req.body;
  const email = req.session.userData;

  if (!email || !otp) {
    return res.redirect("/forgot-password");
  }

  const { valid, message } = await verifyOtp(email, otp);

  const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");

  if (!valid) {
    return res.render("auth/resetPasswordVerifyOtp", {
      userData: email,
      maskedEmail,
      message,
      remainingTime: await getRemainingTime(email),
    });
  }

  res.render("auth/resetPassword", { message: "" });
};

const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: "Email required" });

  try {
    const latestOtp = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (latestOtp && Date.now() < latestOtp.createdAt.getTime() + 60 * 1000) {
      const remaining = Math.ceil((latestOtp.createdAt.getTime() + 60 * 1000 - Date.now()) / 1000);
      return res.json({
        success: false,
        message: `Please wait ${remaining} seconds before resending`,
      });
    }

    const otp = generateOTP();
    await Otp.deleteMany({ email });
    const otpEntry = new Otp({ email, otp, expiry: Date.now() + 5 * 60 * 1000 });
    await otpEntry.save();

    await sendOTP(email, otp);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
};

const resetPasswordSendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("auth/forgotPassword", { message: "Email not found" });
    }

    const otp = generateOTP();
    await Otp.deleteMany({ email });
    const otpEntry = new Otp({
      email,
      otp,
      expiry: Date.now() + 5 * 60 * 1000,
    });
    await otpEntry.save();
    await sendOTP(email, otp);

    req.session.userData = email;
    res.redirect("/forgot-password-verify-otp");
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resetPasswordVerifyOtp = async (req, res) => {
  const { otp } = req.body;
  const email = req.session.userData;

  if (!email || !otp) {
    return res.redirect("/forgot-password");
  }

  try {
    const { valid, message } = await verifyOtp(email, otp);

    const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");

    if (!valid) {
      return res.render("auth/resetPasswordVerifyOtp", {
        userData: email,
        maskedEmail,
        message,
        remainingTime: await getRemainingTime(email),
        otp,
      });
    }

    res.render("auth/resetPassword", { userData: email, message: "" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
};

module.exports = {
  generateOTP,
  sendOTP,
  verifyOtpView,
  verifyOtpSignup,
  forgotPasswordVerifyOtpView,
  forgotPasswordVerifyOtp,
  resendOtp,
  resetPasswordSendOtp,
  resetPasswordVerifyOtp,
};
