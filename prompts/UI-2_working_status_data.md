# UI-2 — Working Status: sostituisci INITIAL_DAYS con API reale
> Prerequisito: UI-1 completato. Backend M2 (Working Status CRUD) completato.
> L'utente è autenticato. I giorni mostrati sono ancora hardcoded da INITIAL_DAYS.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO UI-2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sostituire INITIAL_DAYS (hardcoded) con i dati reali del working status
che arrivano dal backend. Al termine la Plan page mostra i dati reali
dell'utente autenticato e le modifiche di status vengono persiste sul DB.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modifica SOLO frontend/src/.
Non toccare backend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Estendi il servizio API per il working status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/services/api.ts

Aggiungi le seguenti funzioni (non modificare quelle esistenti):

```typescript
// Recupera il working status per una finestra di date
// month: 'YYYY-MM' (es. '2026-10')
getPresence(month: string): Promise<DayPresence[]>
  → GET /presence?month=YYYY-MM

// Crea o aggiorna il WS per un singolo giorno
upsertStatus(date: string, payload: {
  status: string;
  isUsingDesk?: boolean;
  room?: string;
}): Promise<DayPresence>
  → POST /presence

// Bulk update (extend)
bulkUpsertStatus(updates: Array<{
  date: string;
  status: string;
  isUsingDesk?: boolean;
  room?: string;
}>): Promise<DayPresence[]>
  → POST /presence/bulk

// Update solo offTime (permesso)
updateOffTime(date: string, offTime: { type: string; hours?: number } | null): Promise<DayPresence>
  → PATCH /presence/:date/offtime
```

Il backend risponde con oggetti che hanno la stessa struttura di DayPresence
(stessi campi). Non trasformare la risposta — usa direttamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Hook usePresence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/hooks/usePresence.ts

Custom hook che gestisce il caricamento e la mutazione del working status.

```typescript
export function usePresence(months: string[]) {
  const [days, setDays] = useState<DayPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica i dati per tutti i mesi richiesti al mount
  useEffect(() => {
    Promise.all(months.map(m => getPresence(m)))
      .then(results => setDays(results.flat().sort(...)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Aggiorna ottimisticamente e poi persiste
  const updateStatus = async (date, status, isUsingDesk?, room?) => {
    // 1. Aggiornamento ottimistico locale (identico alla logica esistente in App.tsx)
    setDays(prev => /* stessa logica di handleUpdateStatus */ );
    // 2. Persiste sul backend
    try {
      const updated = await upsertStatus(date, { status, isUsingDesk, room });
      // Aggiorna il giorno specifico con la risposta del server
      setDays(prev => prev.map(d => d.date === date ? updated : d));
    } catch {
      // Rollback in caso di errore
      setDays(prev => /* ripristina il giorno precedente */);
      throw err;
    }
  };

  const bulkUpdateStatus = async (updates) => { /* stessa logica */ };
  const updateOffTime = async (date, offTime) => { /* stessa logica */ };

  return { days, setDays, loading, error, updateStatus, bulkUpdateStatus, updateOffTime };
}
```

Importante: mantieni la logica di aggiornamento ottimistico IDENTICA a quella
già presente in App.tsx (handleUpdateStatus, handleUpdateBulkStatus, handleUpdateOffTime).
Il hook è solo un wrapper che aggiunge la persistenza — non reimplementare la logica UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Integra usePresence in App.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In App.tsx:

1. Rimuovi `INITIAL_DAYS` e `const [days, setDays] = useState(INITIAL_DAYS)`.
2. Sostituisci con:
   ```typescript
   const currentMonth = format(new Date(), 'yyyy-MM');  // es. '2026-06'
   const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');
   const { days, setDays, loading, updateStatus, bulkUpdateStatus, updateOffTime }
     = usePresence([currentMonth, nextMonth]);
   ```
   (usa date-fns se già presente, altrimenti calcola manualmente)

3. Sostituisci le chiamate a:
   - `setDays(...)` nelle funzioni handleUpdateStatus → chiama `updateStatus()`
   - `setDays(...)` in handleUpdateBulkStatus → chiama `bulkUpdateStatus()`
   - `setDays(...)` in handleUpdateOffTime → chiama `updateOffTime()`

4. Mentre `loading === true`: mostra uno skeleton loader o la SplashScreen.
   Non mostrare dati vuoti.

5. Per i mesi storici (navigazione dropdown):
   Quando l'utente seleziona un mese passato, carica i dati con:
   ```typescript
   const [historicalDays, setHistoricalDays] = useState<DayPresence[]>([]);
   const loadHistoricalMonth = async (month: string) => {
     const data = await getPresence(month);
     setHistoricalDays(data);
   };
   ```
   Sostituisci `septemberDays` (generato con Math.random) con `historicalDays`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Colleghi da API invece di COLLEAGUES hardcoded
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/hooks/useColleagues.ts

```typescript
export function useColleagues() {
  const [colleagues, setColleagues] = useState<User[]>([]);

  useEffect(() => {
    getUsers().then(users => {
      // Mappa User API → Colleague POC
      setColleagues(users.map(u => ({
        id: u.id,
        name: u.name.split(' ')[0],
        surname: u.name.split(' ').slice(1).join(' '),
        initials: u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
        color: hashColor(u.id),  // deterministic color dalla stessa funzione hashString del POC
        avatar: u.avatar,
      })));
    });
  }, []);

  return colleagues;
}
```

In App.tsx: sostituisci `COLLEAGUES` importato da constants con `useColleagues()`.
In Onboarding.tsx: usa `useColleagues()` invece dell'import statico.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE UI-2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. `npm run lint` → zero errori TypeScript
2. La Plan page carica e mostra i giorni reali dell'utente (inizialmente tutti PENDING)
3. Cliccare su un giorno → aprire DailyDetail → cambiare status → chiudere:
   il nuovo status compare nella card E persiste dopo il refresh della pagina
4. La navigazione mese passato carica i dati storici reali (non più Math.random)
5. La lista colleghi in DailyDetail mostra gli utenti reali dal DB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: marca UI-2 completata, scrivi prossimi step (UI-3).
- Elenca file creati/modificati.
```
