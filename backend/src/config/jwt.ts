import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'fallback-dev-secret';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string };
    return payload;
  } catch {
    return null;
  }
}
