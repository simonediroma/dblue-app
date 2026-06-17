import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import roomRoutes from './routes/rooms.routes';
import presenceRoutes from './routes/presence.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import { startScheduler } from './services/scheduler';
import { initWebSocket } from './services/websocket.service';
import { startChangeStream } from './services/change-stream.service';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/rooms', roomRoutes);
app.use('/presence', presenceRoutes);
app.use('/stats', statsRoutes);
app.use('/admin', adminRoutes);

async function bootstrap() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI non configurata');
  await mongoose.connect(uri);
  console.log('✓ MongoDB connesso');
  startScheduler();
  await startChangeStream();
  const server = http.createServer(app);
  initWebSocket(server);
  server.listen(PORT, () => {
    console.log(`✓ Backend in ascolto su :${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Errore avvio:', err);
  process.exit(1);
});
