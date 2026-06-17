import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user.model';

type Role = IUser['role'];

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as IUser | undefined;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Permesso negato' });
      return;
    }
    next();
  };
}
