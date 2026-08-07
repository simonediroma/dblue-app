import { DEV_ACCOUNTS } from '../routes/auth.routes';
import {
  getBookingAppSession,
  getBookingAppSessionUrl,
  getRequestHeaderNames,
  DblueOfficeForbiddenError,
  DblueOfficeSessionResponse,
} from './dblueOfficeApi.service';

export interface DblueOfficeComplianceResult {
  email: string;
  expectedRole: string;
  actualRole?: string;
  compliant: boolean;
  error?: string;
  // Diagnostica della chiamata effettuata — mai il valore degli header (es. la API
  // key), solo l'URL esatto e i NOMI degli header HTTP inviati.
  url?: string;
  requestHeaders: string[];
  // Corpo completo della risposta, così com'è arrivato da dblue-office — assente
  // se la chiamata è fallita (vedi error). Esplorabile dal pannello frontend.
  rawResponse?: DblueOfficeSessionResponse;
}

/**
 * Chiama /booking-app/session per ciascuno dei 6 DEV_ACCOUNTS e confronta il
 * booking_app_role ricevuto con quello atteso (vedi tabella nel piano/richiesta
 * a Natalia) — diagnostica pura, chiama sempre l'API reale indipendentemente dal
 * flag dblueOfficeIntegrationEnabled (va usata anche PRIMA di accenderlo, per
 * validare la mappatura ruoli senza impattare utenti reali).
 */
export async function checkDevAccountsCompliance(): Promise<DblueOfficeComplianceResult[]> {
  const requestHeaders = getRequestHeaderNames();

  return Promise.all(
    DEV_ACCOUNTS.map(async (account): Promise<DblueOfficeComplianceResult> => {
      // Calcolato a parte dalla chiamata vera: se DBLUE_OFFICE_API_URL non è
      // configurato, url resta undefined e l'errore sotto lo spiega comunque.
      let url: string | undefined;
      try {
        url = getBookingAppSessionUrl(account.email);
        const session = await getBookingAppSession(account.email);
        const actualRole = session.user.booking_app_role;
        return {
          email: account.email,
          expectedRole: account.role,
          actualRole,
          compliant: actualRole === account.role,
          url,
          requestHeaders,
          rawResponse: session,
        };
      } catch (err) {
        return {
          email: account.email,
          expectedRole: account.role,
          compliant: false,
          url,
          requestHeaders,
          error:
            err instanceof DblueOfficeForbiddenError
              ? `Accesso negato: ${err.message}`
              : (err as Error).message,
        };
      }
    })
  );
}
