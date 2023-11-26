const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');
const config = require('../../config/loader');
const domains = config.domains;
const uploadProfilePictureFromURL = require('~/server/services/ProfilePictureCreate');
const { useFirebase } = require('../server/services/firebase');

const googleLogin = async (accessToken, refreshToken, profile, cb) => {
  try {
    const email = profile.emails[0].value;
    const googleId = profile.id;
    const oldUser = await User.findOne({ email });
    const ALLOW_SOCIAL_REGISTRATION =
      process.env.ALLOW_SOCIAL_REGISTRATION?.toLowerCase() === 'true';

    const avatarURL = profile.photos[0].value;

    if (oldUser) {
      oldUser.avatar = avatarURL;
      await oldUser.save();

      if (useFirebase) {
        const userId = oldUser._id;
        const avatarURL = await uploadProfilePictureFromURL(userId, profile.photos[0].value);
        console.log('avatarURL', avatarURL);
        oldUser.avatar = avatarURL;
        await oldUser.save();
      }

      return cb(null, oldUser);
    } else if (ALLOW_SOCIAL_REGISTRATION) {
      const newUser = await new User({
        provider: 'google',
        googleId,
        username: profile.name.givenName,
        email,
        emailVerified: profile.emails[0].verified,
        name: `${profile.name.givenName} ${profile.name.familyName}`,
        avatar: avatarURL,
      }).save();

      if (useFirebase) {
        const userId = newUser._id;
        const avatarURL = await uploadProfilePictureFromURL(userId, profile.photos[0].value);
        console.log('avatarURL', avatarURL);
        newUser.avatar = avatarURL;
        await newUser.save();
      }

      return cb(null, newUser);
    }

    return cb(null, false, { message: 'User not found.' });
  } catch (err) {
    console.error(err);
    return cb(err);
  }
};

module.exports = () =>
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${domains.server}${process.env.GOOGLE_CALLBACK_URL}`,
      proxy: true,
    },
    googleLogin,
  );
