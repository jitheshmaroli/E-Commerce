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
    if (req.session.isUserAuthenticated || req.session.passport && req.session.passport.user ) {
      console.log("user is authenticated")
      next();
    } else {
      console.log("user is not authenticated")
      res.redirect('/login');
    }
  }

  //   redirect authenticated users/admin away from the login page
const redirectToDashboard = (req, res, next) => {
    if (req.session.isAdminAuthenticated) {
      res.redirect('/admin');
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