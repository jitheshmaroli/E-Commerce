const User = require("../models/user");
const bcrypt = require("bcrypt");
const otpController = require("./otpController");
const Category = require("../models/category");

const forgotPasswordView = (req, res) => {
  res.render("auth/forgotPassword", { message: "" });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.render("auth/forgotPassword", { message: "Email required" });

  const user = await User.findOne({ email });
  if (!user) {
    return res.render("auth/forgotPassword", { message: "No account with this email" });
  }

  const otp = otpController.generateOTP();
  await require("../models/otp").deleteMany({ email });
  await new (require("../models/otp"))({ email, otp, expiry: Date.now() + 5 * 60 * 1000 }).save();
  await otpController.sendOTP(email, otp);

  req.session.userData = email;
  res.redirect("/forgot-password-verify-otp");
};

const resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const email = req.session.userData;

  if (!email) return res.redirect("/forgot-password");
  if (password !== confirmPassword) {
    return res.render("auth/resetPassword", { message: "Passwords do not match" });
  }
  if (password.length < 8) {
    return res.render("auth/resetPassword", { message: "Password must be at least 8 characters" });
  }

  const hashed = await bcrypt.hash(password, 12);
  await User.updateOne({ email }, { password: hashed });

  delete req.session.userData;
  res.render("auth/login", { message: "Password reset successful. Please login." });
};

const changePasswordView = async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.session.userId || req.session.passport.user.userId,
    });
    const categoryList = await Category.find({ isBlocked: false });
    res.render("users/changePassword", { user, message: "", categoryList });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal error");
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirm password do not match" });
  }

  try {
    const user = await User.findOne({ email: req.session.userId });
    const categoryList = await Category.find({ isBlocked: false });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.render("users/changePassword", {
        user,
        categoryList,
        message: "Incorrect current password",
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    return res.render("users/changePassword", {
      user,
      categoryList,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

function validatePassword(password) {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':".,<>/?\\|~`]/g.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
    return "Password must contain at least one uppercase letter, lowercase letter, number, and symbol.";
  }

  return null;
}

module.exports = {
  forgotPasswordView,
  forgotPassword,
  resetPassword,
  changePassword,
  changePasswordView,
  validatePassword,
};
