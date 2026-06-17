export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'employee' | 'lab_responsible' | 'admin_member' | 'director' | 'owner';
  teammates: string[];
  contract: { presenceDaysTarget: number };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: { waitingListPromotion: boolean; sickLeaveReminder: boolean };
    accessibility: { reducedMotion: boolean; textSize: 'default' | 'large' };
  };
  onboardingCompleted: boolean;
}
