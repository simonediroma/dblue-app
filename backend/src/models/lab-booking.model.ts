import mongoose, { Document, Schema, Types } from 'mongoose';

// Prenotazione esclusiva del Lab per un'intera giornata (attività, non uso singola
// scrivania — quella passa da Room/WorkingStatus.room come ogni altra stanza).
// Un solo record per data: oggi esiste una sola stanza di tipo/categoria 'lab',
// vedi getLabRoomForUser() in lab-booking.service.ts.
export interface ILabBooking extends Document {
  date: string;
  roomName: string;
  bookedBy: Types.ObjectId;
  bookedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const labBookingSchema = new Schema<ILabBooking>(
  {
    date: { type: String, required: true, unique: true },
    roomName: { type: String, required: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookedByName: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const LabBooking = mongoose.model<ILabBooking>('LabBooking', labBookingSchema);
