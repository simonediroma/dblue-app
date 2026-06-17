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
| **Dev/Staging** | Railway MongoDB plugin | Incluso nel progetto Railway, zero config |
| **Produzione** | MongoDB Atlas M10+ | SLA garantito, backup automatici, Change Streams stabili |

> Per dev e staging **non serve Atlas** — Railway include un plugin MongoDB
> che si collega automaticamente al backend con la variabile `MONGODB_URL`.
> Atlas va configurato solo quando si va in produzione.

---

## 6. Ambienti di deploy

| Ambiente | Branch | Piattaforma | DB |
|---|---|---|---|
| **Local** | qualsiasi | localhost | Docker |
| **Dev/Staging** | `develop` | Railway | Railway MongoDB plugin |
| **Production** | `main` | Railway (pro) o Cloud Run | MongoDB Atlas M10 |

---

## 7. Deploy: Railway (dev e staging)

> **Perché Railway?** Zero configurazione server, WebSocket supportati nativamente,
> MongoDB come plugin integrato, deploy automatico da GitHub push.
> Free tier include 5$/mese di crediti — sufficiente per mesi di sviluppo.

### 7.1 Creare il progetto Railway

1. Andare su [railway.app](https://railway.app) → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. Selezionare il repository `presence-app`
4. Railway crea automaticamente il primo service

### 7.2 Configurare i service

Il progetto avrà **tre service**: backend, frontend, MongoDB.

**Service 1 — Backend:**
1. Nel service creato automaticamente → **Settings**
2. **Root Directory**: `/backend`
3. **Start Command**: `npm start` (esegue il build compilato)
4. Railway rileva Node.js e usa Nixpacks per buildare automaticamente

**Service 2 — Frontend:**
1. **New** → **GitHub Repo** → stesso repo
2. **Root Directory**: `/frontend`
3. **Start Command**: lasciare vuoto (Railway serve il build Vite con static server)
4. Oppure usare Dockerfile esistente se presente

**Service 3 — MongoDB:**
1. **New** → **Database** → **Add MongoDB**
2. Railway spawna MongoDB e genera automaticamente `MONGODB_URL`
3. La variabile viene iniettata nel backend linkando i due service:
   - Nel service backend → **Variables** → **Add Reference** → selezionare `MONGODB_URL` dal service MongoDB

### 7.3 Variabili d'ambiente su Railway

Nel service **backend** aggiungere da UI (Settings → Variables):

```
NODE_ENV=staging
JWT_SECRET=<genera con: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<da Google Cloud Console>
GOOGLE_CLIENT_SECRET=<da Google Cloud Console>
APP_URL=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
PORT=4000
```

Nel service **frontend**:
```
VITE_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

> Railway supporta la sintassi `${{service.VARIABILE}}` per referenziare
> variabili da altri service dello stesso progetto.

### 7.4 Aggiungere redirect URI per OAuth

Dopo il primo deploy Railway assegna un URL pubblico tipo
`https://presence-backend-production.up.railway.app`.

Aggiornare su Google Cloud Console → Credentials → OAuth Client:
```
https://presence-backend-<hash>.up.railway.app/auth/google/callback
```

### 7.5 Dominio custom (opzionale)

Railway → service → **Settings** → **Custom Domain**:
```
staging.presence.facile.it → frontend service
staging-api.presence.facile.it → backend service
```

Aggiungere i CNAME indicati da Railway nel DNS di Facile.

---

## 8. CI/CD con GitHub Actions + Railway

Railway deploya automaticamente ad ogni push sul branch collegato — non serve
configurare GitHub Actions per il deploy su Railway.

Il workflow di branching:

```
feature/* → develop → [Railway deploy automatico su staging]
develop   → main    → [Railway deploy automatico su produzione]
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

> **Segreti GitHub da configurare** (solo se si vuole deploy manuale via CLI):
> - `RAILWAY_TOKEN` — da Railway → Account Settings → Tokens

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

## 11. Migrazione Railway → produzione (exit strategy)

Railway va benissimo per dev e staging, ma se in produzione si vuole evitare
i costi del piano pro (~20$/mese) o avere più controllo, la migrazione è semplice
perché **i Dockerfile sono già presenti nel repo**.

### Opzioni produzione

| Opzione | Costo stimato | Complessità | Quando sceglierla |
|---|---|---|---|
| **Railway Pro** | ~20$/mese | minima | Se il team vuole zero ops |
| **GCP Cloud Run** | pay-per-use (< 10$/mese traffico basso) | media | Stack GCP, scalabilità |
| **Dokploy su VPS** | ~5-10$/mese (VPS) | media | Controllo totale, costi fissi |

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

> La migrazione da Railway a Cloud Run richiede circa **2-3 ore** di lavoro
> e zero modifiche al codice — cambia solo dove girano i container.

---

## 12. Checklist deploy — prima messa online su Railway

- [ ] Repository GitHub creato e codice pushato
- [ ] Progetto Railway creato e collegato al repo
- [ ] Tre service configurati: backend, frontend, MongoDB
- [ ] Variabili d'ambiente inserite su Railway (backend e frontend)
- [ ] `MONGODB_URL` referenziata dal service MongoDB al backend
- [ ] Credenziali Google OAuth create con redirect URI Railway
- [ ] `APP_URL` e `VITE_API_URL` puntano ai domini Railway corretti
- [ ] CORS del backend configurato con il dominio frontend Railway
- [ ] Health check `GET /health` risponde 200
- [ ] Login Google funzionante end-to-end
- [ ] WebSocket testato (connessione persistente attiva)
