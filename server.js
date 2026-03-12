const express = require("express");
const nocache = require("nocache");
const app = express();
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

const path = require("path");
const bodyparser = require("body-parser");
const session = require("express-session");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { connectDB } = require("./config/database.js");

const passport = require("passport");
// dotenv configuration
dotenv.config();

const MongoStore = require("connect-mongo");
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URL,
  collectionName: "session",
});

// db connection
connectDB()
  .then(() => {
    require("./utils/cronJobs");
  })
  .catch((err) => {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  });

const port = process.env.PORT;

// Middleware setup
app.use(nocache());
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

// Session management
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes.js");

app.use("/admin", adminRoutes);
app.use("/", userRoutes);

//404
// eslint-disable-next-line no-unused-vars
app.use((req, res, next) => {
  res.status(404).render("errors/404");
});

// // eslint-disable-next-line no-unused-vars
// app.use((err, req, res, next) => {
//   console.error(`[${new Date().toISOString()}] Error on ${req.method} ${req.url}:`, err);

//   const status = err.status || err.statusCode || 500;

//   // Only expose error details in development
//   const errorMessage = process.env.NODE_ENV === "development" ? err.message : null;

//   res.status(status).render("errors/500", { errorMessage });
// });

app.listen(port, () => {
  console.log(`server is running at ${port}`);
});
