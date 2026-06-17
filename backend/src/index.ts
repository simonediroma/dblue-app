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
