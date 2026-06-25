# Valutazione adattamento `dblue-app` → boilerplate cliente (`booking-app-template`)

> Documento di analisi. Stato: proposta per decisione.
> Riferimenti: `docs/boooking-app-template-main/AGENTS.md` (specifica cliente), codebase attuale.

---

## Abstract

L'app attuale è già completa e funzionante. Il boilerplate fornito dal cliente presuppone un servizio
interno condiviso (`dblue-office`) che **non esiste ancora**: è un'architettura futura. Di conseguenza
adattare l'app al boilerplate **oggi** non risolve alcun problema reale, e la sua parte centrale —
l'integrazione con dblue-office — sarebbe addirittura una **regressione** (sostituirebbe utenti/stanze
reali con dati mockati). Raccomandazione: **"allinea ora, integra dopo"** — nell'immediato allineare solo
struttura/convenzioni e isolare il confine utenti/auth; rimandare l'integrazione vera a quando dblue-office
sarà reale. **Domanda aperta per il contatto dblue: qual è la timeline di dblue-office?**

---

## 0. La domanda di fondo: è una richiesta sensata o solo overhead?

> **Premessa decisiva: `dblue-office` non esiste oggi.** È un servizio *futuro pianificato* (backend
> condiviso dei tool interni Deep Blue) che il template anticipa. Nel boilerplate le sue "proxy routes"
> ritornano **dati mockati** (`backend/data/mockedUsers.ts`, `mockedRooms.ts`): sono un segnaposto, non
> un'integrazione reale. Questa premessa cambia radicalmente la valutazione e va tenuta presente in
> tutto il documento.

Il boilerplate **non è una cosa sola**: contiene due livelli con valore molto diverso.

**Livello 1 — Modello di integrazione** (dblue-office come fonte di verità per utenti/stanze, JWT
condiviso, login proxato). → **Valore reale ma SOLO in futuro, quando dblue-office esisterà. Oggi sarebbe
una regressione.**
- L'idea (single source of truth + SSO tra i tool interni) è architetturalmente sana e, quando ci sarà un
  backend condiviso, eliminerà la duplicazione della gestione utenti.
- **Ma adottarla adesso significherebbe rimuovere la gestione utenti/stanze reale e funzionante dell'app
  per sostituirla con proxy verso un servizio inesistente — cioè rimpiazzare codice vero con mock.** È una
  regressione netta. Su questo punto **l'app attuale è più matura del template**: ha già implementato per
  davvero ciò che il template si limita a simulare.
- Conclusione: l'integrazione è un target **futuro**, non un lavoro da fare ora.

**Livello 2 — Convenzioni di stack** (Tailwind→SCSS, fetch→axios, ws→socket.io, Express 5, layout
cartelle). → **In larga misura overhead, se preso per sé.**
- L'utente finale non percepisce nulla; funzionalmente non cambia niente.
- È lavoro meccanico con rischio di regressione a fronte di zero feature (la conversione styling ha il
  peggior rapporto valore/costo).
- L'unico valore è la **coerenza cross-progetto**: chi lavora sui tool Deep Blue ritrova la stessa
  struttura. È un valore reale ma *organizzativo*, non tecnico.

**Verdetto:** dato che dblue-office non esiste ancora, **gran parte dell'adattamento oggi è overhead**, e
la sua parte centrale (l'integrazione) sarebbe addirittura controproducente se forzata adesso. Il
boilerplate va letto per quello che è realmente *oggi*: un **riferimento di convenzioni e una dichiarazione
di direzione futura**, non un'architettura da implementare subito.

**Cosa è effettivamente sensato fare ora (raccomandazione):**
1. **Non** sostituire la gestione utenti/stanze reale con i proxy mockati. Mantenere l'app funzionante.
2. **Allineare struttura, naming e — dove a basso costo — lo stack** alle convenzioni del template, così che
   la futura integrazione con dblue-office (quando esisterà) sia poco costosa. Questo è l'unico lavoro con
   un rapporto valore/costo difendibile nell'immediato.
3. **Isolare il confine di auth/utenti** (un solo punto da cui oggi si leggono utenti/stanze) così da poter
   in futuro sostituire "DB locale" con "proxy dblue-office" cambiando un solo modulo.
4. **Rimandare** l'integrazione vera a quando dblue-office sarà reale, e valutare lo styling (Livello 2)
   come opzionale: si fa solo se la coerenza d'ecosistema è una priorità esplicita del cliente.

**La domanda da girare comunque al contatto dblue:** esiste una **timeline reale per dblue-office**? Se è
imminente, conviene preparare il confine d'integrazione adesso; se è vago/lontano, l'adattamento è in gran
parte overhead prematuro e va ridotto al minimo (sola struttura).

---

## 1. Executive summary

Il cliente ha fornito un boilerplate che descrive **come vuole che l'app di booking sia organizzata e
integrata** nell'infrastruttura interna Deep Blue (`*.dblue.it`). Non è un semplice riordino di cartelle:
è una **specifica di integrazione** che cambia il modello dati, l'autenticazione, il real-time e l'intero
stack frontend.

L'app attuale (`dblue-app`) è stata costruita in modo autonomo con scelte diverse (gestione utenti
propria, Passport, Tailwind, `fetch`, `ws`), ma ha già implementata **tutta la business logic reale**
(presenze, desk booking, waiting list FIFO, stats, RBAC, email, cron) che il boilerplate **non contiene**:
il template è uno scaffold quasi vuoto che cabla solo auth, proxy verso `dblue-office` e real-time.

**Conclusione anticipata:** l'adattamento è **consigliato ma non urgente**. La sua utilità è soprattutto
**strategica/organizzativa** (integrazione con l'ecosistema aziendale, single source of truth, allineamento
agli standard del cliente), non funzionale per l'utente finale. Va trattato come un **refactoring di
allineamento pianificato**, non come un blocco allo sviluppo delle feature. Il punto a più alto valore e
più basso rischio è l'**integrazione con dblue-office** (eliminazione gestione utenti propria); il punto a
più basso valore e più alto costo è la **conversione Tailwind → SCSS modules**.

---

## 2. Cosa comporta l'adattamento (analisi tecnica dettagliata)

### 2.1 Modello dati e autenticazione — impatto **ALTO**

**Situazione attuale:** l'app possiede i model `User` e `Room`, gestisce login con Passport
(Google OAuth20), filtra `@dblue.it`, emette JWT proprio, conserva il token in `localStorage`, e ha 5
ruoli RBAC (`employee`, `lab_responsible`, `admin_member`, `director`, `owner`).

**Target template:** l'app **non gestisce utenti**. `dblue-office` è la fonte di verità: utenti, stanze e
chiusure sono letti via **proxy routes** (`/api/v1/office/users/list`, `/rooms/list`, `/closures/list`).
Il login è **proxato** a dblue-office (Google GIS verificato con `hd === "dblue.it"`, oppure email/password),
il JWT è firmato col `JWT_SECRET` **condiviso** e salvato come **cookie HttpOnly**. I file
`middlewares/user.ts`, `authController.ts`, `routes/auth.ts`, `officeController.ts`, `routes/office.ts`
sono marcati **DO NOT MODIFY** = contratto d'integrazione da prendere as-is.

**Cosa comporta concretamente:**
- Rimozione di `models/user.model.ts`, `models/room.model.ts`, `config/passport.ts`, dev-login custom.
- Adozione dei file auth/proxy del template senza modifiche.
- Il legame col dominio resta l'`_id` utente dblue-office, **già** usato come `userId` in `WorkingStatus`.
- **Punto delicato 1 — capienza stanze:** oggi `capacity` vive sul `Room` model; nel template arriva
  dai dati stanza di dblue-office. `capacity.service.ts` va riadattato a leggere capienza dal proxy.
- **Punto delicato 2 — RBAC:** i 5 ruoli vanno mappati su `session.role` (`"user" | "admin"`) +
  `tool_access`. Serve una decisione esplicita sul mapping (es. `admin` → funzioni admin/retrofit, resto →
  employee). Si perde granularità: va verificato se i 5 ruoli sono realmente usati o sovra-ingegnerizzati.

### 2.2 Real-time — impatto **MEDIO**

**Attuale:** `ws` (libreria base), subscription per data, broadcast `broadcastToDate`.
**Target:** `socket.io` + MongoDB change streams (`watchCollection()` / `startChangeStreams`), channel via
`join_channel`. Già usiamo change streams e replica set, quindi l'infrastruttura DB è compatibile.

**Comporta:** sostituire `websocket.service.ts` con `config/socketHandler.ts` +
`services/changeStream.service.ts` del template (registrando `WorkingStatus`); lato frontend
`useWebSocket.ts` passa a `socket.io-client`. Cambio di libreria, non di logica.

### 2.3 Frontend — HTTP, routing, struttura — impatto **MEDIO**

- `services/api.ts` (fetch wrapper + token localStorage) → **axios** con `withCredentials: true`; auth via
  cookie e `useAuth()` del template. Rimozione gestione token manuale.
- `ProtectedRoute` → pattern **LandingProtection + Layout** (outlet) in `App.tsx`.
- Riorganizzazione in `pages/<feature>/<Feature>.tsx` feature-folder (plan, stats, profile, organisation,
  onboarding) + `home/` hub. Gli hook `usePresence`/`useColleagues` restano, riadattati ad axios.

### 2.4 Styling — impatto **ALTO (per volume)**

**Attuale:** Tailwind v4 + token Material Design 3, classi utility sparse su tutti i componenti.
**Target:** **SCSS modules** (`<component>.module.scss`) + CSS variables in `styles/global.scss`.

**Comporta:** mappare i token MD3 sulle CSS variables del template (`--bg-*`, `--text-*`, `--brand-*`,
`--status-*`) e **convertire ogni componente** da classi Tailwind a SCSS module. È la voce più voluminosa e
ripetitiva: nessuna difficoltà concettuale, ma tocca praticamente tutta la UI. Va fatta componente per
componente, con verifica di parità visiva (screenshot prima/dopo).

### 2.5 Tooling e infrastruttura — impatto **BASSO**

- Express 4 → 5; porte BE 4000→3001, FE 3000→5174; monorepo `npm run dev` (concurrently) + Vite proxy `/api`.
- Env in `SCREAMING_SNAKE_CASE`, prefisso `VITE_`; `IS_AUTHENTICATED=true` + mock `backend/data/` per dev.
- Aggiornamento Dockerfile/railway.toml/nginx alle nuove porte. MongoDB resta replica set (già così).

### 2.6 Test — impatto **MEDIO**

La suite backend (`__tests__`) va riadattata: niente più user model, utenti dai mock proxy. La logica di
dominio testata (presenze, capacity, stats) resta valida ma cambia il modo di creare le fixture utente.

---

## 3. Stima di effort e rischio per area

| Area | Effort | Rischio | Note |
|---|---|---|---|
| Scaffold base + tooling (Express 5, porte, env, dev bypass) | Basso | Basso | Meccanico, file template as-is |
| Data layer → proxy dblue-office | Alto | **Alto** | Tocca auth + capacity + RBAC |
| Real-time ws → socket.io | Medio | Basso | Cambio libreria, infra DB già ok |
| Frontend HTTP + routing + struttura | Medio | Medio | Refactor diffuso ma guidato |
| Styling Tailwind → SCSS modules | Alto | Basso | Voluminoso, ripetitivo, basso rischio |
| Test backend | Medio | Medio | Fixture utenti da rivedere |

Sequenza consigliata (ogni macro = una PR indipendente e reviewable): Scaffold → Data layer → Real-time →
Frontend → Styling. Mantiene l'app sempre buildabile.

---

## 4. Valutazione della necessità

**Quanto è necessario questo adattamento?** (ricordando: dblue-office non esiste ancora — vedi §0)

| Driver | Necessità | Motivazione |
|---|---|---|
| **Integrazione ecosistema Deep Blue** | **Futura, non attuale** | Sensata quando dblue-office esisterà. Oggi non c'è nulla con cui integrarsi: il "silo" è inevitabile finché il backend condiviso non è reale. |
| **Single source of truth utenti/stanze** | **Nulla oggi** | dblue-office non esiste: non c'è una fonte alternativa. L'app *è* l'unica fonte. Adottare i proxy mockati ora **aumenterebbe** i problemi, non li ridurrebbe. |
| **Aderenza agli standard del cliente** | **Media** | Il cliente ha fornito il boilerplate come direzione: allineare struttura/convenzioni ha senso; implementare l'integrazione fittizia no. |
| **Necessità funzionale per l'utente finale** | **Nulla** | L'utente non percepisce nessuna delle differenze (Tailwind vs SCSS, ws vs socket.io, fetch vs axios). |
| **Necessità tecnica immediata (l'app oggi funziona?)** | **Bassa** | L'app attuale è completa e funzionante. Nulla è "rotto"; è più matura del template. |

**Sintesi necessità:** **nessuna necessità immediata.** dblue-office non esistendo, l'adattamento non
risolve oggi alcun problema reale — e la sua parte di integrazione sarebbe una regressione. L'unico
intervento con senso nel breve è **preparatorio**: allineare struttura/convenzioni per abbattere il costo
della futura integrazione. **La domanda decisiva per il contatto dblue: esiste una timeline reale per
dblue-office?** Se vicina, conviene preparare ora il confine d'integrazione; se vaga/lontana, l'adattamento
è overhead prematuro e va ridotto alla sola struttura.

---

## 5. Valutazione dell'utilità

**Benefici dell'adattamento — distinguendo *oggi* da *quando dblue-office esisterà*:**

1. **Eliminazione duplicazione utenti/stanze** → beneficio **solo futuro**. Oggi non si applica:
   dblue-office non esiste, quindi non c'è duplicazione da eliminare (l'app è l'unica fonte). Si
   materializza quando il backend condiviso sarà reale.
2. **SSO coerente tra tool interni** → **solo futuro**, stesso motivo.
3. **Manutenibilità e onboarding cross-progetto** → beneficio **anche oggi**, ma limitato: ritrovare la
   stessa struttura/convenzioni nei tool Deep Blue. È il principale valore *attuale*, ed è organizzativo.
4. **Confine d'integrazione pronto** → beneficio **oggi in ottica futura**: isolando ora il punto da cui si
   leggono utenti/stanze, la futura migrazione a dblue-office diventa un cambio localizzato e non un refactor.

**Costi/contro reali:**

1. **Refactoring ampio senza valore funzionale immediato**: l'utente finale non vede nulla di nuovo.
   È rischio puro (regressioni) a fronte di zero feature.
2. **Rischio di regressione se si forza l'integrazione ora**: sostituire utenti/stanze reali con proxy
   mockati = perdere funzionalità. Da evitare finché dblue-office non esiste.
3. **Perdita di granularità RBAC** (al momento dell'integrazione futura): da 5 ruoli a `user`/`admin` +
   `tool_access`. Se i 5 ruoli servono davvero, andrà negoziato con dblue-office un modello ruoli più ricco.
4. **Conversione styling = costo alto, valore basso**: tanto lavoro meccanico solo per cambiare tecnologia
   CSS. È la parte la cui utilità marginale è più discutibile presa da sola.

**Verdetto utilità:** **futura, non attuale, sul piano strategico; nulla sul piano funzionale.** Il valore
forte (integrazione con dblue-office) è interamente *posticipato* a quando quel backend esisterà; oggi non è
realizzabile. Nell'immediato resta solo l'utilità *organizzativa* dell'allineamento di convenzioni — modesta
— e il vantaggio di predisporre un confine d'integrazione pulito. Le conversioni puramente tecnologiche
(styling, http client) hanno utilità intrinseca scarsa.

---

## 6. Raccomandazione

Dato che **dblue-office non esiste ancora ma è pianificato** (vedi §0), la strategia corretta è
**"allinea ora, integra dopo"** — non una migrazione completa immediata.

1. **NON fare ora** l'integrazione dblue-office (Data layer → proxy). Sostituire utenti/stanze reali con
   mock sarebbe una regressione. Va fatta **quando dblue-office sarà reale**.
2. **Fare ora, a basso costo, solo il lavoro preparatorio:**
   - Allineare struttura cartelle, naming e convenzioni alle linee del template.
   - **Isolare il confine utenti/stanze/auth** dietro un'unica interfaccia, così che in futuro si sostituisca
     "DB locale" con "proxy dblue-office" cambiando un solo modulo. È il singolo intervento col miglior
     rapporto valore/costo oggi.
3. **Valutare come opzionali** le conversioni di stack pure (styling Tailwind→SCSS, fetch→axios, ws→socket.io):
   farle solo se la coerenza d'ecosistema è una priorità esplicita del cliente. Lo styling, in particolare,
   è la voce a peggior rapporto valore/costo e va rimandata.
4. **Quando dblue-office esisterà:** eseguire l'integrazione vera (proxy, JWT condiviso, mapping RBAC su
   `user`/`admin` + `tool_access`) come progetto a sé, partendo dal confine già isolato al punto 2.

**Domanda aperta per il contatto dblue (determina la priorità):** qual è la **timeline di dblue-office**?
Imminente → conviene fare ora il punto 2. Lontana/incerta → ridurre tutto al minimo indispensabile, perché
sarebbe overhead prematuro. **Non** trattare l'adattamento come un blocco: l'app attuale funziona, è più
matura del template e può continuare a evolvere.

---

## 7. Riferimenti

- Specifica cliente: `docs/boooking-app-template-main/AGENTS.md`
- Piano operativo di migrazione (per PR): file di piano di sessione
- File chiave attuali coinvolti: `backend/models/{user,room}.model.ts`, `backend/config/passport.ts`,
  `backend/services/{capacity,working-status,websocket}.service.ts`, `backend/middleware/rbac.middleware.ts`,
  `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/**`,
  `frontend/src/hooks/useWebSocket.ts`.
