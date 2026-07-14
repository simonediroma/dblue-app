import mongoose, { Document, Schema, Types } from 'mongoose';

export type WorkingStatusValue =
  | 'in_office'
  | 'remote'
  | 'mission'
  | 'leave'
  | 'sick'
  | 'parental_leave'
  | 'long_term_leave'
  | 'waiting_list'
  | 'office_no_desk'
  | 'pending';

export interface IWorkingStatus extends Document {
  userId: Types.ObjectId;
  date: string;
  status: WorkingStatusValue;
  isConfirmed: boolean;
  confirmedAt?: Date;
  room?: string;
  isUsingDesk?: boolean;
  offTime?: {
    type: 'morning' | 'afternoon' | 'custom';
    hours?: number;
  };
  isRetrofit: boolean;
  isLastMinuteUnbooking: boolean;
  isSeeded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const offTimeSchema = new Schema(
  {
    type: { type: String, enum: ['morning', 'afternoon', 'custom'] },
    hours: { type: Number },
  },
  { _id: false }
);

const workingStatusSchema = new Schema<IWorkingStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: ['in_office', 'remote', 'mission', 'leave', 'sick', 'parental_leave', 'long_term_leave', 'waiting_list', 'office_no_desk', 'pending'],
      default: 'pending',
    },
    isConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date },
    room: { type: String },
    isUsingDesk: { type: Boolean },
    offTime: { type: offTimeSchema },
    isRetrofit: { type: Boolean, default: false },
    isLastMinuteUnbooking: { type: Boolean, default: false },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

workingStatusSchema.index({ userId: 1, date: 1 }, { unique: true });
workingStatusSchema.index({ date: 1, status: 1 });
workingStatusSchema.index({ isSeeded: 1, date: 1 });

export const WorkingStatus = mongoose.model<IWorkingStatus>('WorkingStatus', workingStatusSchema);
