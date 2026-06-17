import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'employee' | 'lab_responsible' | 'admin_member' | 'director' | 'owner';
  teammates: Types.ObjectId[];
  contract: {
    presenceDaysTarget: number;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      waitingListPromotion: boolean;
      sickLeaveReminder: boolean;
    };
    accessibility: {
      reducedMotion: boolean;
      textSize: 'default' | 'large';
    };
  };
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    avatar: { type: String },
    role: {
      type: String,
      enum: ['employee', 'lab_responsible', 'admin_member', 'director', 'owner'],
      default: 'employee',
    },
    teammates: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length <= 5,
        message: 'Maximum 5 teammates allowed',
      },
      default: [],
    },
    contract: {
      presenceDaysTarget: { type: Number, default: 10 },
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notifications: {
        waitingListPromotion: { type: Boolean, default: true },
        sickLeaveReminder: { type: Boolean, default: true },
      },
      accessibility: {
        reducedMotion: { type: Boolean, default: false },
        textSize: { type: String, enum: ['default', 'large'], default: 'default' },
      },
    },
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
