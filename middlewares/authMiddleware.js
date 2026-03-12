const User = require("../models/user");

const isAdminAuthenticated = (req, res, next) => {
  if (req.session.isAdminAuthenticated) {
    next();
  } else {
    res.render("auth/login", { message: "login to continue" });
  }
};

const isUserAuthenticated = async (req, res, next) => {
  if (req.session.isUserAuthenticated || req.isAuthenticated()) {
    const user = await User.findOne({ email: req.session.userId });

    if (user?.isBlocked) {
      req.session.destroy();
      return res.redirect("/login?message=Your account has been blocked by admin");
    }

    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect("/login");
};

const redirectToDashboard = (req, res, next) => {
  if (req.session.isAdminAuthenticated) {
    res.redirect("/admin");
  } else if (req.session.isUserAuthenticated) {
    res.redirect("/");
  } else {
    next();
  }
};

const otpAuthentication = (req, res, next) => {
  if (req.session.userData) {
    next();
  } else {
    res.redirect("/login");
  }
};

module.exports = {
  isAdminAuthenticated,
  isUserAuthenticated,
  redirectToDashboard,
  otpAuthentication,
};
