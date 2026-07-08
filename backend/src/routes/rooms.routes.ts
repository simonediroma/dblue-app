import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { Room, IRoom } from '../models/room.model';
import { WorkingStatus } from '../models/working-status.model';
import { IUser } from '../models/user.model';
import { reallocateSeededBookings } from '../services/reallocation.service';
import { getVisibleRooms } from '../services/capacity.service';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const rooms = await getVisibleRooms(user.role);
  res.json(
    rooms.map((r) => ({
      id: r._id,
      name: r.name,
      capacity: r.capacity,
      type: r.type,
      color: r.color,
      visibleRoles: r.visibleRoles,
    }))
  );
});

router.post('/', requireAuth, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  const user = req.user as IUser;
  const { name, capacity, type, color, visibleRoles } = req.body as Pick<
    IRoom,
    'name' | 'capacity' | 'type' | 'color' | 'visibleRoles'
  >;
  const room = await Room.create({ name, capacity, type, color, visibleRoles, createdBy: user._id });
  res.status(201).json(room);
});

router.patch('/:id', requireAuth, requireRole('owner'), async (req: Request, res: Response): Promise<void> => {
  const { name, capacity, color, isActive, visibleRoles } = req.body as Partial<
    Pick<IRoom, 'name' | 'capacity' | 'color' | 'isActive' | 'visibleRoles'>
  >;

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
  if (visibleRoles !== undefined) patch.visibleRoles = visibleRoles;

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
