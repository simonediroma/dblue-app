import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { User } from '../models/user.model';
import { WorkingStatus } from '../models/working-status.model';
import { DEV_ACCOUNTS } from './auth.routes';

/**
 * Test-only setup endpoints for the Playwright CSV-coverage suite (e2e/).
 * Used to reach states the real UI/API can't produce on demand (full office
 * capacity, a "fresh" onboarding account, the nightly auto-confirm cron) —
 * assertions in the tests themselves always go through the real UI/API.
 * Gated exactly like /auth/dev-login: disabled unless ENABLE_DEV_LOGIN is set.
 */
const router = Router();

router.use((_req: Request, res: Response, next): void => {
  if (!process.env.ENABLE_DEV_LOGIN) {
    res.status(404).end();
    return;
  }
  next();
});
router.use(requireAuth);
router.use(requireRole('owner'));

function handleError(res: Response, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Errore interno' });
}

const DEV_EMAILS = DEV_ACCOUNTS.map((a) => a.email);

// POST /admin/test/fill-capacity — occupa N posti reali con utenti seedati (non dev-login)
router.post('/fill-capacity', async (req: Request, res: Response): Promise<void> => {
  const { date, seatsToFill } = req.body as { date?: string; seatsToFill?: number };
  if (!date || !Number.isInteger(seatsToFill) || (seatsToFill as number) < 0) {
    res.status(400).json({ error: 'date e seatsToFill (intero >= 0) richiesti' });
    return;
  }
  try {
    const users = await User.find({ email: { $nin: DEV_EMAILS } })
      .limit(seatsToFill as number)
      .select('_id')
      .lean();
    if (users.length < (seatsToFill as number)) {
      res.status(400).json({
        error: `Utenti seedati insufficienti: richiesti ${seatsToFill}, trovati ${users.length}`,
      });
      return;
    }
    const userIds = users.map((u) => String(u._id));
    await Promise.all(
      userIds.map((userId) =>
        WorkingStatus.findOneAndUpdate(
          { userId, date },
          { $set: { status: 'in_office', isConfirmed: true, isUsingDesk: true, isSeeded: true } },
          { upsert: true, setDefaultsOnInsert: true }
        )
      )
    );
    res.json({ ok: true, date, userIds });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /admin/test/clear-capacity — teardown: libera i posti occupati da fill-capacity per quella data
router.post('/clear-capacity', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.body as { date?: string };
  if (!date) {
    res.status(400).json({ error: 'date richiesta' });
    return;
  }
  try {
    const result = await WorkingStatus.updateMany(
      { date, isSeeded: true },
      { $set: { status: 'pending', isConfirmed: false, isUsingDesk: false, isSeeded: false } }
    );
    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /admin/test/reset-onboarding — forza onboardingCompleted:false su un account dev-login esistente
router.post('/reset-onboarding', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !DEV_EMAILS.includes(email)) {
    res.status(400).json({ error: `email deve essere uno dei DEV_ACCOUNTS: ${DEV_EMAILS.join(', ')}` });
    return;
  }
  try {
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: { onboardingCompleted: false } },
      { new: true }
    ).select('email onboardingCompleted');
    if (!updated) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({ ok: true, email: updated.email, onboardingCompleted: updated.onboardingCompleted });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /admin/test/reset-status — elimina il WorkingStatus di un account dev-login per una
// data, così più spec file possono riusare gli stessi 6 account dev-login per "oggi" senza
// collisioni cross-file (workers:1 esegue i file in sequenza, non in isolamento tra loro).
router.post('/reset-status', async (req: Request, res: Response): Promise<void> => {
  const { email, date } = req.body as { email?: string; date?: string };
  if (!email || !DEV_EMAILS.includes(email)) {
    res.status(400).json({ error: `email deve essere uno dei DEV_ACCOUNTS: ${DEV_EMAILS.join(', ')}` });
    return;
  }
  if (!date) {
    res.status(400).json({ error: 'date richiesta' });
    return;
  }
  try {
    const user = await User.findOne({ email }).select('_id').lean();
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    const result = await WorkingStatus.deleteOne({ userId: user._id, date });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /admin/test/simulate-confirm — replica il $set del cron notturno (scheduler.ts autoConfirmStatuses)
router.post('/simulate-confirm', async (req: Request, res: Response): Promise<void> => {
  const { userId, date } = req.body as { userId?: string; date?: string };
  if (!userId || !Types.ObjectId.isValid(userId) || !date) {
    res.status(400).json({ error: 'userId (ObjectId valido) e date richiesti' });
    return;
  }
  try {
    const result = await WorkingStatus.findOneAndUpdate(
      { userId, date, status: { $in: ['mission', 'leave', 'sick', 'parental_leave'] } },
      { $set: { isConfirmed: true, confirmedAt: new Date() } },
      { new: true }
    );
    if (!result) {
      res.status(404).json({
        error: 'Nessun record mission/leave/sick/parental_leave non confermato trovato per userId+date',
      });
      return;
    }
    res.json({ ok: true, status: result.status, isConfirmed: result.isConfirmed });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
