import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRoom extends Document {
  name: string;
  capacity: number;
  type: 'open_space' | 'lab' | 'admin' | 'management';
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
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

roomSchema.index({ type: 1, isActive: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);

const DEFAULT_ROOMS: Array<{ name: string; type: IRoom['type']; capacity: number }> = [
  { name: 'Red', type: 'open_space', capacity: 20 },
  { name: 'Green', type: 'open_space', capacity: 20 },
  { name: 'Blue', type: 'open_space', capacity: 20 },
  { name: 'DBLue Innovation Lab', type: 'lab', capacity: 15 },
  { name: 'Admin Room', type: 'admin', capacity: 8 },
  { name: 'Management Room', type: 'management', capacity: 6 },
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
