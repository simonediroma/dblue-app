import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { IUser } from '../models/user.model';
import { bookLab, unbookLab } from '../services/labBooking.service';

const router = Router();
router.use(requireAuth);

function handleError(res: Response, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Errore interno' });
}

router.post('/:date', requireRole('lab_responsible', 'owner'), async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const { date } = req.params as { date: string };
  try {
    const result = await bookLab(date, {
      _id: user._id as Types.ObjectId,
      role: user.role,
      name: user.name,
      dblueOfficeRooms: user.dblueOfficeRooms,
    });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:date', requireRole('lab_responsible', 'owner'), async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params as { date: string };
  try {
    const result = await unbookLab(date);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
