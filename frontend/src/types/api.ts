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
}
