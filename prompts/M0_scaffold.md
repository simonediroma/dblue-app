# Macro 0 — Scaffold Monorepo
> Punto di partenza. Esegui questo prompt subito dopo aver connesso Claude Code al repo GitHub.
> Non serve nessuna installazione locale — Railway gestisce MongoDB e il deploy.

---

```
Leggi CLAUDE.md e CLAUDE_MEMORY.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Creare la struttura completa del monorepo (cartelle, package.json,
tsconfig, Dockerfile, configurazione Railway) pronta per lo sviluppo.
Al termine: il repo compila, Railway può leggere la struttura e fare
il primo deploy vuoto senza errori.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea file nella root del repo e nelle cartelle frontend/ e backend/.
Non toccare presence---office-planner/ (prototipo — sola lettura).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — .gitignore
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea .gitignore nella root con queste voci:

node_modules/
*/node_modules/
dist/
*/dist/
.env
.env.local
*.log
.DS_Store
CLAUDE_MEMORY.md

Nota: CLAUDE_MEMORY.md è gitignored — è lo stato interno di Claude, non va nel repo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — .env.example
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea .env.example nella root:

# ── Backend ───────────────────────────────────────────────
# In locale: Railway CLI con `railway run npm run dev` inietta le variabili
# In Railway: configura queste variabili nel dashboard del servizio backend

MONGODB_URI=           # fornita automaticamente dal plugin MongoDB Railway
JWT_SECRET=            # genera con: openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
PORT=4000
NODE_ENV=development

# Dev login alternativo (solo NODE_ENV=development)
DEV_LOGIN_USER=dev@deepblue.it
DEV_LOGIN_PASS=changeme
DEV_LOGIN_NAME=Dev User
DEV_LOGIN_ROLE=director

# Email (opzionale — se assente le email vengono simulate in console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# ── Frontend ──────────────────────────────────────────────
VITE_API_URL=          # URL pubblico del servizio backend su Railway
VITE_DEV_LOGIN_ENABLED=false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Struttura cartelle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea le seguenti cartelle (con un .gitkeep dove necessario per commitarle):

frontend/src/components/
frontend/src/pages/
frontend/src/hooks/
frontend/src/services/
frontend/src/types/
frontend/src/utils/
frontend/src/context/
backend/src/routes/
backend/src/models/
backend/src/middleware/
backend/src/services/
backend/src/config/
backend/src/types/
docs/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Backend: package.json e tsconfig
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea backend/package.json:

{
  "name": "presence-backend",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.21.2",
    "mongoose": "^8.9.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "jsonwebtoken": "^9.0.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "ws": "^8.18.0",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.16",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/passport": "^1.0.16",
    "@types/passport-google-oauth20": "^2.0.16",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/ws": "^8.5.13",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.17",
    "@types/node": "^22.14.0",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2"
  }
}

Crea backend/tsconfig.json:

{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Backend: src/index.ts placeholder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea backend/src/index.ts:

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function bootstrap() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI non configurata');
  await mongoose.connect(uri);
  console.log('✓ MongoDB connesso');
  app.listen(PORT, () => {
    console.log(`✓ Backend in ascolto su :${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Errore avvio:', err);
  process.exit(1);
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Frontend: package.json, tsconfig, vite.config
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea frontend/package.json:

{
  "name": "presence-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "lucide-react": "^0.546.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.4",
    "@tailwindcss/vite": "^4.1.14",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

Crea frontend/tsconfig.json:

{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}

Crea frontend/vite.config.ts:

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Frontend: file placeholder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea frontend/index.html:

<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Presence App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

Crea frontend/src/index.css:
@import "tailwindcss";

Crea frontend/src/main.tsx:

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

Crea frontend/src/App.tsx:

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <h1 className="text-2xl font-bold text-gray-800">Presence App — in costruzione</h1>
    </div>
  );
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — Dockerfile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea backend/Dockerfile:

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]

Crea frontend/nginx/default.conf:

server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}

Crea frontend/Dockerfile:

FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — railway.toml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crea backend/railway.toml:

[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

Crea frontend/railway.toml:

[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. cd backend && npm install && npm run lint → zero errori TypeScript
2. cd frontend && npm install && npm run lint → zero errori TypeScript
3. Verifica che la struttura cartelle corrisponda a:
   frontend/src/{components,pages,hooks,services,types,utils,context}/
   backend/src/{routes,models,middleware,services,config,types}/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- git add .
- git commit -m "chore: scaffold monorepo — backend + frontend skeleton"
- git push
- Aggiorna CLAUDE_MEMORY.md: M0 completata, prossima sessione M1.
- Elenca tutti i file creati.

Nota Railway: dopo il push, Railway rileva automaticamente i Dockerfile
e avvia il primo build. Il servizio backend andrà in errore finché non
configuri le variabili d'ambiente nella dashboard Railway (MONGODB_URI, JWT_SECRET, ecc.).
```
