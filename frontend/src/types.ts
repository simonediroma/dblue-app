export enum UserRole {
  DIRECTOR = 'DIRECTOR',
  EMPLOYEE = 'EMPLOYEE',
}

export enum WorkStatus {
  IN_OFFICE = 'IN_OFFICE',
  REMOTE = 'REMOTE',
  MISSION = 'MISSION',
  LEAVE = 'LEAVE',
  SICK = 'SICK',
  PARENTAL_LEAVE = 'PARENTAL_LEAVE',
  PARTIAL_LEAVE = 'PARTIAL_LEAVE',
  PENDING = 'PENDING',
  WAITING_LIST = 'WAITING_LIST',
  OFFICE_NO_DESK = 'OFFICE_NO_DESK',
}

export enum OffTimeType {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  CUSTOM = 'CUSTOM',
}

export interface ColleagueAvatarInfo {
  initials: string;
  color: string;
}

export interface DayPresence {
  date: string; // ISO format YYYY-MM-DD
  dayName: string;
  status: WorkStatus;
  bookedCount?: number;
  totalCapacity?: number;
  projectTeammatesCount?: number;
  colleagueAvatars?: ColleagueAvatarInfo[];
  isHighlighted?: boolean;
  isCheckedIn?: boolean;
  room?: string;
  isPast?: boolean;
  isUsingDesk?: boolean;
  isClosed?: boolean;
  isOfficeClosed?: boolean;
  isLabBooked?: boolean;
  labBookerName?: string;
  isExtended?: boolean;
  offTime?: {
    type: OffTimeType;
    hours?: number;
  };
}
