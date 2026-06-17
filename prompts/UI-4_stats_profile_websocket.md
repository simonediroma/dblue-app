# UI-4 — Stats, Profile e WebSocket real-time
> Prerequisito: UI-3 completato. Backend M4 (WebSocket + Change Streams) e M5 (Stats API) completati.
> Tutto il CRUD funziona. Ora collegare le statistiche reali e gli aggiornamenti live.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO UI-4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tre obiettivi in questa macro:
1. Stats page con dati reali dal backend (Presence Days, distribuzioni, unbooking)
2. Profile: persistenza delle preferenze (tema, notifiche, accessibilità)
3. Aggiornamenti real-time via WebSocket: le card dei giorni si aggiornano
   quando un collega prenota/cancella senza bisogno di refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modifica SOLO frontend/src/.
Non toccare backend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — API Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/services/api.ts — aggiungi:

```typescript
// Statistiche mensili dell'utente corrente
getStatsMonthly(month: string): Promise<MonthlyStats>
  → GET /stats/monthly?month=YYYY-MM

// Statistiche annuali
getStatsAnnual(year: number): Promise<AnnualStats>
  → GET /stats/annual?year=YYYY

export interface MonthlyStats {
  month: string;                         // 'YYYY-MM'
  presenceDaysConfirmed: number;         // giorni In Office confermati
  presenceDaysTarget: number;            // target da contratto
  distribution: {
    inOffice: number;
    remote: number;
    mission: number;
    leave: number;
    sick: number;
  };
  unbooking: {
    standard: number;
    lastMinute: number;
  };
}

export interface AnnualStats {
  year: number;
  monthlyBreakdown: Array<{             // solo mesi completati
    month: string;                      // 'YYYY-MM'
    presenceDaysConfirmed: number;
    presenceDaysTarget: number;
  }>;
  totalUnbooking: {
    standard: number;
    lastMinute: number;
  };
  averageMonthlyPresenceDays: number;
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Wire Stats component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il componente Stats attualmente usa `days` passate come prop e Math.random.

In components/Stats.tsx:
1. Aggiungi un `useEffect` che carica le statistiche dal backend al mount
   e quando cambia il mese/anno selezionato.
2. Sostituisci i valori hardcoded (es. '6 di 10 giorni', percentuali fisse)
   con i dati da `MonthlyStats` e `AnnualStats`.
3. Il bar chart annuale usa `monthlyBreakdown` dell'API.
4. Mantieni design e animazioni — solo sostituzione dati.

Per Director/Owner: se il ruolo dell'utente è 'director' o 'owner',
mostra una nota "Dati aggregati area disponibili nella prossima release"
(placeholder — l'API di aggregazione arriva in M5 avanzato).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Wire Profile preferences
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il tema e le preferenze di accessibilità/notifica sono gestite in App.tsx con stati locali.
Devono essere persistite sul backend per sincronizzarsi tra dispositivi.

In App.tsx, `handleSetThemeMode`:
```typescript
const handleSetThemeMode = async (mode: 'light' | 'dark' | 'system') => {
  setThemeMode(mode);                         // aggiornamento ottimistico
  await updatePreferences({ theme: mode });   // persiste sul backend
};
```

In components/Profile.tsx, i toggle di notifiche e accessibilità:
- Ogni toggle onChange chiama `updatePreferences({ notifications: {...} })` o
  `updatePreferences({ accessibility: {...} })`.
- In caso di errore API: rollback del toggle e toast di errore.

Al mount di App.tsx, carica le preferenze dall'utente autenticato:
```typescript
useEffect(() => {
  if (user) {
    setThemeMode(user.preferences.theme);
    setIsSimplifiedView(user.preferences.accessibility.reducedMotion);
  }
}, [user]);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Hook useWebSocket
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/hooks/useWebSocket.ts

Hook che mantiene una connessione WebSocket con il backend e riceve gli
aggiornamenti live della disponibilità degli uffici, per stanza e in aggregato.

Aggiungi le interfacce in frontend/src/types/presence.ts (o nel file dei tipi
già esistente — non creare un nuovo file se esiste già):

```typescript
export interface RoomOccupancy {
  name: string;
  booked: number;
  capacity: number;
}

export interface PresenceUpdate {
  date: string;
  rooms: RoomOccupancy[];
  extras: number;       // persone in_office senza stanza assegnata
  totalBooked: number;  // sum(rooms.booked) + extras
  totalCapacity: number;
}
```

```typescript
export function useWebSocket(
  onPresenceUpdate: (update: PresenceUpdate) => void
) {
  useEffect(() => {
    const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000')
      .replace('http', 'ws') + '/ws';

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        const today = new Date().toISOString().slice(0, 10);
        ws.send(JSON.stringify({ type: 'subscribe', date: today }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'presence_update') {
          onPresenceUpdate(msg.data as PresenceUpdate);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, Math.min(delay * 2, 8000));
      };

      ws.onerror = () => ws.close();
    };

    let delay = 1000;
    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Integra WebSocket in App.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In App.tsx:

```typescript
useWebSocket((update) => {
  // Aggiorna il giorno ricevuto con i dati per stanza e il totale aggregato.
  // La vista complessiva usa totalBooked/totalCapacity.
  // La vista per stanza usa update.rooms (es. per un breakdown tooltip/modale).
  setDays(prev => prev.map(d =>
    d.date === update.date
      ? {
          ...d,
          bookedCount: update.totalBooked,
          totalCapacity: update.totalCapacity,
          rooms: update.rooms,     // per la vista per stanza
          extras: update.extras,
        }
      : d
  ));
});
```

Assicurati che il tipo `Day` (o come si chiama nel codebase) includa i campi:
  `rooms?: RoomOccupancy[]` e `extras?: number`

Non aggiungere UI per la vista per stanza in questa macro — i dati ci sono,
la UI verrà in una iterazione successiva. La card usa `bookedCount`/`totalCapacity`
come prima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Pulizia finale
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dopo aver completato i 5 step precedenti:

1. Cerca nel codebase di frontend/src/ i TODO lasciati nelle macro precedenti
   e risolvi quelli che ora sono fattibili.
2. Rimuovi import inutilizzati segnalati da `npm run lint`.
3. Verifica che `npm run build` (build di produzione) completi senza errori.
   Se ci sono errori TypeScript in build ma non in dev, risolvili.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE UI-4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. `npm run build` → zero errori
2. Stats page → tab Mensile mostra giorni confermati reali vs. target da contratto
3. Stats page → tab Annuale mostra bar chart con dati reali mesi passati
4. Profile → cambiare tema → ricaricare la pagina → il tema è lo stesso
5. Profile → disattivare una notifica → ricaricare → la preferenza persiste
6. WebSocket test: aprire l'app in due browser diversi →
   prenotare una scrivania nel browser A →
   il `bookedCount` nella card del browser B si aggiorna senza refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Esegui `npm run build` e assicurati che passi pulito.
- Crea il commit: git commit -m "feat: UI wiring completo — auth, status, check-in, stats, websocket"
- Aggiorna CLAUDE_MEMORY.md: UI-4 completata, UI wiring chiuso.
  Scrivi prossimi step: M6 (email notifiche) e test E2E.
- Elenca file creati/modificati.
```
