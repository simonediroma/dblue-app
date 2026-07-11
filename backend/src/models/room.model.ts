import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './user.model';

const ROLES: IUser['role'][] = ['employee', 'lab_responsible', 'admin_member', 'director', 'owner'];

export interface IRoom extends Document {
  name: string;
  capacity: number;
  type: 'open_space' | 'lab' | 'admin' | 'management';
  // Ignored for type 'open_space' (always visible to everyone). For other types,
  // the roles listed here (plus 'owner', which always sees every room) can see
  // and book the room; an empty list means nobody but the owner can.
  visibleRoles: IUser['role'][];
  color?: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    type: {
      type: String,
      enum: ['open_space', 'lab', 'admin', 'management'],
      default: 'open_space',
    },
    visibleRoles: { type: [String], enum: ROLES, default: [] },
    color: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

roomSchema.index({ type: 1, isActive: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);

const DEFAULT_ROOMS: Array<{
  name: string;
  type: IRoom['type'];
  capacity: number;
  color: string;
  visibleRoles?: IUser['role'][];
}> = [
  { name: 'Red', type: 'open_space', capacity: 20, color: '#ef4444' },
  { name: 'Green', type: 'open_space', capacity: 20, color: '#22c55e' },
  { name: 'Blue', type: 'open_space', capacity: 20, color: '#3b82f6' },
  { name: 'DBLue Innovation Lab', type: 'lab', capacity: 15, color: '#a855f7', visibleRoles: ['lab_responsible'] },
  { name: 'Admin Room', type: 'admin', capacity: 8, color: '#6366f1', visibleRoles: ['admin_member'] },
  { name: 'Management Room', type: 'management', capacity: 6, color: '#f59e0b', visibleRoles: ['director'] },
];

export async function seedDefaultRooms(createdByUserId: Types.ObjectId): Promise<void> {
  for (const room of DEFAULT_ROOMS) {
    await Room.findOneAndUpdate(
      { name: room.name },
      { ...room, createdBy: createdByUserId },
      { upsert: true }
    );
  }
}
