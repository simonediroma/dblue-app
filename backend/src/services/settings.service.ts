import { Setting } from '../models/setting.model';

const SETTINGS_KEY = 'global';

export async function isDblueOfficeIntegrationEnabled(): Promise<boolean> {
  const doc = await Setting.findOne({ key: SETTINGS_KEY }).lean();
  return doc?.dblueOfficeIntegrationEnabled ?? false;
}

export async function setDblueOfficeIntegrationEnabled(enabled: boolean): Promise<boolean> {
  const doc = await Setting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: { dblueOfficeIntegrationEnabled: enabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.dblueOfficeIntegrationEnabled;
}
