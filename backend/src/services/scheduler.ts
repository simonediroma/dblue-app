import cron from 'node-cron';
import { WorkingStatus } from '../models/working-status.model';

async function autoConfirmStatuses(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await WorkingStatus.updateMany(
    {
      date: today,
      status: { $in: ['mission', 'leave', 'sick', 'parental_leave', 'long_term_leave'] },
      isConfirmed: false,
    },
    { $set: { isConfirmed: true, confirmedAt: new Date() } }
  );
  console.log(`[scheduler] auto-confirm: ${result.modifiedCount} record confermati per ${today}`);
}

export function startScheduler(): void {
  cron.schedule('59 23 * * *', () => {
    autoConfirmStatuses().catch((err) => {
      console.error('[scheduler] errore auto-confirm:', err);
    });
  });
  console.log('✓ Scheduler avviato');
}
