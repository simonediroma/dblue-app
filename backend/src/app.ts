import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import roomRoutes from './routes/rooms.routes';
import presenceRoutes from './routes/presence.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import adminTestRoutes from './routes/admin-test.routes';

export function createApp() {
  const app = express();

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
  app.use('/admin/test', adminTestRoutes);

  return app;
}
