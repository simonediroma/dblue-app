import { IUser } from '../models/user.model';
import { isDblueOfficeIntegrationEnabled } from './settings.service';
import { getBookingAppSession, DblueOfficeForbiddenError, DblueOfficeBookingAppRole } from './dblueOfficeApi.service';

export class DblueOfficeAccessDeniedError extends Error {}
export class DblueOfficeSyncUnavailableError extends Error {}

const ROLE_MAP: Record<DblueOfficeBookingAppRole, IUser['role']> = {
  employee: 'employee',
  lab_responsible: 'lab_responsible',
  admin_member: 'admin_member',
  director: 'director',
  owner: 'owner',
};

/**
 * Sincronizza identità/ruolo dell'utente da dblue-office, ma solo se l'integrazione
 * è stata attivata dall'owner (AdminBar). Se disattivata (default), no-op: il login
 * prosegue con i soli dati locali, comportamento identico a prima dell'integrazione.
 *
 * In caso di errore rete/5xx di dblue-office: se l'utente è già stato sincronizzato
 * in passato (ha un dblueOfficeId), si procede con l'ultimo dato locale noto invece
 * di bloccare il login. Si blocca solo chi non è mai stato sincronizzato.
 *
 * `options.force` bypassa il controllo del flag — usato dal seed (`seed.service.ts`),
 * che deve poter allineare ruolo/stanze reali indipendentemente dal fatto che
 * l'integrazione sia accesa per il traffico normale in questo momento.
 */
export async function syncUserFromDblueOfficeIfEnabled(
  user: IUser,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force) {
    const enabled = await isDblueOfficeIntegrationEnabled();
    if (!enabled) return;
  }

  let session;
  try {
    session = await getBookingAppSession(user.email);
  } catch (err) {
    if (err instanceof DblueOfficeForbiddenError) {
      throw new DblueOfficeAccessDeniedError(err.message);
    }
    if (user.dblueOfficeId) {
      console.warn(
        `[dblue-office] sync fallita per ${user.email}, uso ultimo dato noto: ${(err as Error).message}`
      );
      return;
    }
    throw new DblueOfficeSyncUnavailableError((err as Error).message);
  }

  user.dblueOfficeId = session.user.dblueOfficeId;
  user.name = session.user.name;
  if (session.user.image_url) user.avatar = session.user.image_url;
  user.role = ROLE_MAP[session.user.booking_app_role] ?? 'employee';
  if (session.user.mandatory_presence_days != null) {
    user.contract.presenceDaysTarget = session.user.mandatory_presence_days;
  }
  user.dblueOfficeRooms = session.userRoomList
    .filter((r) => r.isActive)
    .map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, color: r.color, category: r.space }));
  user.lastSyncedAt = new Date();
  await user.save();
}
