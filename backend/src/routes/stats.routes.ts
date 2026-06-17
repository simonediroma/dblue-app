import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { IUser } from '../models/user.model';
import { getMonthlyStats, getAnnualStats, getAreaStats } from '../services/stats.service';

const router = Router();

router.get('/monthly', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { month } = req.query as { month?: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Parametro month richiesto nel formato YYYY-MM' });
    return;
  }
  const user = req.user as IUser;
  const stats = await getMonthlyStats(user._id.toString(), month);
  res.json(stats);
});

router.get('/annual', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { year } = req.query as { year?: string };
  const yearNum = Number(year);
  if (!year || isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    res.status(400).json({ error: 'Parametro year richiesto e deve essere un numero valido' });
    return;
  }
  const user = req.user as IUser;
  const stats = await getAnnualStats(user._id.toString(), yearNum);
  res.json(stats);
});

router.get(
  '/area',
  requireAuth,
  requireRole('director', 'owner'),
  async (req: Request, res: Response): Promise<void> => {
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Parametro month richiesto nel formato YYYY-MM' });
      return;
    }
    const user = req.user as IUser;
    const stats = await getAreaStats(month, user);
    res.json(stats);
  }
);

export default router;
