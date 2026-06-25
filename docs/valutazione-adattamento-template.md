# Valutazione adattamento `dblue-app` → boilerplate cliente (`booking-app-template`)

> Documento di analisi. Stato: proposta per decisione.
> Riferimenti: `docs/boooking-app-template-main/AGENTS.md` (specifica cliente), codebase attuale.

---

## 0. La domanda di fondo: è una richiesta sensata o solo overhead?

Il boilerplate **non è una cosa sola**: contiene due livelli con valore molto diverso, e la risposta
cambia a seconda di quale si guarda.

**Livello 1 — Modello di integrazione** (dblue-office come fonte di verità per utenti/stanze, JWT
condiviso, login proxato). → **Sensato, aggiunge valore reale. Non è overhead.**
- Oggi l'app duplica la gestione utenti che dblue-office già fornisce: due sistemi sugli stessi utenti
  significano drift garantito nel tempo (disattivazioni non propagate, ruoli divergenti, filtro `@dblue.it`
  mantenuto a mano).
- Single source of truth + SSO con gli altri tool interni è un beneficio architetturale concreto, che si
  ripaga in manutenzione evitata.
- Se l'app deve vivere sotto `*.dblue.it` insieme agli altri strumenti aziendali, questa parte **non è
  negoziabile**: senza, l'app resta un silo separato dall'ecosistema.

**Livello 2 — Convenzioni di stack** (Tailwind→SCSS, fetch→axios, ws→socket.io, Express 5, layout
cartelle). → **In larga misura overhead, se preso per sé.**
- L'utente finale non percepisce nulla; funzionalmente non cambia niente.
- È lavoro meccanico con rischio di regressione a fronte di zero feature (la conversione styling ha il
  peggior rapporto valore/costo).
- L'unico valore è la **coerenza cross-progetto**: chi lavora sui tool Deep Blue ritrova la stessa
  struttura. È un valore reale ma *organizzativo*, non tecnico — vale quanto il cliente lo ritiene importante.

**Verdetto:** non è "solo overhead", ma nemmeno tutto valore. L'integrazione con dblue-office (Livello 1)
è sensata **a prescindere** dal boilerplate, perché risolve un problema reale di duplicazione. L'allineamento
di stack (Livello 2) è overhead giustificato **solo** dalla coerenza d'ecosistema.

**La domanda che determina la risposta finale — da chiarire col contatto dblue:** il boilerplate è un
**requisito vincolante di consegna** o una **linea guida preferenziale**?
- Se **vincolante** → si fa tutto, è parte del contratto; l'overhead del Livello 2 è il prezzo della coerenza.
- Se **preferenziale** → si fa il Livello 1 (vero valore) e si rimanda/salta il Livello 2 (specie lo
  styling): ~90% del beneficio con ~40% del lavoro e quasi tutto il rischio evitato.

**Raccomandazione operativa:** adottare comunque l'integrazione dblue-office (è la cosa giusta a
prescindere) e trattare il resto come negoziabile in base a quanto pesa la standardizzazione per il cliente.

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

**Quanto è necessario questo adattamento?**

| Driver | Necessità | Motivazione |
|---|---|---|
| **Integrazione ecosistema Deep Blue** | **Alta** se l'app deve vivere sotto `*.dblue.it` e condividere login/utenti con gli altri tool interni | Il template è la specifica con cui il cliente fa convivere i suoi tool. Senza, l'app resta un silo separato. |
| **Single source of truth utenti/stanze** | **Alta** | Oggi l'app duplica la gestione utenti che dblue-office già fornisce: drift e doppia manutenzione garantiti nel tempo. |
| **Aderenza agli standard del cliente** | **Media-Alta** | Il cliente ha fornito esplicitamente il boilerplate "come vuole i file organizzati": è una richiesta diretta, non un suggerimento. |
| **Necessità funzionale per l'utente finale** | **Nulla** | L'utente non percepisce nessuna delle differenze (Tailwind vs SCSS, ws vs socket.io, fetch vs axios). |
| **Necessità tecnica immediata (l'app oggi funziona?)** | **Bassa** | L'app attuale è completa e funzionante. Nulla è "rotto". |

**Sintesi necessità:** l'adattamento è necessario **se e solo se** l'obiettivo è far entrare l'app
nell'infrastruttura condivisa Deep Blue e rispettare la richiesta esplicita del cliente. Non è necessario
per far funzionare l'app in sé. **La domanda decisiva da porre al cliente è: questo boilerplate è un
requisito vincolante di consegna, o una linea guida preferenziale?** La risposta cambia la priorità da
"obbligatorio" a "opportuno".

---

## 5. Valutazione dell'utilità

**Benefici reali dell'adattamento:**

1. **Eliminazione della duplicazione utenti/stanze** (beneficio più tangibile). dblue-office diventa
   l'unica fonte: niente sync, niente provisioning lato app, niente filtro `@dblue.it` da mantenere.
   Riduce codice e superficie di bug a lungo termine.
2. **SSO coerente con gli altri tool interni**: l'utente usa lo stesso login dell'ecosistema, JWT condiviso.
3. **Manutenibilità e onboarding**: chiunque lavori sui tool Deep Blue ritrova la stessa struttura,
   convenzioni e file "DO NOT MODIFY". Riduce il costo cognitivo cross-progetto.
4. **Allineamento contrattuale col cliente**: consegnare nella forma richiesta evita rilavorazioni future.

**Costi/contro reali:**

1. **Refactoring ampio senza valore funzionale immediato**: l'utente finale non vede nulla di nuovo.
   È rischio puro (regressioni) a fronte di zero feature.
2. **Perdita di granularità RBAC**: da 5 ruoli a `user`/`admin` + `tool_access`. Se i 5 ruoli servono
   davvero, va negoziato con dblue-office un modello ruoli più ricco.
3. **Dipendenza forte da dblue-office**: l'app non è più autonoma; richiede dblue-office disponibile e
   il `JWT_SECRET` condiviso. Aumenta l'accoppiamento.
4. **Conversione styling = costo alto, valore basso**: tanto lavoro meccanico solo per cambiare tecnologia
   CSS. È la parte la cui utilità marginale è più discutibile presa da sola.

**Verdetto utilità:** **medio-alta sul piano strategico, bassa sul piano funzionale.** Il valore sta quasi
tutto nell'integrazione con dblue-office e nell'allineamento agli standard del cliente. Le conversioni
puramente tecnologiche (styling, http client) hanno utilità intrinseca scarsa e si giustificano solo come
parte del "pacchetto coerenza" richiesto dal cliente.

---

## 6. Raccomandazione

**Adottare l'adattamento, ma con priorità differenziata e in modo incrementale:**

1. **Prima conferma col cliente** se il boilerplate è vincolante o preferenziale. Questo determina se è
   un obbligo di consegna o un miglioramento opzionale.
2. **Se vincolante / si vuole l'integrazione:** procedere per PR nell'ordine Scaffold → Data layer (proxy)
   → Real-time → Frontend → Styling. Il valore si concentra nelle prime due PR (integrazione dblue-office):
   anche fermandosi lì si ottiene il beneficio strategico principale.
3. **Se preferenziale / risorse limitate:** adottare **solo** l'integrazione dblue-office + le convenzioni
   di struttura/naming, e **rimandare** la conversione styling (Tailwind → SCSS), che è la voce a peggior
   rapporto valore/costo.
4. **Decidere esplicitamente il mapping RBAC** con dblue-office prima di iniziare la PR data layer: è
   l'unico punto che può richiedere modifiche lato dblue-office, non solo lato app.

**Non** trattare l'adattamento come un blocco: l'app attuale funziona e può continuare a evolvere; la
migrazione è un allineamento pianificabile, idealmente prima che la UI cresca ulteriormente (così la
conversione styling resta contenuta).

---

## 7. Riferimenti

- Specifica cliente: `docs/boooking-app-template-main/AGENTS.md`
- Piano operativo di migrazione (per PR): file di piano di sessione
- File chiave attuali coinvolti: `backend/models/{user,room}.model.ts`, `backend/config/passport.ts`,
  `backend/services/{capacity,working-status,websocket}.service.ts`, `backend/middleware/rbac.middleware.ts`,
  `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/**`,
  `frontend/src/hooks/useWebSocket.ts`.
