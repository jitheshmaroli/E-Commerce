//admin authentication
const  isAdminAuthenticated = (req, res, next) => {
    if (req.session.isAdminAuthenticated) {
      next();
    } else {
      res.render('auth/login',{message:"login to continue"});
    }
  }
  
  //  user authentication
  const isUserAuthenticated = (req, res, next) => {
    if (req.session.isUserAuthenticated || req.session.passport && req.session.passport.user.isUserAuthenticated ) {
      console.log("user is authenticated")
      next();
    } else {
      req.session.returnTo = req.originalUrl;
      console.log("user is not authenticated:",req.originalUrl)
      res.redirect('/login?message=please login to continue');
    }
  }

  //   redirect authenticated users/admin away from the login page
const redirectToDashboard = (req, res, next) => {
    if (req.session.isAdminAuthenticated) {
      res.redirect('/admin/dashboard');
    }else if (req.session.isUserAuthenticated) {
      res.redirect('/');
    }else {
      console.log("user authentication : " + req.session.isUserAuthenticated)
      console.log("auth failed")
      next();
    }
     
  }

  const otpAuthentication = (req, res, next) => {
    if (req.session.userData) {
      next();
    } else {
      res.redirect('/login');
    }
     
  }

  module.exports = {
    isAdminAuthenticated,
    isUserAuthenticated,
    redirectToDashboard,
    otpAuthentication
  }