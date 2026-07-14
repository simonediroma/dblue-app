import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { User, IUser } from '../models/user.model';
import { retrofitStatus } from '../services/working-status.service';
import { getMonthlyStats } from '../services/stats.service';
import { runSeed } from '../services/seed.service';

const router = Router();
router.use(requireAuth);

function handleError(res: Response, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Errore interno' });
}

// POST /admin/retrofit/:userId/:date — Director/Owner corregge status mese precedente
router.post(
  '/retrofit/:userId/:date',
  requireRole('director', 'owner'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, date } = req.params;
    const { status, offTime } = req.body as {
      status: string;
      offTime?: { type: 'morning' | 'afternoon' | 'custom'; hours?: number };
    };

    if (!status) {
      res.status(400).json({ error: 'status richiesto' });
      return;
    }

    if (!Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'userId non valido' });
      return;
    }

    const targetUser = await User.findById(userId).lean();
    if (!targetUser) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    try {
      const result = await retrofitStatus(new Types.ObjectId(userId), date, { status, offTime });
      res.json({ ...result.toObject(), retrofittedBy: (req.user as IUser)._id });
    } catch (err) {
      handleError(res, err);
    }
  }
);

// GET /admin/users — lista completa utenti (Director/Owner)
router.get(
  '/users',
  requireRole('director', 'owner'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await User.find({})
        .select('name email role avatar onboardingCompleted contract.presenceDaysTarget')
        .lean();
      res.json(
        users.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar,
          onboardingCompleted: u.onboardingCompleted,
          contract: u.contract,
        }))
      );
    } catch (err) {
      handleError(res, err);
    }
  }
);

// PATCH /admin/users/:userId/role — cambia ruolo (Owner only)
router.patch(
  '/users/:userId/role',
  requireRole('owner'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { role } = req.body as { role: IUser['role'] };

    const validRoles: IUser['role'][] = [
      'employee',
      'lab_responsible',
      'admin_member',
      'director',
      'owner',
    ];

    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: `Ruolo non valido. Valori accettati: ${validRoles.join(', ')}` });
      return;
    }

    if (!Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'userId non valido' });
      return;
    }

    const requesterId = ((req.user as IUser)._id as Types.ObjectId).toString();
    if (requesterId === userId) {
      res.status(400).json({ error: 'Non puoi cambiare il tuo stesso ruolo' });
      return;
    }

    try {
      const updated = await User.findByIdAndUpdate(
        userId,
        { $set: { role } },
        { new: true }
      ).select('name email role');
      if (!updated) {
        res.status(404).json({ error: 'Utente non trovato' });
        return;
      }
      res.json(updated);
    } catch (err) {
      handleError(res, err);
    }
  }
);

// GET /admin/stats/:userId/monthly — Director/Owner, stats mensili per singolo utente
router.get(
  '/stats/:userId/monthly',
  requireRole('director', 'owner'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId: targetUserId } = req.params;
    const { month } = req.query as { month?: string };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Parametro month richiesto (YYYY-MM)' });
      return;
    }
    if (!Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ error: 'userId non valido' });
      return;
    }
    try {
      const stats = await getMonthlyStats(targetUserId, month);
      res.json(stats);
    } catch (err) {
      handleError(res, err);
    }
  }
);

// POST /admin/seed — Owner only, popola il DB con dati di test. fresh:true cancella
// User/Room/WorkingStatus prima di ripopolare — gated dietro ENABLE_DEV_LOGIN come
// gli endpoint di admin-test.routes.ts, così un token owner compromesso (o un env
// mal configurato) non può cancellare dati reali in un ambiente di produzione dove
// quel flag non è impostato.
router.post(
  '/seed',
  (_req: Request, res: Response, next): void => {
    if (!process.env.ENABLE_DEV_LOGIN) {
      res.status(404).end();
      return;
    }
    next();
  },
  requireRole('owner'),
  async (req: Request, res: Response): Promise<void> => {
    const { fresh } = req.body as { fresh?: boolean };
    try {
      const summary = await runSeed(fresh === true);
      res.json({ ok: true, summary });
    } catch (err) {
      handleError(res, err);
    }
  }
);

export default router;
