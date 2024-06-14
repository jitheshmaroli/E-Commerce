const passport = require("passport");
const User = require("./models/user");
const GoogleStrategy = require("passport-google-oauth2").Strategy;

passport.use(
  new GoogleStrategy(
    {
      // eslint-disable-next-line no-undef
      clientID: process.env.GOOGLE_CLIENT_ID,
      // eslint-disable-next-line no-undef
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      passReqToCallback: true,
    },

    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.email });

        if (!user) {
          user = new User({
            name: profile.displayName,
            email: profile.email,
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        console.error("Error during Google authentication:", error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, { userId: user.email, isUserAuthenticated: true });
});

passport.deserializeUser(async (serializeUser, done) => {
  try {
    const user = await User.findOne(serializeUser.email);
    done(null, user);
  } catch (error) {
    console.error("Error deserializing user:", error);
    done(error);
  }
});

module.exports = passport;
