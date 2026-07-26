import type { CacheEntry } from "./types";

// ─── TTL constants (ms) ────────────────────────────────────────────────────────

export const TTL = {
  GEM_LIST:          60 * 60_000,      // 60 min
  WEEKLY_LEADERBOARD: 60_000,          // 60 s — near real-time
  ALL_TIME_LEADERBOARD: 10 * 60_000,   // 10 min
  ZONE_STATS:         5 * 60_000,      // 5 min
  USER_PROFILE:       Infinity,        // session-length (cleared on logout)
  SAFETY_REPORTS:     30_000,          // 30 s — immediate effect
  BLOOM_STATUS:       6 * 60_000,      // 6 min (matches decay job)
  EVENTS_LIST:        5 * 60_000,
  COMMUNITY_POSTS:    2 * 60_000,
} as const;

import { queryClient } from '../lib/queryClient';

// ─── Cache key builders ────────────────────────────────────────────────────────

export const CacheKey = {
  gemList:           () => ["gem_list"],
  gemBloom:          (gemId: number) => ["gem_bloom", gemId],
  weeklyLeaderboard: () => ["leaderboard_weekly"],
  allTimeLeaderboard:() => ["leaderboard_alltime"],
  zoneLeaderboard:   (zoneId: string) => ["leaderboard_zone", zoneId],
  zoneStats:         (zoneId: string) => ["zone_stats", zoneId],
  safetyReports:     () => ["safety_reports"],
  communityPosts:    () => ["community_posts"],
  userProfile:       (userId: string) => ["profile", userId],
  events:            () => ["events"],
};

// ─── Invalidation rules ────────────────────────────────────────────────────────

/** Call after any check-in in a zone */
export function invalidateAfterCheckin(gemId: number, zoneId: string): void {
  queryClient.invalidateQueries({ queryKey: CacheKey.gemBloom(gemId) });
  queryClient.invalidateQueries({ queryKey: CacheKey.weeklyLeaderboard() });
  queryClient.invalidateQueries({ queryKey: CacheKey.zoneStats(zoneId) });
}

/** Call after a new gem is accepted or edited */
export function invalidateAfterGemChange(): void {
  queryClient.invalidateQueries({ queryKey: CacheKey.gemList() });
}

/** Call after any safety report changes status */
export function invalidateAfterSafetyChange(): void {
  queryClient.invalidateQueries({ queryKey: CacheKey.safetyReports() });
}

/** Call on weekly reset */
export function invalidateOnWeeklyReset(): void {
  queryClient.invalidateQueries({ queryKey: CacheKey.weeklyLeaderboard() });
  queryClient.invalidateQueries({ queryKey: ["leaderboard_zone"] });
  queryClient.invalidateQueries({ queryKey: ["zone_stats"] });
}

/** Call on logout */
export function invalidateOnLogout(userId: string): void {
  queryClient.invalidateQueries({ queryKey: CacheKey.userProfile(userId) });
}

// ─── localStorage persistence (client-side) ───────────────────────────────────

const LS_VERSION = "hadi_v2";

function lsKey(key: string): string {
  return `${LS_VERSION}_${key}`;
}

export const localStorage_ = {
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(lsKey(key), JSON.stringify(value));
    } catch { /* quota exceeded — fail silently */ }
  },
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(lsKey(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  remove(key: string): void {
    window.localStorage.removeItem(lsKey(key));
  },
  pruneOldVersions(): void {
    // Remove keys from old versions
    const oldVersions = ["hadi_v0", "hadi_v1"];
    for (const v of oldVersions) {
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith(v)) window.localStorage.removeItem(k);
      }
    }
  },
};

export const LSKey = {
  visitedGems:  "visited_gems",   // number[]
  savedGems:    "saved_gems",     // number[]
  userStats:    "user_stats",     // UserStats
  unlockedBadges: "badges",       // string[]
  checkinRecords: "checkin_records", // CheckinRecord[]
  notifications: "notifications", // AppNotification[]
  activityLog:   "activity_log",  // ActivityEntry[]
};
