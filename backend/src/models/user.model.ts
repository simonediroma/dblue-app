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
      statusReminder11: boolean;
      statusReminder18: boolean;
      projectTeammateBooking: boolean;
      monthlyOverview: boolean;
      newActivity: boolean;
    };
    accessibility: {
      reducedMotion: boolean;
      textSize: 'default' | 'large';
      screenReader: boolean;
      highContrast: boolean;
    };
  };
  onboardingCompleted: boolean;
  // Popolati solo se l'integrazione dblue-office è attiva (vedi settings.service.ts) —
  // dblueOfficeId lega questo utente al suo record su dblue-office, lastSyncedAt
  // traccia l'ultimo sync riuscito (usato per il fallback su dato stale se l'API è giù).
  dblueOfficeId?: string;
  lastSyncedAt?: Date;
  // Snapshot delle stanze visibili/prenotabili da questo utente su dblue-office,
  // cachato al login (stesso motivo di dblueOfficeId sopra) — permette a
  // capacity.service.ts di risolvere la capacità per-utente senza chiamate esterne
  // nel path caldo di prenotazione. Solo modalità API; vuoto/assente in locale.
  dblueOfficeRooms?: Array<{
    id?: string;
    name: string;
    capacity: number;
    color?: string;
    category?: string;
  }>;
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
        statusReminder11: { type: Boolean, default: true },
        statusReminder18: { type: Boolean, default: false },
        projectTeammateBooking: { type: Boolean, default: true },
        monthlyOverview: { type: Boolean, default: false },
        newActivity: { type: Boolean, default: true },
      },
      accessibility: {
        reducedMotion: { type: Boolean, default: false },
        textSize: { type: String, enum: ['default', 'large'], default: 'default' },
        screenReader: { type: Boolean, default: false },
        highContrast: { type: Boolean, default: false },
      },
    },
    onboardingCompleted: { type: Boolean, default: false },
    dblueOfficeId: { type: String, unique: true, sparse: true },
    lastSyncedAt: { type: Date },
    dblueOfficeRooms: {
      type: [
        {
          id: String,
          name: String,
          capacity: Number,
          color: String,
          category: String,
          _id: false,
        },
      ],
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export const User = mongoose.model<IUser>('User', userSchema);
