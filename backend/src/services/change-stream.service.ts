import { WorkingStatus as WorkingStatusModel } from '../models/working-status.model';
import { getPresenceBreakdown } from './capacity.service';
import { broadcastToDate } from './websocket.service';

export async function startChangeStream(): Promise<void> {
  const changeStream = WorkingStatusModel.watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }],
    { fullDocument: 'updateLookup' }
  );

  changeStream.on('change', async (change) => {
    const doc = (change as any).fullDocument;
    if (!doc?.date) return;

    const date = doc.date as string;

    try {
      await broadcastToDate(date, (role) => getPresenceBreakdown(date, role));
    } catch (err) {
      console.error('[ChangeStream] Errore broadcast:', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error('[ChangeStream] Errore stream:', err);
  });

  console.log('[ChangeStream] Avviato su collezione WorkingStatus');
}
