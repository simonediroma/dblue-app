import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import { signToken } from '../config/jwt';
import { requireAuth } from '../middleware/auth.middleware';
import { User, IUser } from '../models/user.model';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAuthCookie(res: Response, userId: string): void {
  res.cookie('token', signToken(userId), COOKIE_OPTIONS);
}

const googleStrategyAvailable = !!process.env.GOOGLE_CLIENT_ID;

router.get('/google', (req: Request, res: Response, next) => {
  if (!googleStrategyAvailable) {
    res.status(503).json({ error: 'Google OAuth non configurato' });
    return;
  }
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req: Request, res: Response, next) => {
    if (!googleStrategyAvailable) {
      res.redirect(`${process.env.APP_URL ?? '/'}/login?error=oauth_not_configured`);
      return;
    }
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${process.env.APP_URL}/login?error=unauthorized`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as IUser;
    const token = signToken(String(user._id));
    setAuthCookie(res, String(user._id));
    res.redirect(`${process.env.APP_URL ?? '/'}?token=${token}`);
  }
);

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logout effettuato' });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = req.user as IUser;
  res.json({
    id: user._id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    teammates: user.teammates,
    contract: user.contract,
    preferences: user.preferences,
    onboardingCompleted: user.onboardingCompleted,
  });
});

export const DEV_ACCOUNTS: { email: string; name: string; role: IUser['role'] }[] = [
  { email: 'dev@dblue.it',            name: 'Dev User',        role: 'owner' },
  { email: 'mario.rossi@dblue.it',    name: 'Mario Rossi',     role: 'employee' },
  { email: 'sara.ferrari@dblue.it',   name: 'Sara Ferrari',    role: 'lab_responsible' },
  { email: 'luca.esposito@dblue.it',  name: 'Luca Esposito',   role: 'admin_member' },
  { email: 'giulia.bianchi@dblue.it', name: 'Giulia Bianchi',  role: 'director' },
  { email: 'marco.conti@dblue.it',    name: 'Marco Conti',     role: 'owner' },
];

router.post('/dev-login', async (req: Request, res: Response): Promise<void> => {
  if (!process.env.ENABLE_DEV_LOGIN) {
    res.status(404).end();
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  const account = DEV_ACCOUNTS.find(a => a.email === username);
  if (!username || !password || !account || password !== process.env.DEV_LOGIN_PASS) {
    res.status(401).json({ error: 'Credenziali non valide' });
    return;
  }

  const user = await User.findOneAndUpdate(
    { email: account.email },
    { $setOnInsert: { googleId: `dev-login:${account.email}`, email: account.email, name: account.name }, $set: { role: account.role } },
    { upsert: true, new: true }
  );

  const token = signToken(String(user._id));
  setAuthCookie(res, String(user._id));
  res.json({ ok: true, token });
});

export default router;
