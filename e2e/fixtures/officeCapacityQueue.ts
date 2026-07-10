import * as fs from 'fs';
import * as path from 'path';
import { restoreOfficeCapacity, type OfficeCapacityRecord } from './testAdmin';

// Real bookings removed by freeOfficeCapacity() during the CURRENT test, restored by
// flushOfficeCapacityQueue() in that same test's test.afterEach — not right after the
// fallback call itself, since the office needs to stay free for the rest of that test's
// interactions with the date (the real booking POST happens later, in confirmRoom(),
// called by the test after selectStatus() returns).
let pending: OfficeCapacityRecord[] = [];

export function queuePendingRestore(records: OfficeCapacityRecord[]): void {
  pending.push(...records);
}

// Called from test.afterEach() in every CSV spec file that can trigger the IN_OFFICE
// fallback. Tries to restore immediately; anything that fails to restore (e.g. a
// transient network error) falls back to the durable, file-backed queue below instead of
// being silently lost — global-teardown.ts retries those at the very end of the run.
export async function flushOfficeCapacityQueue(): Promise<void> {
  const toRestore = pending;
  pending = [];
  if (toRestore.length === 0) return;

  try {
    await restoreOfficeCapacity(toRestore);
  } catch (err) {
    console.error('flushOfficeCapacityQueue: restore failed, deferring to global-teardown:', err);
    queueDurableFallback(toRestore);
  }
}

// Durable, file-backed queue — only used when an immediate per-test restore (above) itself
// fails. global-teardown.ts (its own process/invocation, no access to this module's
// in-memory `pending`) reads and flushes it once at the very end of the run.
const QUEUE_PATH = path.resolve(__dirname, '..', '.office-capacity-restore-queue.json');

function queueDurableFallback(records: OfficeCapacityRecord[]): void {
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
