# Richiesta struttura API — Utenti e Stanze (dblue-office)

> Destinatario: maintainer delle API di **dblue-office** (`staging-tools.dblue.it` / `tools.dblue.it`).
> Autore: team `dblue-app` (Presence App).
> Scopo: identificare esattamente quali chiamate e quali campi ci servono per smettere di gestire Utenti e Stanze localmente in MongoDB e leggerli invece via API da dblue-office.

---

## 1. Contesto

`dblue-app` è un'app di gestione presenze/prenotazione stanze. Oggi Utenti, Stanze e Ruoli sono gestiti **interamente in locale**, in una collection MongoDB propria (creazione via login Google/dev-login, seed manuale delle stanze). Per integrare l'app nell'infrastruttura centrale dblue, vogliamo che **Utenti e Stanze** smettano di essere sorgente di verità locale e diventino dati letti (e in parte referenziati) da dblue-office via API.

Questo documento non è il piano di migrazione completo (quello resta interno, `docs/migration-plan.md`), ma la specifica puntuale di cosa ci serve dalle vostre API — per validare insieme la struttura delle chiamate prima di scrivere il codice di integrazione.

Abbiamo già una bozza di contratto API (`OFFICE_API.md`, che ci è stata fornita) con 4 endpoint disponibili: `users/list`, `users/space-access/:uid`, `rooms/list`, `closures/list`. Questo documento la usa come riferimento e si concentra su due cose:
1. **Mapping campo-per-campo** tra il nostro modello locale attuale e i vostri endpoint — per capire cosa manca o cosa va confermato.
2. **Domande aperte** che dobbiamo chiudere con voi prima di implementare.

---

## 2. Mapping — modello `User` locale → dblue-office

Il nostro modello `User` oggi ha questi campi (schema Mongoose):

| Campo locale | Tipo | Uso | Controparte in dblue-office | Note |
|---|---|---|---|---|
| `googleId` | string, univoco | Identità Google OAuth | — | Da rimuovere: l'identità diventa `dblueOfficeId` (il vostro `_id` utente). Nessuna azione richiesta da voi. |
| `email` | string, univoco | Login, notifiche | `email` (`users/list`) | ✅ Presente. |
| `name` | string | Display name | `name` (`users/list`) | ✅ Presente. |
| `avatar` | string, opzionale | Avatar utente — oggi quasi sempre vuoto (popolato solo per login Google, mai per account dev/sintetici) | `image_url` (`users/list`) | ✅ Presente, ma **nullable** — dobbiamo comunque prevedere un fallback locale (iniziali+colore) quando è null. Confermate che può essere `null`/assente e non solo stringa vuota? |
| `role` | enum: `employee`, `lab_responsible`, `admin_member`, `director`, `owner` | RBAC interno dell'app (5 ruoli) | `role` (`users/list`) — **valore diverso**, es. `"employee"` nell'esempio | ⚠️ Vedi §4 "Nota sui ruoli" — attenzione a non confondere il vostro campo `role` col nostro RBAC. |
| `teammates` | `ObjectId[]` (ref locale `User`), max 5 | Colleghi "preferiti" mostrati in home | Nessuna — resta gestito da noi | Diventerà `String[]` di `dblueOfficeId` (il vostro `_id`), non richiede nulla da voi salvo garantire che `_id` sia stabile nel tempo. |
| `contract.presenceDaysTarget` | number, default 10 | Giorni minimi di presenza/mese | `mandatory_presence_days` (menzionato in `AGENTS.md`, non nell'esempio `users/list`) | ⚠️ Non è nell'esempio di risposta di `users/list` in `OFFICE_API.md` — da quale endpoint si ottiene esattamente? Vedi domanda in §4. |
| `preferences.*` (tema, notifiche, accessibilità) | oggetti/booleani | Preferenze UI locali | — | Resta interamente locale, nessuna azione richiesta. |
| `onboardingCompleted` | boolean | Flusso di onboarding interno | — | Resta locale. |
| — | — | Stato attivo/disattivo utente | `status` (boolean, `users/list`) | ✅ Presente — `status:false` = utente disattivato. Da noi oggi non esiste un equivalente (`isActive` non è nel modello User attuale). |
| — | — | Ruolo generico/permessi dblue-office | `employment_type`, `job_title`, `login_method` | Campi che non abbiamo oggi ma che potrebbero avere senso mostrare in UI (es. job title) — non bloccanti, li segnaliamo per completezza. |

**Copertura**: ogni campo del modello User locale ha una riga sopra — nessuno resta senza risposta (anche se la risposta è "resta locale, non serve nulla da voi").

---

## 3. Mapping — modello `Room` locale → dblue-office

| Campo locale | Tipo | Uso | Controparte in dblue-office | Note |
|---|---|---|---|---|
| `name` | string | Nome stanza mostrato in UI | `name` (`rooms/list`, `roomlist` di `space-access`) | ✅ Presente. |
| `capacity` | number, min 1 | Capienza — usata per il calcolo posti disponibili/waiting list | `capacity` (`rooms/list`) — **assente nell'esempio di `space-access/:uid`'s `roomlist`** | ⚠️ Gap critico, vedi §4 — ci serve per forza in `roomlist` (o un endpoint alternativo), non solo in `rooms/list`. |
| `type` | enum: `open_space`, `lab`, `admin`, `management` | Categorizzazione stanze, usata per capire quali sono "sempre visibili a tutti" (`open_space`) vs "riservate" | `category` (ID, `rooms/list`) + `spaceAccess[].label`/`value` (`space-access/:uid`) | ⚠️ Da noi `type` è un enum fisso di 4 valori; da voi `category`/`space` sembra essere un ID libero con label associata. Serve capire se esiste un identificatore stabile equivalente a `open_space` (cioè "visibile a tutti senza restrizioni"), o se la logica di visibilità va ricostruita solo dai permessi per-utente restituiti da `space-access`. |
| `visibleRoles` | `String[]` (subset dei 5 ruoli app) | Chi può vedere/prenotare la stanza (RBAC nostro) | Nessuna diretta — la visibilità arriva de facto da `space-access/:uid` (per-utente, non per-ruolo) | Non serve che voi esponiate `visibleRoles`: il nostro RBAC resta locale (§5), e la visibilità effettiva ce la dà già `space-access` per singolo utente. |
| `color` | string, opzionale | Colore UI | `color` (`rooms/list`, `roomlist`) | ✅ Presente. |
| `isActive` | boolean, default true | Stanza attiva/disattivata | `status` (`rooms/list`, valore `"active"` nell'esempio — stringa, non booleano) | ⚠️ Da confermare il set completo di valori possibili di `status` (solo `"active"`/`"inactive"`? altri stati?). |
| `createdBy` | `ObjectId` ref `User` | Solo audit locale | — | Resta locale, nessuna azione richiesta. |
| — | — | Feature/attrezzatura della stanza (non esiste oggi da noi) | `features` (`String[]`, `rooms/list`) | Non usato oggi, ma utile — nessuna richiesta specifica. |

**Copertura**: ogni campo del modello Room locale ha una riga sopra.

**Nota strutturale importante**: oggi le prenotazioni (`WorkingStatus.room`) memorizzano il **nome** della stanza come stringa libera. Con l'integrazione, tutte le prenotazioni dovranno riferirsi all'**ID stanza** che ci fornite (da `roomlist`/`rooms/list`), non più al nome. Lo segnaliamo solo perché rende l'ID stanza un valore che deve restare **stabile nel tempo** (non deve cambiare se una stanza viene rinominata) — potete confermarlo?

---

## 4. Le 4 chiamate — riepilogo e cosa ci serve confermare

Riprendiamo la struttura già documentata in `OFFICE_API.md` (fornito da voi), evidenziando solo cosa dobbiamo chiarire prima di implementare.

### `GET /users/list` (upstream: `GET /users/listbooking/:requestingUserId`)
Usata per: popolare la rubrica colleghi (oggi ~90 colleghi gestiti localmente).
- ✅ Struttura chiara: `{_id, name, email, role, employment_type, job_title, image_url, login_method, status}`.
- ❓ **`mandatory_presence_days` non è in questo elenco** (compare solo nella sessione utente via `AGENTS.md`) — per la rubrica colleghi ci basta senza, ma per il calcolo del target di presenza del singolo utente serve capire da dove recuperarlo in modo affidabile (sessione al login, o richiamabile per-utente in un secondo momento se il dato è cambiato?).
- ❓ Conferma: questo endpoint torna **tutti** i dipendenti, incluso chi non ha ancora fatto login su dblue-app — corretto?

### `GET /users/space-access/:uid` (upstream: `GET /fetch/user/space/access/:uid`)
Usata per: capire quali stanze un utente può vedere/prenotare, e calcolare la capacità totale disponibile.
- ❓ **Gap critico**: l'esempio di risposta per `roomlist` mostra `{id, name, space, color}` — **manca `capacity`**, che ci serve per calcolare i posti totali disponibili per l'utente (oggi lo facciamo con `Room.capacity` locale, aggregato per stanza). Ci confermate che `roomlist` include `capacity` in una risposta reale, o dobbiamo sempre incrociare con `rooms/list` per recuperarla?
- ❓ Conferma: questo endpoint va richiamato una volta per sessione (login) o va rifatto ogni volta che vogliamo dati aggiornati (es. se un admin cambia i permessi di una stanza mentre l'utente è loggato)?

### `GET /rooms/list` (upstream: `GET /rooms/list`)
Usata per: vista completa di tutte le stanze (per casi admin, o come fallback per recuperare `capacity` se manca in `space-access`).
- ✅ Struttura chiara, include `capacity`.
- ❓ Conferma: torna anche le stanze con `status` non-`"active"`? (ci serve saperlo per decidere se dobbiamo filtrare noi lato client).

### `GET /closures/list` (upstream: `GET /closures/list`)
Usata per: giorni di chiusura ufficio, per il calcolo del target di presenza mensile proporzionale.
- ✅ Struttura chiara e già sufficiente per i nostri scopi (non richiede chiarimenti aggiuntivi rispetto a Utenti/Stanze).

---

## 5. Nota sui ruoli — cosa NON vi chiediamo

Il nostro RBAC interno (`employee`, `lab_responsible`, `admin_member`, `director`, `owner`) **resta gestito da `dblue-app`**, letto dal record utente locale (associato al vostro `_id` tramite `dblueOfficeId`) — **non** viene sostituito dal vostro campo `role` o da eventuali `tool_access`. Lo segnaliamo esplicitamente perché il vostro `role` (visto nell'esempio `users/list`, es. `"employee"`) ha lo stesso nome ma **non necessariamente lo stesso significato/set di valori** del nostro — non è quindi necessario che esponiate un equivalente dei nostri 5 ruoli o della nostra logica di visibilità stanze per ruolo: ci basta l'identità (`_id`/email) e i permessi per-utente (`space-access`).

---

## 6. Domande aperte — riepilogo per una risposta rapida

1. `roomlist` in `/users/space-access/:uid` include `capacity`? (blocca il calcolo capienza totale)
2. `space_access`/permessi stanza: va richiamato ogni volta o è cache-abile per sessione? Con quale invalidazione se un admin cambia i permessi?
3. Da dove recuperiamo in modo affidabile `mandatory_presence_days` per un utente (solo sessione al login, o anche via endpoint dedicato)?
4. `status` delle stanze (`rooms/list`): quali valori sono possibili oltre `"active"`?
5. Gli ID di utenti (`_id`) e stanze (`roomlist.id`/`rooms.list._id`) sono garantiti stabili nel tempo (non cambiano se si rinomina una persona/stanza)?
6. Esiste un modo per sapere se qualcosa è cambiato (utenti, stanze, permessi) senza dover richiamare `users/list`/`rooms/list` interamente ogni volta (webhook, timestamp di modifica, change-feed)?
7. Per gli utenti dev/staging già esistenti in `dblue-app` che vogliamo preservare: potete fornirci una mappa email → vostro `_id` utente, per collegare i record invece di duplicarli?
8. Per le 6 stanze oggi seedate localmente (Blue, Red, Green, Admin Room, Management Room, DBLue Innovation Lab): potete fornirci la mappatura nome → vostro `_id` stanza, per lo storico prenotazioni da migrare?
