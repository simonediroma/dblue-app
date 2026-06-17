# Macro 5 — Stats API + Presence Day Counting + RBAC completo
> Prerequisito: M4 completato. WebSocket e Change Streams funzionanti.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementare le API di statistiche per l'utente e il conteggio dei
Presence Day (giorni in ufficio confermati, confronto con il target da contratto).
Aggiungere anche il RBAC completo: Director e Owner vedono i dati aggregati
della propria area / di tutta l'azienda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO backend/src/.
Non toccare frontend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Service statistiche mensili
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/stats.service.ts

---

getMonthlyStats(userId: string, month: string): Promise<MonthlyStats>
  → Recupera tutti i WS dell'utente per il mese 'YYYY-MM'.
  → Conta:
      presenceDaysConfirmed = WS con status 'in_office' e isConfirmed: true
      distribution:
        inOffice   = count status in_office
        remote     = count status remote
        mission    = count status mission
        leave      = count status leave (+ parental_leave)
        sick       = count status sick
      unbooking:
        standard   = count isLastMinuteUnbooking: false AND WS.status annullato
        lastMinute = count isLastMinuteUnbooking: true
  → Carica l'utente per presenceDaysTarget da user.contract.presenceDaysTarget.
  → Ritorna:
    {
      month,
      presenceDaysConfirmed,
      presenceDaysTarget,
      distribution,
      unbooking
    }

---

getAnnualStats(userId: string, year: number): Promise<AnnualStats>
  → Per ogni mese già completato dell'anno (mese < mese corrente):
      chiama getMonthlyStats per quel mese e raccoglie i dati.
  → Il mese corrente è escluso (ancora in corso).
  → Calcola:
      totalUnbooking: somma di tutti gli unbooking dell'anno
      averageMonthlyPresenceDays: media presenceDaysConfirmed sui mesi completati
  → Ritorna:
    {
      year,
      monthlyBreakdown: Array<{ month, presenceDaysConfirmed, presenceDaysTarget }>,
      totalUnbooking: { standard, lastMinute },
      averageMonthlyPresenceDays
    }

---

getAreaStats(month: string, requestingUser: IUser): Promise<AreaStats>
  → SOLO per Director e Owner — controlla il ruolo nel service, non nella route.
  → Director: recupera stats aggregate per tutti gli utenti (per ora tutti — la
    suddivisione per area arriverà quando verrà aggiunto il campo area all'utente).
  → Owner: stesso di Director (stessa logica, stessa vista per ora).
  → Ritorna:
    {
      month,
      totalUsers: number,
      avgPresenceDaysConfirmed: number,
      usersAboveTarget: number,     // utenti con confirmed >= target
      usersBelowTarget: number,     // utenti con confirmed < target
      totalUnbooking: { standard, lastMinute }
    }

Verifica: npm run lint passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Route /stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/stats.routes.ts

Tutte le route sono protette da requireAuth.

GET /stats/monthly?month=YYYY-MM
  → Chiama getMonthlyStats(req.user._id, month)
  → 400 se month non è nel formato YYYY-MM
  → 200 con MonthlyStats

GET /stats/annual?year=YYYY
  → Chiama getAnnualStats(req.user._id, year)
  → 400 se year non è un numero valido
  → 200 con AnnualStats

GET /stats/area?month=YYYY-MM
  → 403 se req.user.role non è 'director' o 'owner'
  → Chiama getAreaStats(month, req.user)
  → 200 con AreaStats

Monta il router in index.ts su /stats.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — RBAC middleware centralizzato
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/middleware/rbac.middleware.ts

Al momento il controllo del ruolo è fatto inline in rooms.routes.ts.
Centralizza con un factory middleware:

```typescript
import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user.model';

type Role = IUser['role'];

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permesso negato' });
    }
    next();
  };
}
```

Sostituisci il controllo inline in rooms.routes.ts con requireRole('owner').
Usa requireRole('director', 'owner') in stats.routes.ts per GET /stats/area.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — RBAC: visibilità dati colleghi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In backend/src/services/working-status.service.ts,
nella funzione getStatusForUser, l'arricchimento con colleghi:

Modifica colleagueAvatars per rispettare il ruolo dell'utente richiedente:
  - employee / lab_responsible / admin_member:
      vede solo i colleghi del proprio piano/area (per ora tutti — aggiungere
      il filtro area quando il campo area arriverà sul modello User).
      Include sempre i suoi projectTeammates (user.teammates).
  - director / owner:
      vede tutti gli utenti con status in_office per quella data.

Questo non cambia il comportamento attuale ma documenta dove andrà
il filtro area futuro con un commento TODO ben visibile.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. npm run build → zero errori TypeScript

2. GET /stats/monthly?month=2026-06 (con token dev director):
   → 200 con { month, presenceDaysConfirmed, presenceDaysTarget, distribution, unbooking }

3. GET /stats/annual?year=2026:
   → 200 con monthlyBreakdown (array mesi completati)

4. GET /stats/area?month=2026-06 (con token director):
   → 200 con AreaStats

5. GET /stats/area?month=2026-06 (con token employee):
   → 403 { error: 'Permesso negato' }

6. POST /rooms con token employee:
   → 403 (il requireRole('owner') centralizzato funziona)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: M5 completata, prossimi step M6.
- Elenca file creati/modificati.
```
