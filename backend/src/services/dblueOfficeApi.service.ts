// Backend-to-backend client for the dblue-office booking-app API. Never call this
// from the frontend — the API key must stay server-side (per dblue's integration docs).

const DEFAULT_TIMEOUT_MS = 10_000;

export class DblueOfficeBadRequestError extends Error {}
export class DblueOfficeForbiddenError extends Error {}
export class DblueOfficeUnavailableError extends Error {}

export type DblueOfficeBookingAppRole =
  | 'employee'
  | 'lab_responsible'
  | 'admin_member'
  | 'director'
  | 'owner';

export interface DblueOfficeSessionUser {
  dblueOfficeId: string;
  name: string;
  email: string;
  image_url?: string | null;
  mandatory_presence_days: number | null;
  booking_app_role: DblueOfficeBookingAppRole;
}

export interface DblueOfficeUserSpaceAccess {
  label: string;
  value: string;
}

export interface DblueOfficeUserRoom {
  id: string;
  name: string;
  space: string;
  color: string;
  capacity: number;
  reserved: boolean;
  isActive: boolean;
  includeReserved: boolean;
}

export interface DblueOfficeRoom {
  id: string;
  name: string;
  category: string;
  color: string;
  capacity: number;
  reserved: boolean;
  isActive: boolean;
}

export interface DblueOfficeRoomCategory {
  id: string;
  category: string;
  bgcolor: string;
  color: string;
}

export interface DblueOfficeClosure {
  _id: string;
  title: string;
  start: string;
  end: string;
}

export interface DblueOfficeSessionResponse {
  success: true;
  user: DblueOfficeSessionUser;
  userSpaceAccess: DblueOfficeUserSpaceAccess[];
  userRoomList: DblueOfficeUserRoom[];
  allRooms: DblueOfficeRoom[];
  roomCategories: DblueOfficeRoomCategory[];
  closures: DblueOfficeClosure[];
}

export interface DblueOfficeDirectoryUser {
  _id: string;
  name: string;
  email: string;
  space_access: string[];
  role: string;
  status: boolean;
  job_title?: string;
  contract_type?: string;
  contract_percentage: number | null;
  mandatory_presence_days: number | null;
  image_url: string | null;
  booking_app_role: DblueOfficeBookingAppRole;
}

export interface DblueOfficeUserListResponse {
  success: true;
  users: DblueOfficeDirectoryUser[];
}

interface DblueOfficeErrorBody {
  success: false;
  error: string;
  message: string;
}

function getBaseUrl(): string {
  const baseUrl = process.env.DBLUE_OFFICE_API_URL;
  if (!baseUrl) {
    throw new DblueOfficeUnavailableError('DBLUE_OFFICE_API_URL non configurato');
  }
  return baseUrl.replace(/\/+$/, '');
}

function getApiKey(): string {
  const apiKey = process.env.DBLUE_OFFICE_API_KEY;
  if (!apiKey) {
    throw new DblueOfficeUnavailableError('DBLUE_OFFICE_API_KEY non configurato');
  }
  return apiKey;
}

function buildUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

// Nomi (non valori) degli header HTTP effettivamente inviati a ogni richiesta —
// usato per la diagnostica (dblueOfficeCompliance.service.ts), mai per costruire
// gli header reali della fetch qui sotto.
const REQUEST_HEADER_NAMES = ['X-API-Key'];

/** URL esatto che verrebbe chiamato per GET /booking-app/session — solo diagnostica. */
export function getBookingAppSessionUrl(email: string): string {
  return buildUrl('/booking-app/session', { email }).toString();
}

/** URL esatto che verrebbe chiamato per GET /list/booking-app — solo diagnostica. */
export function getBookingAppUserListUrl(requesterEmail: string): string {
  return buildUrl('/list/booking-app', { email: requesterEmail }).toString();
}

/** Nomi degli header HTTP inviati a ogni richiesta — mai i valori (es. la API key). */
export function getRequestHeaderNames(): string[] {
  return [...REQUEST_HEADER_NAMES];
}

async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = buildUrl(path, params);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'X-API-Key': getApiKey() },
      signal: controller.signal,
    });
  } catch (err) {
    throw new DblueOfficeUnavailableError(`Richiesta a dblue-office fallita: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as DblueOfficeErrorBody | null;
    throw new DblueOfficeBadRequestError(body?.message ?? 'Richiesta non valida');
  }
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as DblueOfficeErrorBody | null;
    throw new DblueOfficeForbiddenError(body?.message ?? 'Accesso negato');
  }
  if (!response.ok) {
    throw new DblueOfficeUnavailableError(`dblue-office ha risposto ${response.status}`);
  }

  return (await response.json()) as T;
}

/** GET /booking-app/session — profilo utente, stanze/spazi visibili, catalogo stanze, chiusure. */
export function getBookingAppSession(email: string): Promise<DblueOfficeSessionResponse> {
  return request<DblueOfficeSessionResponse>('/booking-app/session', { email });
}

/** GET /list/booking-app — directory completa utenti (richiede l'email di un utente con accesso booking-app). */
export function getBookingAppUserList(requesterEmail: string): Promise<DblueOfficeUserListResponse> {
  return request<DblueOfficeUserListResponse>('/list/booking-app', { email: requesterEmail });
}
