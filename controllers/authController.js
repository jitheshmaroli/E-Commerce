const User = require("../models/user");
const bcrypt = require("bcrypt");
const otpController = require("./otpController");

const loginViewUser = (req, res) => {
  const message = req.query.message || req.query.error || "";
  res.render("auth/login", { message });
};

const signupView = (req, res) => {
  res.render("auth/signup", { message: "" });
};

const userSignup = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render("auth/signup", { message: "All fields are required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("auth/login", { message: "Email already registered. Please login." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = otpController.generateOTP();

    await otpController.sendOTP(email, otp);
    await require("../models/otp").deleteMany({ email });
    await new (require("../models/otp"))({ email, otp, expiry: Date.now() + 5 * 60 * 1000 }).save();

    req.session.userData = { name, email, hashedPassword };
    res.redirect("/verify-otp");
  } catch (err) {
    console.error(err);
    res.render("auth/signup", { message: "Server error. Try again." });
  }
};

const verifyLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render("auth/login", { message: "Invalid credentials" });
    }
    if (user.isBlocked) {
      return res.render("auth/login", { message: "Your account is blocked" });
    }

    req.session.isUserAuthenticated = true;
    req.session.userId = user.email;

    const redirectTo = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(redirectTo);
  } catch (err) {
    console.error(err);
    res.render("auth/login", { message: "Server error" });
  }
};

const logoutViewUser = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};

module.exports = {
  loginViewUser,
  signupView,
  userSignup,
  verifyLogin,
  logoutViewUser,
};
