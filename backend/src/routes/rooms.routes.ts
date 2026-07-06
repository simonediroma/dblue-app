import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { Room, IRoom } from '../models/room.model';
import { WorkingStatus } from '../models/working-status.model';
import { IUser } from '../models/user.model';
import { reallocateSeededBookings } from '../services/reallocation.service';

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
    'id name capacity type color'
  );
  res.json(rooms);
});

router.post('/', requireAuth, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const { name, capacity, type, color } = req.body as Pick<IRoom, 'name' | 'capacity' | 'type' | 'color'>;
  const room = await Room.create({ name, capacity, type, color, createdBy: user._id });
  res.status(201).json(room);
});

router.patch('/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  const { name, capacity, color, isActive } = req.body as Partial<Pick<IRoom, 'name' | 'capacity' | 'color' | 'isActive'>>;

  if (isActive === false) {
    const room = await Room.findById(req.params.id).lean();
    if (room) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const count = await WorkingStatus.countDocuments({
        date: { $gt: todayStr },
        status: { $in: ['in_office', 'waiting_list', 'office_no_desk'] },
        room: room.name,
      });
      if (count > 0) {
        res.status(409).json({ error: 'Room con prenotazioni attive', count });
        return;
      }
    }
  }

  const patch: Partial<IRoom> = {};
  if (name !== undefined) patch.name = name;
  if (capacity !== undefined) patch.capacity = capacity;
  if (color !== undefined) patch.color = color;
  if (isActive !== undefined) patch.isActive = isActive;

  const updated = await Room.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!updated) {
    res.status(404).json({ error: 'Room non trovata' });
    return;
  }

  if (capacity !== undefined && updated.type === 'open_space') {
    reallocateSeededBookings().catch((err) =>
      console.error('reallocateSeededBookings error:', err)
    );
  }

  res.json(updated);
});

router.delete('/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  const room = await Room.findById(req.params.id).lean();
  if (room) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const count = await WorkingStatus.countDocuments({
      date: { $gt: todayStr },
      status: { $in: ['in_office', 'waiting_list', 'office_no_desk'] },
      room: room.name,
    });
    if (count > 0) {
      res.status(409).json({ error: 'Room con prenotazioni attive', count });
      return;
    }
  }
  const updated = await Room.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!updated) {
    res.status(404).json({ error: 'Room non trovata' });
    return;
  }
  res.json(updated);
});

export default router;
