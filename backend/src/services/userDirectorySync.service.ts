import { User, IUser } from '../models/user.model';
import { isDblueOfficeIntegrationEnabled } from './settings.service';
import { getBookingAppUserList, DblueOfficeBookingAppRole } from './dblueOfficeApi.service';

// La directory cambia raramente — evita di richiamare dblue-office a ogni apertura
// del picker teammates (Profile.tsx la refetcha a ogni mount della vista).
const CACHE_TTL_MS = 30 * 60 * 1000;

let lastSyncedAt = 0;

const ROLE_MAP: Record<DblueOfficeBookingAppRole, IUser['role']> = {
  employee: 'employee',
  lab_responsible: 'lab_responsible',
  admin_member: 'admin_member',
  director: 'director',
  owner: 'owner',
};

/**
 * Se l'integrazione dblue-office è attiva, sincronizza la directory completa nella
 * collezione User locale — crea un record "ombra" (googleId sintetico, mai loggato
 * via OAuth) per ogni utente della directory ancora sconosciuto localmente, e
 * riallinea nome/ruolo/avatar per chi esiste già. Campi locali-only (teammates,
 * preferences, onboardingCompleted) non vengono mai toccati.
 *
 * No-op se il flag è OFF, se l'ultima sync è più recente del TTL, o se dblue-office
 * non risponde (la directory locale resta quella dell'ultima sync riuscita — mai un
 * hard-fail, `GET /users` serve comunque i dati locali).
 */
export async function syncUserDirectoryIfEnabled(requesterEmail: string): Promise<void> {
  const enabled = await isDblueOfficeIntegrationEnabled();
  if (!enabled) return;
  if (Date.now() - lastSyncedAt < CACHE_TTL_MS) return;

  let directory;
  try {
    directory = await getBookingAppUserList(requesterEmail);
  } catch (err) {
    console.warn(`[dblue-office] sync directory fallita, uso i dati locali esistenti: ${(err as Error).message}`);
    return;
  }

  await Promise.all(
    directory.users.map((u) =>
      User.findOneAndUpdate(
        { email: u.email.toLowerCase() },
        {
          $setOnInsert: { googleId: `dblue-office:${u._id}` },
          $set: {
            name: u.name,
            role: ROLE_MAP[u.booking_app_role] ?? 'employee',
            dblueOfficeId: u._id,
            ...(u.image_url ? { avatar: u.image_url } : {}),
          },
        },
        { upsert: true }
      )
    )
  );

  lastSyncedAt = Date.now();
}
