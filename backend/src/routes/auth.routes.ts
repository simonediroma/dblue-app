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

router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.APP_URL}/login?error=unauthorized`,
  }),
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

router.post('/dev-login', async (req: Request, res: Response): Promise<void> => {
  if (!process.env.ENABLE_DEV_LOGIN) {
    res.status(404).end();
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password || username !== process.env.DEV_LOGIN_USER || password !== process.env.DEV_LOGIN_PASS) {
    res.status(401).json({ error: 'Credenziali non valide' });
    return;
  }

  const email = process.env.DEV_LOGIN_USER ?? '';
  const role = (process.env.DEV_LOGIN_ROLE as IUser['role']) ?? 'director';
  const user = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { googleId: 'dev-login', email, name: process.env.DEV_LOGIN_NAME ?? 'Dev User' }, $set: { role } },
    { upsert: true, new: true }
  );

  const token = signToken(String(user._id));
  setAuthCookie(res, String(user._id));
  res.json({ ok: true, token });
});

export default router;
