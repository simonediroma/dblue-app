import mongoose, { Document, Schema } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  dblueOfficeIntegrationEnabled: boolean;
}

const settingSchema = new Schema<ISetting>({
  key: { type: String, required: true, unique: true, default: 'global' },
  dblueOfficeIntegrationEnabled: { type: Boolean, default: false },
});

export const Setting = mongoose.model<ISetting>('Setting', settingSchema);
