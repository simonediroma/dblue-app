import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { IUser } from '../models/user.model';
import { getClosures } from '../services/closures.service';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const closures = await getClosures(user.email);
  res.json(closures);
});

export default router;
