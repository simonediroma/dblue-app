# Rimozione dati mock — Presence App

Elenco dei dati mock/fake/hardcoded individuati nell'app reale (frontend + backend),
con piano di fix per ciascuno. Verifica effettuata il 2026-07-14, branch
`claude/mock-data-check-ow7g4h`. Origine di gran parte dei residui: codice copiato
dal prototipo di sola lettura `presence---office-planner/` e mai adattato ai dati reali.

## Bug da sistemare

- [ ] **Waiting list count hardcoded a "7"** — `frontend/src/components/DailyDetail.tsx:1729`
      Fix: rimuovere lo span hardcoded o sostituirlo con un valore reale calcolato dai
      dati di capacità/prenotazioni; se il dato non esiste a backend, rimuovere la label.

- [ ] **Presenza "in ufficio" fittizia (hash-based)** — `frontend/src/App.tsx:834-903` (`processedDays`)
      Bug già segnalato da un commento nel codice stesso ("BUG: this synthetic minimum...").
      Fix: rimuovere la funzione hash pseudo-random (`rand`, righe ~854-867), il padding
      artificiale a 5 avatar minimi (righe ~872-886) e `finalBookedCount = Math.max(...)`
      (riga 893). `bookedCount`/`totalCapacity` devono riflettere solo i dati reali da
      `getUsers()`/presenza backend.

- [ ] **Feature "Lab booking" non persistita** — `App.tsx:184-191`, `DailyDetail.tsx:1588-1637`
      Nome prenotante hardcoded a `'Roberto'` invece dell'utente autenticato reale, data
      hardcoded `'2026-10-06'`, nessun modello/route backend (`isLabBooked`/`labBooker`
      non esistono in `backend/src`). Fix: da chiarire se completare con backend reale o
      rimuovere la feature; in ogni caso sostituire `'Roberto'` con l'utente loggato e
      rimuovere la data hardcoded.

- [ ] **`isRoomFull` sempre `false` + `projectTeammatesCount` fake (hash-based)** — `DailyDetail.tsx:1238-1263`
      Fix: riusare la logica reale già esistente in `App.tsx:841` invece della versione
      hash-based locale; calcolare `isRoomFull` da occupazione reale vs capacità stanza.

- [ ] **Data hardcoded `'2026-10-10'` per finestra last-minute unbooking** — `DailyDetail.tsx:927`
      Fix: sostituire con calcolo relativo alla data odierna reale (es. "domani" calcolato
      dinamicamente con l'utility di formattazione data già in uso nel codebase).

- [ ] **Endpoint `POST /admin/seed` non gated da `ENABLE_DEV_LOGIN`** — `backend/src/routes/admin.routes.ts:154-167`, `seed.service.ts`
      Rischio: può cancellare dati reali con `fresh: true`, protetto solo da
      `requireRole('owner')`. Fix: aggiungere lo stesso guard di ambiente usato in
      `admin-test.routes.ts`.

- [ ] *(minore)* **Fallback hardcoded `'Blue Room'`** — `DayCard.tsx:175,265`, `App.tsx:902`
      Bassa priorità: valutare se sostituire con uno stato "nessuna stanza assegnata"
      più esplicito.

## Prossimo step consigliato
Partire dal bug della presenza fittizia in `App.tsx` (secondo punto sopra): è il più
impattante e già segnalato da un commento nel codice. Chiarire con l'utente se la
feature "Lab booking" va completata o rimossa prima di intervenire su quel punto.
