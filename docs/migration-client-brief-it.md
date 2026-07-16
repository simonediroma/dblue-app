# Migrazione all'infrastruttura Deep Blue — Documento per il cliente

> Scopo di questo documento: fornire un quadro chiaro e completo di **tempistiche** e **rischi** della migrazione, e in particolare le informazioni necessarie per decidere **se rendere obbligatori o meno i bump di versione a Node 22 / Vite 8**. Riassume `docs/migration-plan.md` (piano completo fase per fase) e `docs/migration-risks.md` (registro completo dei rischi) — per il dettaglio implementativo fare riferimento a quei due documenti; questo serve per la decisione, non per il "come".

---

## In sintesi

- La migrazione in sé (riscrittura auth, integrazione con dblue-office, real-time, aggiornamento stack) è ben specificata e, a parte un'eccezione, priva di grosse sorprese: abbiamo verificato i documenti forniti dal cliente (`MIGRATION.md`, `AGENTS.md`, `OFFICE_API.md`) contro il codice reale dell'applicazione, confermando che sono implementabili come descritto, con alcune correzioni segnalate più sotto.
- **Tempistica stimata: 5–7 settimane di calendario** per uno sviluppatore, per tutto ciò che è necessario per andare in produzione — esclusa la conversione opzionale Tailwind→SCSS, che è un lavoro separato e rimandabile.
- **Il bump a Node 22 ha costo e rischio bassi.** Lo consigliamo a prescindere da cosa si decida più sotto.
- **Il bump a Vite 8 è l'unico punto di questa migrazione con un blocco tecnico reale e confermato** (dettagliato al §3), e proviene da un documento (`AGENTS.md`) che descrive il template *generale* degli strumenti interni Deep Blue, non un requisito specifico di questa applicazione. Questo lo rende un vero punto di decisione, non solo un task tecnico — questo documento espone le opzioni perché la scelta possa essere fatta con piena visibilità.

---

## 1. Tempistiche

| Fase | Cosa copre | Stima |
|---|---|---|
| Precondizioni | Conferma repo/decisioni/accessi | 0.5–1 giorno (+ tempo di attesa) |
| Pulizia struttura App | Suddivisione di `App.tsx` (1.419 righe) | 1–2 giorni |
| Scaffold di deployment | Struttura monorepo per Coolify | 1 giorno |
| Migrazione modello utente | Collegamento agli ID utente di dblue-office | 2–3 giorni |
| **Riscrittura autenticazione** | Auth via cookie, Google Identity Services, email/password | 4–5 giorni |
| Integrazione dati dblue-office | Utenti, stanze, chiusure via route proxy | 3.5–5 giorni |
| Fix dei 3 valori hardcoded | Capacità reale, target presenza reale, "oggi" dinamico | 1 giorno |
| Express 5 / axios / **Node 22 & Vite 8** | Aggiornamenti di dipendenze e tooling | 1.5–3 giorni |
| Real-time (socket.io) | Sostituzione dell'attuale implementazione WebSocket | 2–3 giorni |
| Cron come processo separato | Resilienza operativa | 0.5–1 giorno |
| **Riscrittura suite di test automatici** | 113 test end-to-end esistenti, tutti da ricostruire sul nuovo modello di auth | 5–8 giorni |
| Fix di accessibilità | Navigazione da tastiera, supporto screen reader | 2–3 giorni |

**Totale: ~24–35 giorni lavorativi ≈ 5–7 settimane di calendario**, per uno sviluppatore, assumendo nessuna attesa prolungata su accessi/decisioni da parte vostra e nessuna sorpresa oltre al singolo gap già segnalato nell'esempio di risposta di `OFFICE_API.md` (§4 di `migration-risks.md`).

**Non incluso sopra — opzionale, da decidere separatamente:** la conversione dell'attuale styling Tailwind CSS in SCSS modules (convenzione interna Deep Blue). È esplicitamente il punto più oneroso in termini di tempo tra quelli citati nei documenti stessi del cliente, scala con la superficie della UI più che con un contratto di integrazione fisso, e non blocca nient'altro. Stima **5–10+ giorni lavorativi** a seconda di quanto incrementalmente venga svolto. Consigliamo di deciderlo indipendentemente dal resto della tempistica, e di trattarlo come la prima cosa da tagliare se il calendario dovesse doversi restringere.

---

## 2. Panorama dei rischi

Dettaglio completo in `docs/migration-risks.md`. In sintesi, organizzato per cosa significa per voi:

**Cose che funzioneranno senza problemi, rischio basso:**
Express 5, axios, il rename del prefisso delle route, il flusso di reset password (già completamente specificato, copia diretta dal template). Confermato che il sistema di permessi a 5 ruoli dell'app resta sotto il vostro controllo, non passa a dblue-office, come previsto dal vostro stesso documento di revisione — nessuna perdita di granularità su questo punto.

**Cose che richiedono attenzione in fase di implementazione, ma sono ben comprese — nessuna decisione richiesta da parte vostra:**
- Copiare alla lettera il codice real-time (socket.io) del template annullerebbe silenziosamente un fix di visibilità dei ruoli già rilasciato nell'app attuale. Lo sappiamo in anticipo e porteremo avanti la logica esistente invece di scartarla.
- Le stanze prenotate oggi vengono registrate per nome; la nuova integrazione richiede di registrarle tramite l'ID di dblue-office. Questo tocca più codice di quanto sembri a prima vista (diverse schermate confrontano le stanze per nome oggi) — già previsto nella fase corretta, non sarà una sorpresa in seguito.
- Alcuni bug applicativi già noti (avatar dei colleghi non visualizzati correttamente, etichetta stanza non aggiornata dopo un cambio di stato) ricadono esattamente nel punto in cui il modello utente cambia comunque — più economico sistemarli una volta sola, ora, che due volte.

**Cose che richiedono una decisione o un input da parte vostra prima di poter procedere (elenco completo in `migration-plan.md` §5):**
- Se preservare o meno i dati di sviluppo/staging esistenti attraverso la migrazione (richiede una mappatura degli ID utente da dblue-office).
- Preferenza sulla struttura di deployment (monorepo, come indicato, vs. servizi separati).
- Accessi: il nuovo repository, la registrazione delle origin su Google Cloud Console per ciascun ambiente, il JWT secret condiviso per ambiente, la conferma dei domini di staging/produzione.

**Rischio di processo da segnalare esplicitamente:** questa migrazione viene costruita in un repository nuovo, non in-place. Se il lavoro di bug-fixing continua in parallelo sull'app attuale, i fix fatti lì non compariranno automaticamente nel nuovo codice. Consigliamo di concordare un punto di cutoff non appena inizia il lavoro di migrazione.

---

## 3. La decisione: Node 22 / Vite 8 devono essere obbligatori?

### Da dove viene questo requisito

Né il vostro documento di revisione tecnica originale né la guida `MIGRATION.md` menzionano versioni specifiche di Node.js o Vite. Il requisito proviene da un terzo documento, `AGENTS.md` — che descrive il **template generico** da cui sono costruiti tutti gli strumenti interni Deep Blue, non qualcosa di specifico per la presence app. La sua tabella tecnologica indica Node 22 e Vite 8 come vincoli fissi. È una scelta ragionevole per un template pensato per servire più strumenti in modo coerente — ma vale la pena trattarla come una decisione aperta per questo progetto specifico, non come un requisito automatico, dato che non è qualcosa richiesto dalla vostra stessa revisione di questa app.

### Node.js 20 → 22

Abbiamo verificato il codice backend reale contro ogni comportamento che cambia tra queste versioni (funzioni crittografiche rimosse/modificate, compatibilità dei moduli nativi, funzioni di utilità deprecate). **Nessuna di queste è usata in questo codebase**, e il backend non ha dipendenze native (compilate) che il bump di versione potrebbe impattare. È quasi una non-decisione: costo basso, nessun rischio rilevante, nessun motivo per rimandarlo.

**Raccomandazione: farlo a prescindere dalla decisione su Vite qui sotto.**

### Vite 6 → Vite 8

Questo è un salto più grande — due major version, e quella più recente (Vite 8, rilasciata ~4 mesi fa) ha sostituito l'intero motore di build interno con uno nuovo basato su Rust (Rolldown). Abbiamo trovato un problema concreto e confermato: il plugin che questa app usa per far girare Tailwind CSS dentro Vite è attualmente fissato a una versione che **rifiuta esplicitamente di funzionare con Vite 7 o 8** — andrebbe aggiornato nello stesso intervento, e quella versione più recente supporta Vite 8 solo da circa quattro mesi. In sintesi: questa combinazione specifica funziona oggi, ma è recente e ancora in fase di assestamento, non una combinazione matura e testata a lungo.

Questo non significa che sia rischiosa in senso assoluto — significa che comporta più rischio di "sorpresa al secondo giorno" rispetto a un target stabile da un anno, e il costo per arrivarci (un passaggio di verifica compatibilità, un percorso di aggiornamento incrementale invece di un salto diretto, e un controllo visivo/funzionale completo dopo) è reale, non solo un numero di versione in un file di configurazione.

### Le vostre opzioni

| Opzione | Cosa comporta | Impatto sulle tempistiche | Rischio |
|---|---|---|---|
| **A — Piena conformità ora** (Node 22 + Vite 8) | Rispettare esattamente i vincoli dichiarati dal template | Come da stima sopra (~1.5–3 giorni per questa fase) | Medio — il blocco del plugin Tailwind è reale ma risolvibile; qualche probabilità di dover fare un intervento di follow-up poco dopo il lancio mentre la combinazione Vite 8/Tailwind matura |
| **B — Node 22 subito, Vite 7 come passaggio intermedio** | Modernizzare completamente il runtime; portare il frontend avanti di una major version, senza ancora adottare Vite 8 (basato su Rolldown) | Simile o leggermente inferiore all'Opzione A | Più basso — evita la combinazione più recente e meno collaudata pur muovendosi dalla versione attuale; servirebbe un secondo bump, più piccolo, in seguito per la piena conformità |
| **C — Node 22 subito, si resta su Vite 6 per questa migrazione** | Rimandare del tutto il cambio del build tool frontend; da riprendere come lavoro separato in futuro | Risparmia circa la porzione Vite-specifica della Fase 7 (una frazione di giorno) | Il più basso per questa migrazione, ma lascia l'app più lontana dallo standard dichiarato dal template, e il bump andrà comunque fatto prima o poi |

**La nostra raccomandazione, per quel che vale:** Opzione B. Ottiene subito il vantaggio significativo e a basso rischio (Node 22), fa avanzare il tooling di build frontend invece di congelarlo, ed evita di legare la tempistica di questa migrazione alla parte meno matura dello stack (Vite 8 basato su Rolldown e il suo supporto Tailwind ancora recente) — pur mantenendo la piena conformità a Vite 8 realisticamente a un piccolo passo successivo, non a una grande migrazione futura.

Questa è una raccomandazione, non una decisione presa al posto vostro — il compromesso è genuinamente tra "rispettare il template alla lettera, accettando un po' più di rischio al secondo giorno" e "modernizzare quasi del tutto, rimandando la parte più recente e meno collaudata". Siamo disponibili a procedere con qualunque opzione il team preferisca, una volta viste le implicazioni.

---

## 4. Cosa ci serve da voi per procedere

1. **La decisione su Node/Vite** di cui sopra (Opzione A, B o C).
2. Conferma della struttura di deployment (monorepo vs. servizi separati).
3. Se la conversione Tailwind→SCSS è nello scope di questo incarico, o rimandata.
4. Se i dati di sviluppo/staging esistenti devono essere preservati attraverso la migrazione.
5. Elementi di repository, accesso e credenziali elencati per intero in `docs/migration-plan.md` §5 (accesso a Google Cloud Console per la registrazione delle origin, JWT secret condiviso per ambiente, conferma dei domini di staging/produzione, URI MongoDB, accesso a Coolify).

Una volta confermati questi punti, potremo bloccare la tempistica al §1 e avviare la Fase 0.
