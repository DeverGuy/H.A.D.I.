import { create } from 'zustand';
import { UserStats, CheckinRecord, AppNotification, ActivityEntry, GemSubmission } from '../engine/types';
import { localStorage_, LSKey } from '../engine/cache';
import { markRead, markAllRead, getUnreadCount } from '../engine/notifications';

function currentWeekMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

export function seedStats(): UserStats {
  return {
    userId: "user_hemanth",
    totalXP: 100,
    weeklyScore: 100,
    weeklyGems: 0,
    allTimeGems: 0,
    streakDays: 0,
    lastCheckinDate: null,
    weeklyResetDate: currentWeekMonday(),
    buddyWalks: 0,
    communityPosts: 0,
    acceptedSubmissions: 0,
    karma: 0,
    hasLocalMode: false,
    isZoneGuardian: false,
    guardianZone: null,
    firstCheckinOfWeekTimestamp: null,
  };
}

export interface PlayerState {
  stats: UserStats;
  unlockedBadges: Set<string>;
  visitedGemIds: Set<number>;
  checkinRecords: CheckinRecord[];
  notifications: AppNotification[];
  activityLog: ActivityEntry[];
  submissions: GemSubmission[];
  
  // Actions
  setStats: (stats: UserStats | ((prev: UserStats) => UserStats)) => void;
  setUnlockedBadges: (badges: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setVisitedGemIds: (ids: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setCheckinRecords: (records: CheckinRecord[] | ((prev: CheckinRecord[]) => CheckinRecord[])) => void;
  setNotifications: (notifs: AppNotification[] | ((prev: AppNotification[]) => AppNotification[])) => void;
  setActivityLog: (logs: ActivityEntry[] | ((prev: ActivityEntry[]) => ActivityEntry[])) => void;
  setSubmissions: (subs: GemSubmission[] | ((prev: GemSubmission[]) => GemSubmission[])) => void;

  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;
  getUnreadCount: () => number;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  stats: localStorage_.get<UserStats>(LSKey.userStats) ?? seedStats(),
  unlockedBadges: new Set(localStorage_.get<string[]>(LSKey.unlockedBadges) ?? []),
  visitedGemIds: new Set(localStorage_.get<number[]>(LSKey.visitedGems) ?? []),
  checkinRecords: localStorage_.get<CheckinRecord[]>(LSKey.checkinRecords) ?? [],
  notifications: localStorage_.get<AppNotification[]>(LSKey.notifications) ?? [],
  activityLog: localStorage_.get<ActivityEntry[]>(LSKey.activityLog) ?? [],
  submissions: [],

  setStats: (updater) => set((state) => {
    const newStats = typeof updater === 'function' ? updater(state.stats) : updater;
    localStorage_.set(LSKey.userStats, newStats);
    return { stats: newStats };
  }),

  setUnlockedBadges: (updater) => set((state) => {
    const newBadges = typeof updater === 'function' ? updater(state.unlockedBadges) : updater;
    localStorage_.set(LSKey.unlockedBadges, Array.from(newBadges));
    return { unlockedBadges: newBadges };
  }),

  setVisitedGemIds: (updater) => set((state) => {
    const newIds = typeof updater === 'function' ? updater(state.visitedGemIds) : updater;
    localStorage_.set(LSKey.visitedGems, Array.from(newIds));
    return { visitedGemIds: newIds };
  }),

  setCheckinRecords: (updater) => set((state) => {
    const newRecords = typeof updater === 'function' ? updater(state.checkinRecords) : updater;
    localStorage_.set(LSKey.checkinRecords, newRecords);
    return { checkinRecords: newRecords };
  }),

  setNotifications: (updater) => set((state) => {
    const newNotifs = typeof updater === 'function' ? updater(state.notifications) : updater;
    localStorage_.set(LSKey.notifications, newNotifs);
    return { notifications: newNotifs };
  }),

  setActivityLog: (updater) => set((state) => {
    const newLogs = typeof updater === 'function' ? updater(state.activityLog) : updater;
    localStorage_.set(LSKey.activityLog, newLogs);
    return { activityLog: newLogs };
  }),

  setSubmissions: (updater) => set((state) => ({
    submissions: typeof updater === 'function' ? updater(state.submissions) : updater
  })),

  markNotifRead: (id: string) => set((state) => {
    const next = markRead(state.notifications, id);
    localStorage_.set(LSKey.notifications, next);
    return { notifications: next };
  }),

  markAllNotifsRead: () => set((state) => {
    const next = markAllRead(state.notifications);
    localStorage_.set(LSKey.notifications, next);
    return { notifications: next };
  }),
  
  getUnreadCount: () => getUnreadCount(get().notifications),
}));
