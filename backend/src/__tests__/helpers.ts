import { Types } from 'mongoose';
import { User, IUser } from '../models/user.model';
import { Room } from '../models/room.model';
import { signToken } from '../config/jwt';

export async function createUser(overrides: Partial<Pick<IUser, 'role' | 'name' | 'email' | 'teammates'>> = {}): Promise<IUser> {
  const uid = new Types.ObjectId().toHexString();
  return User.create({
    googleId: `google-${uid}`,
    email: `user-${uid}@test.com`,
    name: `Test User ${uid.slice(0, 6)}`,
    role: 'employee',
    ...overrides,
  });
}

export function authCookie(userId: string): string {
  return `token=${signToken(userId)}`;
}

export async function createRoom(createdByUserId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return Room.create({
    name: 'Test Room',
    capacity: 20,
    type: 'open_space',
    createdBy: createdByUserId,
    ...overrides,
  });
}
