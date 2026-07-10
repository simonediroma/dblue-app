import * as fs from 'fs';
import * as path from 'path';
import type { OfficeCapacityRecord } from './testAdmin';

// Durable, file-backed queue of real bookings removed by freeOfficeCapacity() during the
// run, so global-teardown.ts (which runs as a separate process/invocation from the test
// worker — no shared in-memory state) can restore them once, at the very end of the whole
// suite. Restoring per-test would be wrong: the freed capacity needs to stay free for the
// rest of that same test's interactions with the date, not just the initial booking.
const QUEUE_PATH = path.resolve(__dirname, '..', '.office-capacity-restore-queue.json');

export function queueOfficeCapacityRestore(records: OfficeCapacityRecord[]): void {
  if (records.length === 0) return;
  const existing = readQueue();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify([...existing, ...records]), 'utf-8');
}

export function readQueue(): OfficeCapacityRecord[] {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as OfficeCapacityRecord[];
  } catch {
    return [];
  }
}

export function clearQueue(): void {
  if (fs.existsSync(QUEUE_PATH)) fs.unlinkSync(QUEUE_PATH);
}
