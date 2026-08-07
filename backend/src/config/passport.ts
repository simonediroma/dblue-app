import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user.model';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';
import {
  syncUserFromDblueOfficeIfEnabled,
  DblueOfficeAccessDeniedError,
  DblueOfficeSyncUnavailableError,
} from '../services/userSync.service';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: 'Email non disponibile dal profilo Google' });
          }

          // Finché l'integrazione dblue-office non è attivata dall'owner (AdminBar),
          // l'app si comporta esattamente come prima: whitelist locale sul dominio.
          // Una volta attiva, l'accesso è deciso da dblue-office (403 di /booking-app/session).
          const integrationEnabled = await isDblueOfficeIntegrationEnabled();
          if (!integrationEnabled && !email.endsWith('@dblue.it')) {
            return done(null, false, { message: 'Accesso riservato a @dblue.it' });
          }

          const avatar = profile.photos?.[0]?.value;
          const name = profile.displayName;

          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            // Potrebbe già esistere un record "ombra" per questa email, creato dalla
            // sync della directory dblue-office (userDirectorySync.service.ts) prima
            // che questa persona avesse mai fatto login — lo reclamiamo assegnandogli
            // il vero googleId invece di provare a crearne uno nuovo, che violerebbe
            // il vincolo unique su email.
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              user.name = name;
              if (avatar) user.avatar = avatar;
              await user.save();
            } else {
              user = await User.create({ googleId: profile.id, email, name, avatar });
            }
          } else {
            user.name = name;
            if (avatar) user.avatar = avatar;
            await user.save();
          }

          await syncUserFromDblueOfficeIfEnabled(user);

          return done(null, user);
        } catch (err) {
          if (err instanceof DblueOfficeAccessDeniedError) {
            return done(null, false, { message: err.message });
          }
          if (err instanceof DblueOfficeSyncUnavailableError) {
            return done(null, false, { message: 'Servizio dblue-office non disponibile, riprova più tardi' });
          }
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
