import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { startScheduler } from './services/scheduler';
import { initWebSocket } from './services/websocket.service';
import { startChangeStream } from './services/change-stream.service';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI non configurata');
  await mongoose.connect(uri);
  console.log('✓ MongoDB connesso');
  startScheduler();
  await startChangeStream();
  const app = createApp();
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
