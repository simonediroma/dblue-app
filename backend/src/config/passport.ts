import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user.model';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email?.endsWith('@dblue.it')) {
          return done(null, false, { message: 'Accesso riservato a @dblue.it' });
        }

        const avatar = profile.photos?.[0]?.value;
        const name = profile.displayName;

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({ googleId: profile.id, email, name, avatar });
        } else {
          user.name = name;
          if (avatar) user.avatar = avatar;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

export default passport;
