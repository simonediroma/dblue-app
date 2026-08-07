import { DEV_ACCOUNTS } from '../routes/auth.routes';
import {
  getBookingAppSession,
  getBookingAppSessionUrl,
  getRequestHeaderNames,
  parseDblueOfficeDate,
  DblueOfficeForbiddenError,
  DblueOfficeSessionResponse,
  DblueOfficeUserRoom,
  DblueOfficeRoom,
} from './dblueOfficeApi.service';

export interface DblueOfficeSanityIssue {
  field: string;
  message: string;
}

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
  // Controlli di forma/coerenza sui dati (non sul ruolo) — vuoto se non ci sono
  // problemi o se la chiamata è fallita (niente da controllare in quel caso).
  sanityIssues: DblueOfficeSanityIssue[];
}

function checkRoomShape(room: DblueOfficeUserRoom | DblueOfficeRoom, source: string): DblueOfficeSanityIssue[] {
  const issues: DblueOfficeSanityIssue[] = [];
  const label = room.name?.trim() || room.id || '(senza id)';
  if (!room.id?.trim()) {
    issues.push({ field: `${source}.id`, message: `Una stanza in ${source} non ha id` });
  }
  if (!room.name?.trim()) {
    issues.push({ field: `${source}.name`, message: `Stanza "${room.id}" in ${source} senza nome` });
  }
  if (!(typeof room.capacity === 'number' && room.capacity > 0)) {
    issues.push({ field: `${source}.capacity`, message: `Stanza "${label}" in ${source} ha capacity non valida: ${room.capacity}` });
  }
  if (!room.color?.trim()) {
    issues.push({ field: `${source}.color`, message: `Stanza "${label}" in ${source} senza colore` });
  }
  return issues;
}

function checkClosure(closure: DblueOfficeSessionResponse['closures'][number]): DblueOfficeSanityIssue[] {
  const issues: DblueOfficeSanityIssue[] = [];
  const label = closure.title?.trim() || closure._id || '(senza titolo)';
  const start = parseDblueOfficeDate(closure.start);
  const end = parseDblueOfficeDate(closure.end);
  if (!start) {
    issues.push({ field: 'closures.start', message: `Chiusura "${label}" ha start non valido (atteso DD-MM-YYYY): "${closure.start}"` });
  }
  if (!end) {
    issues.push({ field: 'closures.end', message: `Chiusura "${label}" ha end non valido (atteso DD-MM-YYYY): "${closure.end}"` });
  }
  if (start && end && start > end) {
    issues.push({ field: 'closures', message: `Chiusura "${label}" ha start (${closure.start}) dopo end (${closure.end})` });
  }
  return issues;
}

/**
 * Controlli di coerenza/forma sui dati stanze/categorie/chiusure di una sessione —
 * indipendenti dal confronto ruolo atteso/ricevuto. Non sa nulla di "giusto" nel
 * senso di business (non sappiamo quante stanze dovrebbero esserci), solo di
 * strutturalmente sano: campi obbligatori presenti, riferimenti incrociati validi.
 */
function checkSessionSanity(session: DblueOfficeSessionResponse): DblueOfficeSanityIssue[] {
  const issues: DblueOfficeSanityIssue[] = [];

  for (const room of session.userRoomList) issues.push(...checkRoomShape(room, 'userRoomList'));
  for (const room of session.allRooms) issues.push(...checkRoomShape(room, 'allRooms'));
  for (const closure of session.closures) issues.push(...checkClosure(closure));

  const hasAnyRoom = session.userRoomList.length > 0 || session.allRooms.length > 0;
  if (session.roomCategories.length === 0 && hasAnyRoom) {
    issues.push({ field: 'roomCategories', message: 'Nessuna categoria stanza restituita, ma esistono stanze che le referenziano' });
  }

  // Riferimenti incrociati: ogni stanza deve puntare a una categoria realmente
  // presente in roomCategories (allRooms usa "category", userRoomList usa "space"
  // — stesso concetto, nomi diversi nella doc dblue-office).
  const categoryIds = new Set(session.roomCategories.map((c) => c.id));
  for (const room of session.allRooms) {
    if (room.category && !categoryIds.has(room.category)) {
      issues.push({
        field: 'allRooms.category',
        message: `Stanza "${room.name}" referenzia la categoria "${room.category}", assente da roomCategories`,
      });
    }
  }
  for (const room of session.userRoomList) {
    if (room.space && !categoryIds.has(room.space)) {
      issues.push({
        field: 'userRoomList.space',
        message: `Stanza "${room.name}" referenzia lo spazio "${room.space}", assente da roomCategories`,
      });
    }
  }

  // Ogni stanza visibile all'utente dovrebbe esistere anche nel catalogo completo.
  const allRoomIds = new Set(session.allRooms.map((r) => r.id));
  for (const room of session.userRoomList) {
    if (!allRoomIds.has(room.id)) {
      issues.push({
        field: 'userRoomList',
        message: `Stanza "${room.name}" (${room.id}) presente in userRoomList ma assente da allRooms`,
      });
    }
  }

  return issues;
}

/**
 * Chiama /booking-app/session per ciascuno dei 6 DEV_ACCOUNTS e confronta il
 * booking_app_role ricevuto con quello atteso (vedi tabella nel piano/richiesta
 * a Natalia), più un controllo di coerenza sui dati stanze/categorie/chiusure —
 * diagnostica pura, chiama sempre l'API reale indipendentemente dal flag
 * dblueOfficeIntegrationEnabled (va usata anche PRIMA di accenderlo, per validare
 * i dati senza impattare utenti reali).
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
          sanityIssues: checkSessionSanity(session),
        };
      } catch (err) {
        return {
          email: account.email,
          expectedRole: account.role,
          compliant: false,
          url,
          requestHeaders,
          sanityIssues: [],
          error:
            err instanceof DblueOfficeForbiddenError
              ? `Accesso negato: ${err.message}`
              : (err as Error).message,
        };
      }
    })
  );
}
