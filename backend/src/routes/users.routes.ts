import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { User, IUser } from '../models/user.model';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const search = req.query.search as string | undefined;
  const filter: Record<string, unknown> = {};
  if (search) {
    filter['$or'] = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  const users = await User.find(filter).select('id name email avatar role');
  res.json(users);
});

router.patch('/me/teammates', async (req: Request, res: Response): Promise<void> => {
  const { teammates } = req.body as { teammates?: unknown };
  if (!Array.isArray(teammates) || teammates.length > 5) {
    res.status(400).json({ error: 'teammates deve essere un array di max 5 elementi' });
    return;
  }

  const ids = teammates as string[];
  const found = await User.find({ _id: { $in: ids } });
  if (found.length !== ids.length) {
    res.status(400).json({ error: 'Uno o più utenti non trovati' });
    return;
  }

  const user = req.user as IUser;
  const updated = await User.findByIdAndUpdate(
    user._id,
    { teammates: ids },
    { new: true, runValidators: true }
  );
  res.json(updated);
});

router.patch('/me/preferences', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const body = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'object' && value !== null) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        updates[`preferences.${key}.${subKey}`] = subValue;
      }
    } else {
      updates[`preferences.${key}`] = value;
    }
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: updates },
    { new: true }
  );
  res.json(updated?.preferences);
});

router.patch('/me/onboarding', async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  await User.findByIdAndUpdate(user._id, { onboardingCompleted: true });
  res.json({ onboardingCompleted: true });
});

export default router;
