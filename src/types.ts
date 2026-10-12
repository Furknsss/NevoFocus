export type FocusModeType = 'forest' | 'climb' | 'flight' | 'dive';

export interface FocusModeConfig {
  id: FocusModeType;
  title: string;
  subtitle: string;
  accentColor: string;
  glowColor: string;
  description: string;
  iconName: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

export type FocusTaskType = 'soru' | 'video' | 'konu' | 'rutin' | 'deneme';
export type StudyAreaType = 'tyt' | 'ayt' | 'ydt' | 'kpss' | 'genel';

export interface FocusTask {
  id: string;
  userId?: string;
  title: string;
  taskType?: FocusTaskType;
  taskTypeName?: string;
  area?: StudyAreaType;
  areaName?: string;
  subjectName: string;
  subjectColor: string;
  plannedMinutes: number;
  isCompleted: boolean;
  createdAt: number;
  dateString?: string; // YYYY-MM-DD for day-by-day task planning & tracking
  flightOrigin?: string;
  flightDestination?: string;
  flightCode?: string;
}

export interface FlightAirport {
  code: string;
  city: string;
  country: string;
  name: string;
  lat: number;
  lng: number;
}

export interface FocusSession {
  id: string;
  userId?: string;
  mode: FocusModeType;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  plannedMinutes: number;
  completedSeconds: number;
  breakSeconds?: number;
  completed: boolean;
  timestamp: number; // ms
  dateString: string; // YYYY-MM-DD
  startTimeString: string; // HH:mm
  endTimeString: string; // HH:mm
  note?: string;
  taskId?: string;
  taskTitle?: string;
  flightInfo?: {
    origin: string;
    destination: string;
    flightCode: string;
    seat: string;
  };
  climbInfo?: {
    peakName: string;
    campsSet: number;
    flagPlanted: boolean;
  };
  diveInfo?: {
    fishCityReached: boolean;
    depthMeters: number;
  };
  forestInfo?: {
    treeSpecies: string;
    treeLevel: number;
  };
}

export interface StudentPeer {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  status: 'studying' | 'break' | 'idle';
  currentSubject: string;
  currentMode: FocusModeType;
  currentSeconds: number;
  todayTotalMinutes: number;
  roomName: string;
  streakDays: number;
  cheersReceived: number;
  targetUniversity?: string;
  targetDepartment?: string;
  targetExam?: string;
  isCurrentUser?: boolean;
}

export interface RoomChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  userAvatarColor?: string;
  text: string;
  createdAt: number;
}

export interface CheerNotification {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatarUrl?: string;
  toUserId: string;
  createdAt: number;
  read?: boolean;
}

export interface ActiveBackgroundFocusState {
  sessionId: string;
  mode: FocusModeType;
  subjectName: string;
  subjectColor: string;
  plannedMinutes: number;
  startTime: number;
  timerType: 'countdown' | 'stopwatch';
  paused: boolean;
  pauseTime?: number;
  totalPausedSeconds: number;
}

export interface StudyRoom {
  id: string;
  code: string; // 6-digit room code e.g. '849201'
  name: string;
  category: string;
  description: string;
  targetExam: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: number;
  isPrivate?: boolean;
  password?: string;
  hasPassword?: boolean;
  memberCount?: number;
  onlineCount?: number;
  participants?: string[];
}

export interface UserProfile {
  userId?: string;
  email?: string;
  name: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
  targetUniversity?: string;
  targetDepartment?: string;
  targetExam: string;
  studyTrack?: string;
  dailyGoalHours: number;
  currentStreakDays: number;
  totalFocusHours: number;
  hasCompletedOnboarding?: boolean;
  hasPassword?: boolean;
  cheersReceived?: number;
  status?: 'studying' | 'break' | 'idle';
  currentSubject?: string;
  currentMode?: FocusModeType;
  todayTotalMinutes?: number;
  theme?: string;
  soundNotifications?: boolean;
  breakReminders?: boolean;
  desktopNotifications?: boolean;
  liveNotifications?: boolean;
}
