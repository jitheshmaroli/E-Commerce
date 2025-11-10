const User = require("../models/user");
const passwordController = require("../controllers/passwordController");
const otpController = require("../controllers/otpController");
const Otp = require("../models/otp");
const bcrypt = require("bcrypt");

//login signup view

const loginViewUser = async (req, res) => {
  try {
    let message = req.query.error || req.query.message;
    if (!message) {
      message = "";
    }
    res.render("auth/login", { message });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const signupView = async (req, res) => {
  try {
    let message = req.query.error;
    if (!message || message == "timemout") {
      message = "";
    }
    res.render("auth/signup", { message });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

//  Signup
const userSignup = async (req, res) => {
  const { name, email, password } = req.body;

  // Validate user input
  if (!name || !email || !password) {
    return res
      .status(400)
      .send("Please provide all required information (name, email, password).");
  }

  // Check for existing email
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("auth/loginregister", {
        message:
          "Email already exists. Please choose a different email address.",
      });
    }
  } catch (error) {
    console.error("Error checking for existing user:", error);
    return res
      .status(500)
      .send("Internal server error. Please try again later.");
  }

  const passwordError = passwordController.validatePassword(password);
  if (passwordError) {
    console.log(passwordError);
  } else {
    // Generate OTP
    const otp = otpController.generateOTP();

    await Otp.deleteMany({ email });
    const otpEntry = new Otp({
      email,
      otp,
      expiry: Date.now() + 5 * 60 * 1000,
    });

    try {
      await otpEntry.save();
      otpController.sendOTP(email, otp);

      const hashedPassword = await bcrypt.hash(password, 10);
      req.session.userData = { name, email, hashedPassword };
      return res.redirect("/verify-otp");
    } catch (error) {
      console.error("Error saving OTP:", error);
      return res
        .status(500)
        .send("Internal server error. Please try again later.");
    }
  }
};

const verifyLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("auth/login", { message: "Incomplete fields" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("auth/loginregister", {
        message: "Invalid credentials",
      });
    }

    if (user.isBlocked) {
      return res.render("auth/login", {
        message: " user is blocked from the site",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      if (user.isAdmin) {
        req.session.isAdminAuthenticated = true;
        req.session.adminId = email;
        res.render("admin/dashboard");
      } else {
        req.session.isUserAuthenticated = true;
        req.session.userId = user.email;
        const redirectTo = req.session.returnTo || "/";
        delete req.session.returnTo;
        console.log(req.session);
        res.redirect(redirectTo);
      }
    } else {
      res.render("auth/login", { message: "Invalid credentials" });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const logoutViewUser = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        res.status(500).send("Internal Server Error");
      } else {
        res.render("auth/login", { message: "logged out successfully" });
      }
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  loginViewUser,
  verifyLogin,
  signupView,
  userSignup,
  logoutViewUser,
};
