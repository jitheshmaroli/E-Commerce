const passport = require("passport");
const User = require("./models/user");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const bcrypt = require("bcrypt");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      passReqToCallback: true,
    },

    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.email });

        if (!user) {
          user = await new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: await bcrypt.hash(Math.random().toString(36), 12), // random pw
            isVerified: true,
          }).save();
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  try {
    const user = await User.findOne({ email });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
