# UI-3 — Check-in, Room Selection, Onboarding e Teammates
> Prerequisito: UI-2 completato. Backend M3 (Desk Booking + Check-in) completato.
> I dati dei giorni vengono dall'API. Ora wire le azioni che modificano il booking.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO UI-3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Collegare al backend le azioni che richiedono logica server-side:
check-in ("Say Good Morning"), selezione sala, waiting list,
onboarding (salvataggio teammates al primo login) e gestione teammates nel profilo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modifica SOLO frontend/src/.
Non toccare backend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Estendi API per check-in e room
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: frontend/src/services/api.ts — aggiungi:

```typescript
// Check-in del giorno corrente
checkIn(date: string, room?: string, isUsingDesk?: boolean): Promise<DayPresence>
  → POST /presence/:date/checkin
  Body: { room, isUsingDesk }

// Recupera le room disponibili per l'utente corrente (filtrate per ruolo)
getRooms(): Promise<Room[]>
  → GET /rooms

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'open_space' | 'lab' | 'admin' | 'management';
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Wire check-in Remote in App.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In App.tsx, la funzione `handleCheckIn`:
- Per status REMOTE: dopo l'aggiornamento ottimistico chiama `checkIn(date)`.
- Se l'API risponde con errore: rollback dello stato locale e mostra toast di errore.
- Mantieni il pattern ottimistico esistente — non aspettare la risposta per aggiornare la UI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Wire RoomSelection con room reali
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il componente RoomSelection al momento riceve le room come lista hardcoded.

In App.tsx:
1. Carica le room al mount con `getRooms()` e salvale in stato: `const [rooms, setRooms] = useState<Room[]>([])`.
2. Passa le room reali al componente RoomSelection come prop `rooms={rooms}`.

In components/RoomSelection.tsx:
1. Aggiungi la prop `rooms: Room[]`.
2. Sostituisci la lista hardcoded con il mapping delle `rooms` ricevute.
3. Mantieni il design e le animazioni esistenti — modifica SOLO la sorgente dei dati.

In App.tsx, la funzione `handleRoomSelect`:
- Dopo l'aggiornamento ottimistico chiama `checkIn(roomSelectionDate, roomName, isUsingDesk)`.
- Se errore: rollback e toast.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Waiting list: status server-driven
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quando l'utente prenota un giorno con capacità piena, il backend restituisce
status WAITING_LIST (invece di IN_OFFICE). Non calcolare la capacità in frontend.

In handleDayDoubleClick (il double-click per prenotare velocemente):
- Rimuovi il check locale `booked >= capacity`.
- Chiama direttamente `updateStatus(date, WorkStatus.IN_OFFICE)`.
- Il backend decide se assegnare IN_OFFICE o WAITING_LIST.
- La risposta API include il `status` effettivo → aggiorna la card di conseguenza.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Onboarding: salva i teammates al completamento
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In App.tsx, `handleOnboardingComplete`:
```typescript
const handleOnboardingComplete = async (selected: Colleague[]) => {
  setProjectTeammates(selected);
  // 1. Salva i teammates sul backend
  await updateTeammates(selected.map(c => c.id));
  // 2. Segna l'onboarding come completato
  await completeOnboarding();
  // 3. Aggiorna l'utente in AuthContext (refetch /auth/me)
  setShowOnboarding(false);
  setTimeout(() => scrollToToday('auto'), 100);
};
```

Se la chiamata API fallisce: mostra un toast di errore, non chiudere l'onboarding,
l'utente può riprovare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Teammates nel Profilo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il componente Profile ha già la UI per gestire i teammates (add/remove).
Attualmente aggiorna solo lo stato locale in App.tsx.

In App.tsx, `handleUpdateProjectTeammates` (o il nome equivalente che passa a Profile):
```typescript
const handleUpdateProjectTeammates = async (newTeammates: Colleague[]) => {
  setProjectTeammates(newTeammates);  // aggiornamento ottimistico
  try {
    await updateTeammates(newTeammates.map(c => c.id));
  } catch {
    setProjectTeammates(projectTeammates);  // rollback
    // mostra toast errore
  }
};
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Carica i teammates dell'utente all'avvio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Al mount di App.tsx, se `user.onboardingCompleted === true`,
carica i teammates dell'utente dal profilo:

```typescript
useEffect(() => {
  if (user && user.onboardingCompleted && user.teammates.length > 0) {
    // Recupera i dettagli dei teammates dall'array di userId
    getUsers().then(allUsers => {
      const myTeammates = allUsers
        .filter(u => user.teammates.includes(u.id))
        .map(u => mapUserToColleague(u));  // stessa funzione di mapping di useColleagues
      setProjectTeammates(myTeammates);
    });
  }
}, [user]);
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE UI-3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. `npm run lint` → zero errori TypeScript
2. Check-in Remote: cliccare "Say Good Morning" su un giorno Remote →
   isCheckedIn diventa true e persiste dopo refresh
3. Check-in In Office: cliccare "Say Good Morning" → si apre RoomSelection →
   selezionare una sala reale (non hardcoded) → il check-in viene salvato
4. Prenotare un giorno pieno: il status torna WAITING_LIST come dice il server
5. Onboarding al primo login: completarlo → i teammates vengono salvati →
   al prossimo login i teammates sono già selezionati
6. Profilo → rimuovere un teammate → il cambiamento persiste dopo refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: marca UI-3 completata, scrivi prossimi step (UI-4).
- Elenca file creati/modificati.
```
