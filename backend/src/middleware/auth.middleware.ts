import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { User } from '../models/user.model';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token: string | undefined = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.cookies?.token as string | undefined);
  if (!token) {
    res.status(401).json({ error: 'Non autenticato' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Non autenticato' });
    return;
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Non autenticato' });
    return;
  }

  req.user = user;
  next();
}
