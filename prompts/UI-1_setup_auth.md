# UI-1 — Setup Frontend + Copia POC + Auth
> Prerequisito: M1 backend completato e funzionante (GET /health OK, /auth/google configurato).
> Questo prompt copia il prototipo nel frontend e implementa l'autenticazione reale.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO UI-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Portare il prototipo esistente dentro frontend/ e sostituire l'utente hardcoded
con il profilo reale che arriva dal backend via Google OAuth.
Al termine: il login con Google funziona, il nome e il ruolo nell'header
sono quelli dell'utente autenticato, e il logout cancella la sessione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lavora SOLO in frontend/src/.
Non toccare backend/ in questa macro.
Non toccare presence---office-planner/ — è il prototipo originale, sola lettura.
Leggi presence---office-planner/src/ per capire il codice, poi replica/adatta in frontend/src/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Copia il prototipo in frontend/src/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copia i seguenti file da presence---office-planner/src/ a frontend/src/,
mantenendo la struttura delle sottocartelle:

- App.tsx
- main.tsx
- index.css
- types.ts
- constants.tsx (se esiste)
- constants/colleagues.ts
- utils/dateUtils.ts
- components/Layout.tsx
- components/DayCard.tsx
- components/DailyDetail.tsx
- components/Stats.tsx
- components/Profile.tsx
- components/RoomSelection.tsx
- components/SplashScreen.tsx
- components/Organisation.tsx
- components/Onboarding.tsx
- components/Alert.tsx (se esiste)

Dopo la copia verifica che `npm run lint` non abbia errori di import mancanti.
Se ci sono import mancanti (es. librerie non installate), installale:
  npm install motion lucide-react recharts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Sostituisci la data fittizia con quella reale
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/utils/dateUtils.ts

Il prototipo usa una data di riferimento fittizia ('2026-10-09').
Sostituisci la funzione parseAppDate (o il riferimento hardcoded) in modo che
"today" sia sempre `new Date()` formattato come 'YYYY-MM-DD'.

In App.tsx, cerca tutte le occorrenze della stringa hardcoded '2026-10-09'
e sostituiscile con la variabile TODAY calcolata da `new Date()`.
Non modificare i dati INITIAL_DAYS per ora — li sostituiremo in UI-2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Servizio API base
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/services/api.ts

Crea un client HTTP base usando fetch (no axios — mantieni dipendenze minime).

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',  // invia cookie httpOnly con ogni request
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    // Non autenticato — reindirizza al login
    window.location.href = '/login';
    throw new Error('Non autenticato');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
```

Esporta le seguenti funzioni:
- `getMe(): Promise<User>` → GET /auth/me
- `logout(): Promise<void>` → POST /auth/logout
- `getUsers(search?: string): Promise<User[]>` → GET /users?search=...
- `updateTeammates(ids: string[]): Promise<User>` → PATCH /users/me/teammates
- `updatePreferences(prefs: Partial<User['preferences']>): Promise<User>` → PATCH /users/me/preferences
- `completeOnboarding(): Promise<void>` → PATCH /users/me/onboarding

Definisci il tipo `User` in frontend/src/types/api.ts:
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'employee' | 'lab_responsible' | 'admin_member' | 'director' | 'owner';
  teammates: string[];  // array di userId
  contract: { presenceDaysTarget: number };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: { waitingListPromotion: boolean; sickLeaveReminder: boolean };
    accessibility: { reducedMotion: boolean; textSize: 'default' | 'large' };
  };
  onboardingCompleted: boolean;
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — AuthContext
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/context/AuthContext.tsx

```typescript
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}
```

- Al mount chiama getMe(). Se 401 → user = null.
- Mentre carica mostra un loading spinner centrato (non la SplashScreen).
- `logout()` chiama l'API, poi imposta user = null e reindirizza a '/login'.
- Esporta `useAuth()` hook.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Pagina Login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/pages/Login.tsx

Pagina semplice con:
- Logo / titolo "Presence App"
- Pulsante "Accedi con Google" → href={`${VITE_API_URL}/auth/google`}
- Messaggio di errore se query param ?error=unauthorized è presente
  ('Accesso riservato agli utenti @deepblue.it')
- Stile coerente con il design del prototipo (bg-surface, colori brand)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5b — Login alternativo dev nella pagina Login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In frontend/src/pages/Login.tsx, sotto il pulsante Google aggiungi un
form di fallback visibile SOLO se la variabile di build è attiva:

```typescript
const DEV_LOGIN_ENABLED = import.meta.env.VITE_DEV_LOGIN_ENABLED === 'true';
```

Se DEV_LOGIN_ENABLED:
- Mostra un separatore "— oppure —" sotto il pulsante Google
- Form con due input: email e password (type="password")
- Pulsante "Accedi (dev)" che chiama POST /auth/dev-login con le credenziali
- In caso di successo: window.location.href = '/'
- In caso di errore: mostra il messaggio di errore sotto il form
- Stile dimesso e discreto (text-sm, colori muted) — deve essere chiaro
  che non è il login di produzione

Aggiungi in .env (locale dev, non .env.example):
  VITE_DEV_LOGIN_ENABLED=true

In .env.example la variabile deve essere presente ma con valore false:
  VITE_DEV_LOGIN_ENABLED=false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Router e protezione route
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Installa react-router-dom se non già presente.

File: frontend/src/main.tsx

Configura BrowserRouter con due route:
- /login → <Login />
- /* → <ProtectedRoute><App /></ProtectedRoute>

File: frontend/src/components/ProtectedRoute.tsx
- Se loading: mostra spinner.
- Se user === null: reindirizza a /login.
- Altrimenti: renderizza children.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Sostituisci userName e userRole in App.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In App.tsx:
1. Importa `useAuth` da AuthContext.
2. Rimuovi `const [userName] = useState('Roberto')` e `const [userRole] = useState(UserRole.DIRECTOR)`.
3. Sostituisci con: `const { user, logout } = useAuth()`.
4. Dove il codice usa `userName` usa `user?.name ?? ''`.
5. Mappa il ruolo API al tipo del prototipo:

```typescript
function mapRole(apiRole: User['role']): UserRole {
  return apiRole === 'director' || apiRole === 'owner'
    ? UserRole.DIRECTOR
    : UserRole.EMPLOYEE;
}
```
   Usa `mapRole(user?.role ?? 'employee')` dove il codice usa `userRole`.

6. Passa `onLogout={logout}` al componente Layout (o Profile) dove serve il pulsante logout.
   Aggiungi la prop a Layout/Profile senza modificare la logica interna esistente —
   solo aggiunta prop + button in Profile che chiama onLogout.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — SplashScreen: mostrala solo al primo accesso
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Attualmente la SplashScreen compare sempre. Mostrala solo se l'utente
non ha già completato l'onboarding (`!user.onboardingCompleted`).
Allo stesso modo, mostra l'Onboarding solo se `!user.onboardingCompleted`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE UI-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. `npm run lint` → zero errori TypeScript
2. `npm run dev` → Vite avvia senza errori
3. Aprire http://localhost:3000 → redirect a /login
4. [se VITE_DEV_LOGIN_ENABLED=true] inserire dev@deepblue.it / changeme →
   login funziona, l'app si carica con il profilo dev
5. Cliccare "Accedi con Google" → redirect a Google OAuth (se configurato)
6. Dopo il login → redirect a / con l'app caricata
7. L'header mostra il nome dell'utente autenticato (non 'Roberto')
8. POST /auth/logout funziona e torna a /login

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: marca UI-1 completata, scrivi prossimi step (UI-2).
- Elenca file creati/modificati.
```
