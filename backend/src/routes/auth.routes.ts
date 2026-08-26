import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import passport from '../config/passport';
import { signToken } from '../config/jwt';
import { requireAuth } from '../middleware/auth.middleware';
import { User, IUser } from '../models/user.model';
import {
  syncUserFromDblueOfficeIfEnabled,
  DblueOfficeAccessDeniedError,
  DblueOfficeSyncUnavailableError,
} from '../services/userSync.service';
import { isDblueOfficeIntegrationEnabled } from '../services/settings.service';
import { getBookingAppSession, DblueOfficeForbiddenError } from '../services/dblueOfficeApi.service';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Attributes shared by set and clear (clearing a cookie requires the same domain
// it was set with, or the browser won't match it). Set on subdomains of one shared
// root domain (Coolify target, COOKIE_DOMAIN set — e.g. app./api.<root>) only need
// 'lax': SameSite is based on the shared registrable domain, not the exact host, so
// those are already same-site. Without COOKIE_DOMAIN (today's Railway two-service
// setup, unrelated *.up.railway.app domains — a public suffix, so no domain-sharing
// trick is possible there) the cookie is genuinely cross-site and needs 'none' to be
// sent at all.
const COOKIE_ATTRS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (COOKIE_DOMAIN ? 'lax' : isProduction ? 'none' : 'lax') as 'none' | 'lax',
  domain: COOKIE_DOMAIN,
};

function setAuthCookie(res: Response, userId: string): void {
  res.cookie('token', signToken(userId), { ...COOKIE_ATTRS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// Stesso identico try/catch già usato da dev-login qui sotto — estratto perché
// signup e password-login (aggiunti dopo) ne hanno bisogno anche loro.
async function trySyncOrRespondError(user: IUser, res: Response): Promise<boolean> {
  try {
    await syncUserFromDblueOfficeIfEnabled(user);
    return true;
  } catch (err) {
    if (err instanceof DblueOfficeAccessDeniedError) {
      res.status(403).json({ error: err.message });
      return false;
    }
    if (err instanceof DblueOfficeSyncUnavailableError) {
      res.status(503).json({ error: 'Servizio dblue-office non disponibile, riprova più tardi' });
      return false;
    }
    throw err;
  }
}

const googleStrategyAvailable = !!process.env.GOOGLE_CLIENT_ID;

router.get('/google', (req: Request, res: Response, next) => {
  if (!googleStrategyAvailable) {
    res.status(503).json({ error: 'Google OAuth non configurato' });
    return;
  }
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req: Request, res: Response, next) => {
  if (!googleStrategyAvailable) {
    res.redirect(`${process.env.APP_URL ?? '/'}/login?error=oauth_not_configured`);
    return;
  }
  passport.authenticate(
    'google',
    { session: false },
    (err: Error | null, user: IUser | false, info?: { message?: string }) => {
      if (err) return next(err);
      if (!user) {
        // Distingue un accesso negato (dominio/dblue-office 403) da un servizio
        // dblue-office momentaneamente non raggiungibile (nessun sync pregresso da cui
        // procedere) — vedi syncUserFromDblueOfficeIfEnabled in userSync.service.ts.
        const errorCode = info?.message?.startsWith('Servizio dblue-office')
          ? 'service-unavailable'
          : 'unauthorized';
        res.redirect(`${process.env.APP_URL ?? '/'}/login?error=${errorCode}`);
        return;
      }
      setAuthCookie(res, String(user._id));
      res.redirect(`${process.env.APP_URL ?? '/'}`);
    }
  )(req, res, next);
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', COOKIE_ATTRS);
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
    { $setOnInsert: { googleId: `dev-login:${account.email}`, email: account.email, name: account.name, onboardingCompleted: true }, $set: { role: account.role } },
    { upsert: true, new: true }
  );

  // No-op se il flag dblue-office è OFF (default) — stesso comportamento di sempre.
  // Se ON, richiede che questa email esista come identità di test su dblue-office
  // staging (vedi CLAUDE_MEMORY.md / piano) — altrimenti la sync fallisce con 403.
  if (!(await trySyncOrRespondError(user, res))) return;

  setAuthCookie(res, String(user._id));
  res.json({ ok: true });
});

// --- Sign-up con password + sign-in con password ---
// Richiesta esplicita: il sign-up non può essere aperto a chiunque — verifica
// l'email contro dblue-office prima di permettere la creazione dell'account,
// stesso gate già usato per Google OAuth (whitelist locale @dblue.it se il flag
// integrazione è OFF, altrimenti /booking-app/session reale).
const MIN_PASSWORD_LENGTH = 8;

type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: 'not_found' | 'unavailable' };

async function checkDblueOfficeEligibility(email: string): Promise<EligibilityResult> {
  const integrationEnabled = await isDblueOfficeIntegrationEnabled();
  if (!integrationEnabled) {
    return email.endsWith('@dblue.it') ? { eligible: true } : { eligible: false, reason: 'not_found' };
  }
  try {
    await getBookingAppSession(email);
    return { eligible: true };
  } catch (err) {
    if (err instanceof DblueOfficeForbiddenError) return { eligible: false, reason: 'not_found' };
    return { eligible: false, reason: 'unavailable' };
  }
}

function respondNotEligible(res: Response, result: { reason: 'not_found' | 'unavailable' }): void {
  if (result.reason === 'unavailable') {
    res.status(503).json({ error: 'Servizio non disponibile, riprova più tardi' });
  } else {
    res.status(403).json({ error: 'Email non trovata — contatta il tuo amministratore' });
  }
}

// Step 1 del sign-up: solo verifica l'idoneità dell'email, non crea nulla — permette
// al frontend di mostrare l'esito prima di far scegliere una password.
router.post('/signup-check', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: 'Email richiesta' });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail }).select('+passwordHash').lean();
  if (existing?.passwordHash) {
    res.status(409).json({ error: 'Esiste già un account per questa email — accedi invece di registrarti' });
    return;
  }

  const result = await checkDblueOfficeEligibility(normalizedEmail);
  if (!result.eligible) {
    respondNotEligible(res, result);
    return;
  }
  res.json({ ok: true });
});

// Step 2: ri-verifica l'idoneità (non ci si fida dello step 1 da solo) e crea/aggiorna
// l'account. Se esiste già un record "ombra" per questa email (sync directory o mai
// loggato via Google) gli si aggiunge solo la password, senza toccare gli altri campi.
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email e password richieste' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri` });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail }).select('+passwordHash').lean();
  if (existing?.passwordHash) {
    res.status(409).json({ error: 'Esiste già un account per questa email' });
    return;
  }

  const result = await checkDblueOfficeEligibility(normalizedEmail);
  if (!result.eligible) {
    respondNotEligible(res, result);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: { googleId: `password-signup:${normalizedEmail}`, name: normalizedEmail.split('@')[0] },
      $set: { passwordHash },
    },
    { upsert: true, new: true }
  );

  if (!(await trySyncOrRespondError(user, res))) return;

  setAuthCookie(res, String(user._id));
  res.json({ ok: true });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email e password richieste' });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  const valid = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: 'Email o password non validi' });
    return;
  }

  if (!(await trySyncOrRespondError(user, res))) return;

  setAuthCookie(res, String(user._id));
  res.json({ ok: true });
});

export default router;
