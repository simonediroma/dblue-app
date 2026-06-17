import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { Room, IRoom } from '../models/room.model';
import { IUser } from '../models/user.model';

const router = Router();

const ROOM_TYPES_BY_ROLE: Record<IUser['role'], IRoom['type'][]> = {
  employee: ['open_space'],
  lab_responsible: ['open_space', 'lab'],
  admin_member: ['open_space', 'admin'],
  director: ['open_space', 'management'],
  owner: ['open_space', 'lab', 'admin', 'management'],
};

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const allowedTypes = ROOM_TYPES_BY_ROLE[user.role];
  const rooms = await Room.find({ isActive: true, type: { $in: allowedTypes } }).select(
    'id name capacity type'
  );
  res.json(rooms);
});

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Permesso negato' });
    return;
  }
  const { name, capacity, type } = req.body as Pick<IRoom, 'name' | 'capacity' | 'type'>;
  const room = await Room.create({ name, capacity, type, createdBy: user._id });
  res.status(201).json(room);
});

router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Permesso negato' });
    return;
  }

  const { name, capacity, isActive } = req.body as Partial<Pick<IRoom, 'name' | 'capacity' | 'isActive'>>;

  if (isActive === false) {
    // TODO M3: check for active future bookings before deactivating
    // const bookingCount = await Booking.countDocuments({ roomId: req.params.id, date: { $gte: new Date() } });
    // if (bookingCount > 0) { res.status(409).json({ error: 'Room con prenotazioni attive', count: bookingCount }); return; }
  }

  const patch: Partial<IRoom> = {};
  if (name !== undefined) patch.name = name;
  if (capacity !== undefined) patch.capacity = capacity;
  if (isActive !== undefined) patch.isActive = isActive;

  const updated = await Room.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!updated) {
    res.status(404).json({ error: 'Room non trovata' });
    return;
  }
  res.json(updated);
});

router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Permesso negato' });
    return;
  }
  // TODO M3: check for active future bookings before deactivating
  const updated = await Room.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!updated) {
    res.status(404).json({ error: 'Room non trovata' });
    return;
  }
  res.json(updated);
});

export default router;
