const express = require("express");
const nocache = require('nocache');
const app = express();
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

const path = require("path");
const bodyparser = require("body-parser");
const session = require("express-session");
const morgan = require("morgan");
const dotenv = require('dotenv');
const { connectDB } = require("./config/database.js"); 
const passport = require('passport');


// dotenv configuration
dotenv.config();

// Corrected MongoStore instantiation
const MongoStore = require('connect-mongo');
const sessionStore = MongoStore.create({
  // eslint-disable-next-line no-undef
  mongoUrl: process.env.MONGO_URL,
  collectionName: 'session'
  })

// db connection
connectDB();

// eslint-disable-next-line no-undef
const port = process.env.PORT || 3000;

// Middleware setup (consider ordering)
app.use(nocache()); 
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.set('view engine', 'ejs');
// eslint-disable-next-line no-undef
app.set('views', path.join(__dirname, 'views'));
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, 'public'))); 


// Session management
app.use(
  session({
    // eslint-disable-next-line no-undef
    secret: process.env.SECRET, 
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 
    }
  })
);

// // Catch 404 and forward to error handler
// app.use((req, res, next) => {
//   const err = new Error('Not Found');
//   err.status = 404;
//   next(err);
// });

// // Error handler
// // eslint-disable-next-line no-unused-vars
// app.use((err, req, res, next) => {
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   const statusCode = err.status || 500;
//   res.status(statusCode);
  
//   if (statusCode === 404) {
//     res.render('errors/404');
//   } else {
//     res.render('errors/500');
//   }
// });

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());



const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes.js");

app.use("/admin", adminRoutes);
app.use("/", userRoutes);

app.listen(port, () => {
  console.log(`server is running at ${port}`);
});
