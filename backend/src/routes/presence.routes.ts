import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getStatusForUser,
  upsertStatus,
  bulkUpsertStatus,
  updateOffTime,
  retrofitStatus,
  getColleaguePresences,
} from '../services/working-status.service';
import { WorkingStatus } from '../models/working-status.model';
import { IUser } from '../models/user.model';
import { Types } from 'mongoose';

const router = Router();
router.use(requireAuth);

function userId(req: Request): Types.ObjectId {
  return (req.user as IUser)._id as Types.ObjectId;
}

function handleError(res: Response, err: unknown): void {
  const e = err as Error & { statusCode?: number };
  res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Errore interno' });
}

// GET /presence?month=YYYY-MM
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const month = req.query.month as string;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Parametro month richiesto (YYYY-MM)' });
    return;
  }
  try {
    const data = await getStatusForUser(userId(req), month);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /presence
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { date, status, isUsingDesk, room } = req.body as {
    date: string;
    status: string;
    isUsingDesk?: boolean;
    room?: string;
  };
  if (!date || !status) {
    res.status(400).json({ error: 'date e status richiesti' });
    return;
  }
  try {
    const result = await upsertStatus(userId(req), date, { status, isUsingDesk, room });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /presence/bulk
router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  const { updates } = req.body as {
    updates: Array<{ date: string; status: string; isUsingDesk?: boolean; room?: string }>;
  };
  if (!Array.isArray(updates)) {
    res.status(400).json({ error: 'updates deve essere un array' });
    return;
  }
  try {
    const result = await bulkUpsertStatus(userId(req), updates);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /presence/:date/offtime
router.get('/:date/offtime', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  try {
    const ws = await WorkingStatus.findOne({ userId: userId(req), date }).lean();
    if (!ws) {
      res.status(404).json({ error: 'Nessun working status trovato per questa data' });
      return;
    }
    res.json({ date, offTime: ws.offTime ?? null });
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /presence/:date/offtime
router.patch('/:date/offtime', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  const { offTime } = req.body as {
    offTime: { type: 'morning' | 'afternoon' | 'custom'; hours?: number } | null;
  };
  try {
    const result = await updateOffTime(userId(req), date, offTime ?? null);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /presence/:date/checkin
router.post('/:date/checkin', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (date !== todayStr) {
    res.status(400).json({ error: 'Il check-in è possibile solo per il giorno corrente' });
    return;
  }

  const ws = await WorkingStatus.findOne({ userId: userId(req), date });
  if (!ws) {
    res.status(404).json({ error: 'Nessuna prenotazione trovata per questa data' });
    return;
  }

  if (ws.status === 'waiting_list') {
    res.status(400).json({ error: 'Sei in waiting list, non puoi fare check-in' });
    return;
  }

  const checkinAllowed = ['in_office', 'office_no_desk', 'remote'];
  if (!checkinAllowed.includes(ws.status)) {
    res.status(400).json({ error: 'Check-in non applicabile per questo status' });
    return;
  }

  const { room, isUsingDesk } = req.body as { room?: string; isUsingDesk?: boolean };
  try {
    const updated = await WorkingStatus.findByIdAndUpdate(
      ws._id,
      {
        $set: {
          isConfirmed: true,
          confirmedAt: new Date(),
          ...(room !== undefined && { room }),
          ...(isUsingDesk !== undefined && { isUsingDesk }),
        },
      },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /presence/:date/offtime
router.delete('/:date/offtime', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  try {
    const result = await updateOffTime(userId(req), date, null);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /presence/:date/colleagues
router.get('/:date/colleagues', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  try {
    const result = await getColleaguePresences(date, userId(req).toString());
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /presence/:date/retrofit
router.post('/:date/retrofit', async (req: Request, res: Response): Promise<void> => {
  const { date } = req.params;
  const { status, offTime } = req.body as {
    status: string;
    offTime?: { type: 'morning' | 'afternoon' | 'custom'; hours?: number };
  };
  if (!status) {
    res.status(400).json({ error: 'status richiesto' });
    return;
  }
  try {
    const result = await retrofitStatus(userId(req), date, { status, offTime });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
