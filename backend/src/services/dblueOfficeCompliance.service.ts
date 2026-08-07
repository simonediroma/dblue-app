import { DEV_ACCOUNTS } from '../routes/auth.routes';
import { getBookingAppSession, DblueOfficeForbiddenError } from './dblueOfficeApi.service';

export interface DblueOfficeComplianceResult {
  email: string;
  expectedRole: string;
  actualRole?: string;
  compliant: boolean;
  error?: string;
}

/**
 * Chiama /booking-app/session per ciascuno dei 6 DEV_ACCOUNTS e confronta il
 * booking_app_role ricevuto con quello atteso (vedi tabella nel piano/richiesta
 * a Natalia) — diagnostica pura, chiama sempre l'API reale indipendentemente dal
 * flag dblueOfficeIntegrationEnabled (va usata anche PRIMA di accenderlo, per
 * validare la mappatura ruoli senza impattare utenti reali).
 */
export async function checkDevAccountsCompliance(): Promise<DblueOfficeComplianceResult[]> {
  return Promise.all(
    DEV_ACCOUNTS.map(async (account): Promise<DblueOfficeComplianceResult> => {
      try {
        const session = await getBookingAppSession(account.email);
        const actualRole = session.user.booking_app_role;
        return {
          email: account.email,
          expectedRole: account.role,
          actualRole,
          compliant: actualRole === account.role,
        };
      } catch (err) {
        return {
          email: account.email,
          expectedRole: account.role,
          compliant: false,
          error:
            err instanceof DblueOfficeForbiddenError
              ? `Accesso negato: ${err.message}`
              : (err as Error).message,
        };
      }
    })
  );
}
