import { isDblueOfficeIntegrationEnabled } from './settings.service';
import { getBookingAppSession } from './dblueOfficeApi.service';

export interface OfficeClosure {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  title: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// Stesso placeholder che c'era hardcoded in DailyDetail.tsx (IS_CLOSED_DAYS) — usato
// finché l'integrazione dblue-office resta disattivata (comportamento invariato).
const FALLBACK_CLOSURES: OfficeClosure[] = [{ start: '2026-11-01', end: '2026-11-01', title: 'Office closed' }];

let cache: { closures: OfficeClosure[]; fetchedAt: number } | null = null;

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Ritorna le chiusure ufficio. Se l'integrazione dblue-office è disattivata, ritorna
 * lo stesso placeholder statico di sempre. Se attiva, sincronizza da dblue-office
 * (le chiusure sono incluse nella risposta di /booking-app/session) con una cache
 * breve condivisa tra utenti — fallback su cache stale se dblue-office non risponde.
 */
export async function getClosures(requesterEmail: string): Promise<OfficeClosure[]> {
  const enabled = await isDblueOfficeIntegrationEnabled();
  if (!enabled) return FALLBACK_CLOSURES;

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.closures;
  }

  try {
    const session = await getBookingAppSession(requesterEmail);
    const closures = session.closures.map((c) => ({
      start: toDateOnly(c.start),
      end: toDateOnly(c.end),
      title: c.title,
    }));
    cache = { closures, fetchedAt: Date.now() };
    return closures;
  } catch (err) {
    if (cache) {
      console.warn(`[dblue-office] refresh chiusure fallito, uso cache stale: ${(err as Error).message}`);
      return cache.closures;
    }
    console.warn(`[dblue-office] chiusure non disponibili, nessuna cache pregressa: ${(err as Error).message}`);
    return FALLBACK_CLOSURES;
  }
}
