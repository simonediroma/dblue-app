# Guida Setup — Presence App
## Stack, Ambiente di Sviluppo e Deploy

> **Stack identificato dal prototipo e dalle specifiche tecniche di Natalia**

---

## 1. Stack di riferimento

| Layer | Tecnologia | Versione |
|---|---|---|
| Frontend | React + TypeScript + Vite | React 19, Vite 6 |
| Styling | Tailwind CSS | v4 |
| Backend | Node.js + Express.js + TypeScript | Node ≥ 20 LTS |
| Database | MongoDB Atlas | Cloud managed |
| Real-time | WebSockets + MongoDB Change Streams | ws / socket.io |
| Auth | Google OAuth 2.0 | Sign-In only |
| AI dev tool | Claude Code (CLI) | Latest |

**Struttura monorepo:**
```
presence-app/
├── frontend/         ← React + Vite
├── backend/          ← Express + TypeScript
├── .env.example      ← variabili condivise documentate
├── docker-compose.yml ← MongoDB locale per sviluppo
├── CLAUDE.md         ← istruzioni per Claude Code
└── package.json      ← root scripts (opzionale, per turbo/nx)
```

---

## 2. Prerequisiti da installare

Il dev deve avere sul proprio computer:

```bash
# 1. Node.js versione 20 LTS (non l'ultima, la LTS)
# https://nodejs.org/en/download — scegliere "LTS"

node --version   # deve mostrare v20.x.x
npm --version    # ≥ 10

# 2. Git
git --version

# 3. Docker Desktop
# https://www.docker.com/products/docker-desktop/
docker --version
docker compose version

# 4. Claude Code (CLI)
npm install -g @anthropic-ai/claude-code
claude --version
```

> **Perché Docker?** MongoDB Atlas in locale non esiste — Docker permette di
> avere un MongoDB identico a produzione senza installare nulla direttamente.

---

## 3. Setup iniziale del progetto

### 3.1 Clonare il repo

```bash
git clone <URL_REPO>
cd presence-app
```

### 3.2 Configurare le variabili d'ambiente

```bash
cp .env.example .env
```

Aprire `.env` e compilare i valori:

```bash
# MongoDB (locale via Docker)
MONGODB_URI=mongodb://localhost:27017/presence_dev

# Google OAuth
GOOGLE_CLIENT_ID=<da Google Cloud Console>
GOOGLE_CLIENT_SECRET=<da Google Cloud Console>

# JWT session
JWT_SECRET=<stringa random lunga almeno 32 chars>

# URL app
APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# (Opzionale) Gemini — solo se si usa AI nel prototipo
GEMINI_API_KEY=<da Google AI Studio>
```

### 3.3 Avviare MongoDB locale

```bash
docker compose up -d
# MongoDB disponibile su localhost:27017
docker compose ps  # verifica che sia "running"
```

### 3.4 Installare le dipendenze

```bash
# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..
```

### 3.5 Avviare in sviluppo

Aprire **due terminali separati**:

```bash
# Terminale 1 — backend
cd backend && npm run dev
# → http://localhost:4000

# Terminale 2 — frontend
cd frontend && npm run dev
# → http://localhost:3000
```

---

## 4. Google OAuth — configurazione

Questo è il passaggio più delicato per un junior.

### 4.1 Creare un progetto su Google Cloud Console

1. Andare su [console.cloud.google.com](https://console.cloud.google.com)
2. Creare un nuovo progetto (es. `presence-app-dev`)
3. Menu → **APIs & Services** → **Credentials**
4. Cliccare **Create Credentials** → **OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:4000/auth/google/callback` (sviluppo)
   - `https://<staging-url>/auth/google/callback` (staging)
   - `https://<prod-url>/auth/google/callback` (produzione)
7. Copiare **Client ID** e **Client Secret** nel `.env`

> **Importante:** creare credenziali OAuth **separate** per dev, staging e prod.
> Non riusare le stesse in tutti gli ambienti.

---

## 5. MongoDB — dev vs produzione

| Ambiente | Soluzione | Perché |
|---|---|---|
| **Locale** | Docker (già configurato) | Zero costi, zero latenza |
| **Dev/Staging** | MongoDB Atlas M0 | Free tier, replica set nativo (richiesto dai Change Streams) |
| **Produzione** | MongoDB Atlas M10+ | SLA garantito, backup automatici, Change Streams stabili |

> A differenza di Railway, Coolify non ha un plugin MongoDB gestito che inietta
> automaticamente una connection string nel backend — va usato Atlas anche in
> dev/staging (M0 free tier basta) e la variabile `MONGODB_URI` va valorizzata
> a mano nel servizio Coolify. Un MongoDB self-hosted via Coolify non ha il
> replica set abilitato di default, quindi non supporta i Change Streams.

---

## 6. Ambienti di deploy

| Ambiente | Branch | Piattaforma | DB |
|---|---|---|---|
| **Local** | qualsiasi | localhost | Docker |
| **Dev/Staging** | `develop` | Coolify | MongoDB Atlas M0 |
| **Production** | `main` | Coolify o Cloud Run | MongoDB Atlas M10 |

---

## 7. Deploy: Coolify (dev e staging)

> **Perché Coolify?** Self-hosted (nessun vendor lock-in/costo per-uso), deploy
> automatico da GitHub push via webhook, build da Dockerfile già presenti nel
> repo, WebSocket supportati nativamente dietro il proxy Traefik integrato.

### 7.1 Creare il progetto Coolify

1. Accedere alla propria istanza Coolify (self-hosted o cloud)
2. **New Resource** → **Public Repository** (o **Private Repository** con GitHub App collegata)
3. Selezionare il repository `presence-app` e il branch `develop`
4. Coolify propone di creare un'applicazione per il repo — ripetere il processo
   una seconda volta per avere due applicazioni distinte (backend, frontend)

### 7.2 Configurare le applicazioni

Il progetto avrà **due applicazioni** Coolify (backend, frontend) — niente
MongoDB su Coolify, si usa sempre Atlas (vedi §5).

**Applicazione 1 — Backend:**
1. **Build Pack**: `Dockerfile`
2. **Base Directory**: `backend`
3. **Dockerfile Location**: `Dockerfile` (relativo alla base directory)
4. **Ports Exposes**: `4000`
5. **Health Check Path**: `/health`

**Applicazione 2 — Frontend:**
1. **Build Pack**: `Dockerfile`
2. **Base Directory**: `frontend`
3. **Dockerfile Location**: `Dockerfile`
4. **Ports Exposes**: `80`
5. **Health Check Path**: `/`
6. **Build Argument**: `VITE_API_URL` = URL pubblico dell'applicazione backend (richiesto a build-time da Vite, va impostato come build arg, non solo come env var runtime)

### 7.3 Variabili d'ambiente su Coolify

Nell'applicazione **backend** aggiungere da UI (Environment Variables):

```
NODE_ENV=staging
JWT_SECRET=<genera con: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<da Google Cloud Console>
GOOGLE_CLIENT_SECRET=<da Google Cloud Console>
MONGODB_URI=<connection string Atlas>
APP_URL=<URL pubblico assegnato all'applicazione frontend>
PORT=4000
```

Nell'applicazione **frontend**:
```
VITE_API_URL=<URL pubblico assegnato all'applicazione backend>
```

> A differenza di Railway, Coolify non ha una sintassi `${{service.VARIABILE}}`
> per referenziare automaticamente l'URL di un'altra applicazione — l'URL
> pubblico va copiato a mano una volta noto (Coolify lo assegna al primo deploy,
> oppure è il dominio custom se già configurato, vedi §7.5).

### 7.4 Aggiungere redirect URI per OAuth

Dopo il primo deploy Coolify assegna un URL pubblico (dominio Coolify di default
o il dominio custom configurato, vedi §7.5).

Aggiornare su Google Cloud Console → Credentials → OAuth Client con l'URL
pubblico effettivo dell'applicazione backend:
```
https://<dominio-backend>/auth/google/callback
```

### 7.5 Dominio custom (opzionale)

Applicazione Coolify → **Domains**: aggiungere il dominio desiderato, es.:
```
staging.presence.facile.it → applicazione frontend
staging-api.presence.facile.it → applicazione backend
```

Coolify genera automaticamente il certificato TLS (Let's Encrypt via il proxy
Traefik integrato) una volta che il CNAME indicato punta al server Coolify.

---

## 8. CI/CD con GitHub Actions + Coolify

Coolify deploya automaticamente ad ogni push sul branch collegato (via webhook
GitHub, configurato quando si crea l'applicazione) — non serve configurare
GitHub Actions per il deploy su Coolify.

Il workflow di branching:

```
feature/* → develop → [Coolify deploy automatico su staging]
develop   → main    → [Coolify deploy automatico su produzione]
```

### Aggiungere linting pre-deploy (opzionale ma consigliato)

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: |
            frontend/package-lock.json
            backend/package-lock.json

      - name: Lint frontend
        run: cd frontend && npm ci && npm run lint

      - name: Lint backend
        run: cd backend && npm ci && npm run lint
```

Questo workflow blocca il merge se TypeScript ha errori — utile per non deployare
codice rotto su staging.

> **Segreti GitHub da configurare** (solo se si vuole triggerare un deploy manuale
> via API invece di aspettare il webhook automatico):
> - `COOLIFY_TOKEN` — da Coolify → Keys & Tokens → API tokens
> - `COOLIFY_API_URL` — l'URL della propria istanza Coolify

---

## 9. Flusso di lavoro quotidiano con Claude Code

### Setup Claude Code nel progetto

```bash
cd presence-app

# Prima inizializzazione (crea CLAUDE.md)
claude

# Oppure da terminale con un task
claude "leggi il CLAUDE.md e dimmi cosa devi sapere per iniziare"
```

### Comandi utili

```bash
# Avviare Claude Code in modalità interattiva
claude

# Dare un task da terminale (non interattivo)
claude -p "crea il model User per MongoDB con i campi: email, googleId, name, avatar, team, role"

# Lavorare su un file specifico
claude -p "refactora backend/src/routes/auth.ts per gestire il refresh token"
```

### Workflow consigliato

```
1. Pull dal branch develop
2. Creare un branch feature: git checkout -b feature/nome
3. Avviare i servizi: docker compose up -d + npm run dev (x2)
4. Usare Claude Code per implementare
5. Testare in locale
6. Push + PR verso develop
7. GitHub Actions deploya su staging automaticamente
8. QA su staging
9. Merge su main → deploy automatico in produzione
```

---

## 10. Variabili d'ambiente: riepilogo completo

| Variabile | Dove | Descrizione |
|---|---|---|
| `MONGODB_URI` | Backend | Connection string Atlas |
| `JWT_SECRET` | Backend | Chiave per firmare i token sessione |
| `GOOGLE_CLIENT_ID` | Frontend + Backend | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | OAuth client secret (mai sul frontend) |
| `APP_URL` | Backend | URL pubblico del frontend |
| `BACKEND_URL` | Frontend (build time) | URL del backend |
| `NODE_ENV` | Backend | `development` / `production` |
| `PORT` | Backend | Porta del server (default 4000) |

---

## 11. Migrazione Coolify → produzione alternativa (exit strategy)

Coolify va benissimo per dev, staging e anche produzione (self-hosted, nessun
costo per-uso oltre al server), ma se si vuole scalabilità gestita o si è già
sullo stack GCP, la migrazione è semplice perché **i Dockerfile sono già
presenti nel repo** — nessuna delle due piattaforme li richiede diversi.

### Opzioni produzione

| Opzione | Costo stimato | Complessità | Quando sceglierla |
|---|---|---|---|
| **Coolify** (stesso server di dev/staging o uno dedicato) | costo del VPS (~5-10$/mese) | minima | Se il team vuole restare self-hosted, zero costi per-uso |
| **GCP Cloud Run** | pay-per-use (< 10$/mese traffico basso) | media | Stack GCP, scalabilità gestita |

### Procedura migrazione verso GCP Cloud Run

Tutto il lavoro difficile è già fatto: i Dockerfile sono nel repo e testati.
La migrazione si riduce a:

**1. Setup GCP (una tantum):**
```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

**2. Caricare i segreti su Secret Manager:**
```bash
echo -n "<valore>" | gcloud secrets create MONGODB_URI --data-file=-
echo -n "<valore>" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "<valore>" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
```

**3. Build e deploy (identico per ogni aggiornamento):**
```bash
# Backend
gcloud builds submit ./backend \
  --tag europe-west1-docker.pkg.dev/<PROJECT_ID>/presence/backend:latest
gcloud run deploy presence-backend \
  --image europe-west1-docker.pkg.dev/<PROJECT_ID>/presence/backend:latest \
  --region europe-west1 --allow-unauthenticated \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest \
  --set-env-vars "NODE_ENV=production,GOOGLE_CLIENT_ID=<CLIENT_ID>"

# Frontend
gcloud builds submit ./frontend \
  --tag europe-west1-docker.pkg.dev/<PROJECT_ID>/presence/frontend:latest
gcloud run deploy presence-frontend \
  --image europe-west1-docker.pkg.dev/<PROJECT_ID>/presence/frontend:latest \
  --region europe-west1 --allow-unauthenticated
```

**4. Aggiornare MongoDB Atlas** da M0 (dev) a M10 (prod) e aggiornare `MONGODB_URI`.

**5. Aggiornare i redirect URI OAuth** con i nuovi URL Cloud Run.

> La migrazione da Coolify a Cloud Run richiede circa **2-3 ore** di lavoro
> e zero modifiche al codice — cambia solo dove girano i container.

---

## 12. Checklist deploy — prima messa online su Coolify

- [ ] Repository GitHub creato e codice pushato
- [ ] Due applicazioni Coolify create e collegate al repo: backend, frontend
- [ ] MongoDB Atlas (M0 dev/staging, M10 prod) creato, connection string a portata di mano
- [ ] Variabili d'ambiente inserite su Coolify (backend e frontend)
- [ ] `MONGODB_URI` valorizzata a mano nell'applicazione backend (Atlas — Coolify non la genera)
- [ ] Credenziali Google OAuth create con redirect URI dell'applicazione backend Coolify
- [ ] `APP_URL` e `VITE_API_URL` puntano ai domini Coolify corretti
- [ ] CORS del backend configurato con il dominio dell'applicazione frontend Coolify
- [ ] Health check `GET /health` risponde 200
- [ ] Login Google funzionante end-to-end
- [ ] WebSocket testato (connessione persistente attiva)
