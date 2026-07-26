import type { UserStats, GemState, SafetyReport, GemSubmission } from "./types";
import { processExpiredReports } from "./safety";
import { processExpiredSubmissions } from "./submission";
import { applyWeeklyReset } from "./leaderboard";
import { decayBloomCapacity } from "./bloom";
import { buildLeaderboard } from "./leaderboard";
import { invalidateOnWeeklyReset } from "./cache";

// ─── Geo validation ──────────────────────────────────────────────────────────

const MYSURU_BOUNDS = {
  lat: { min: 11.8, max: 12.5 },
  lng: { min: 76.4, max: 77.0 },
};

export function isInMysuru(lat: number, lng: number): boolean {
  return (
    lat >= MYSURU_BOUNDS.lat.min && lat <= MYSURU_BOUNDS.lat.max &&
    lng >= MYSURU_BOUNDS.lng.min && lng <= MYSURU_BOUNDS.lng.max
  );
}

// ─── Point validation ─────────────────────────────────────────────────────────

/** Points are always non-negative integers */
export function sanitizePoints(raw: number): number {
  return Math.max(0, Math.floor(raw));
}

/** Bloom capacity is clamped 0–100 */
export function clampBloom(capacity: number): number {
  return Math.max(0, Math.min(100, capacity));
}

// ─── Duplicate check-in guard ─────────────────────────────────────────────────

const IDEMPOTENCY_WINDOW_MS = 2 * 3_600_000; // 2 hours

export function isDuplicateCheckin(
  userId: string,
  gemId: number,
  checkinTimestamps: { userId: string; gemId: number; ts: number }[],
  nowMs?: number
): boolean {
  const now = nowMs ?? Date.now();
  return checkinTimestamps.some(
    (c) => c.userId === userId && c.gemId === gemId && now - c.ts < IDEMPOTENCY_WINDOW_MS
  );
}

// ─── Weekly reset job ─────────────────────────────────────────────────────────

/**
 * Determines if a weekly reset should run for the given stats.
 * Reset runs every Monday 00:00 UTC.
 */
export function shouldRunWeeklyReset(lastResetDate: string, nowISO: string): boolean {
  const now  = new Date(nowISO);
  const last = new Date(lastResetDate);
  // Find the most recent Monday
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = new Date(now);
  lastMonday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  lastMonday.setUTCHours(0, 0, 0, 0);
  return last < lastMonday;
}

export function runWeeklyReset(
  allStats: { userId: string; displayName: string; stats: UserStats }[],
  nowISO: string
): UserStats[] {
  const board = buildLeaderboard(allStats);
  const rankMap = new Map(board.map((e) => [e.userId, e.rank]));

  const updated = allStats.map(({ userId, stats }) => {
    const rank = rankMap.get(userId) ?? 9999;
    return applyWeeklyReset(stats, rank, nowISO);
  });

  invalidateOnWeeklyReset();
  return updated;
}

// ─── Bloom decay job (runs every 6 hours) ─────────────────────────────────────

export function runBloomDecayJob(gems: GemState[], nowMs?: number): GemState[] {
  const now = nowMs ?? Date.now();
  return gems.map((gem) => {
    if (gem.lastVisitTimestamp === null) return gem;
    const hoursSinceVisit = (now - gem.lastVisitTimestamp) / 3_600_000;
    if (hoursSinceVisit < 6) return gem; // decay happens every 6h periods
    const newCapacity = clampBloom(decayBloomCapacity(gem.bloomCapacity, gem.rarityTier, hoursSinceVisit));
    return { ...gem, bloomCapacity: newCapacity };
  });
}

// ─── Safety report expiry job (runs every 30 min) ─────────────────────────────

export function runSafetyExpiryJob(reports: SafetyReport[], nowMs?: number): SafetyReport[] {
  return processExpiredReports(reports, nowMs ?? Date.now());
}

// ─── Submission expiry job (runs daily) ───────────────────────────────────────

export function runSubmissionExpiryJob(submissions: GemSubmission[], nowMs?: number): GemSubmission[] {
  return processExpiredSubmissions(submissions, nowMs ?? Date.now());
}

// ─── Text sanitization ────────────────────────────────────────────────────────

/** Strip HTML tags and apply advanced regex moderation for profanity/spam */
export function sanitizeText(input: string): string {
  // 1. Strip HTML
  let clean = input.replace(/<[^>]*>/g, "").trim();
  
  // 2. Remove common spam URLs (naive regex for demonstration of advanced content filtering)
  clean = clean.replace(/(https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|goo\.gl)[^\s]+)/gi, "[LINK BLOCKED]");
  
  // 3. Basic profanity filter (asterisk replacement)
  const profanities = ["spam", "abuse", "fake", "scam"];
  const regex = new RegExp(`\\b(${profanities.join("|")})\\b`, "gi");
  clean = clean.replace(regex, "****");
  
  return clean;
}

// ─── Streak break check ──────────────────────────────────────────────────────

/**
 * Call daily at 23:55 UTC. If user has no check-in today (and no streak freeze),
 * reset streak to 0 (it will become 1 on their next check-in).
 */
export function checkStreakBreak(stats: UserStats, todayISO: string): UserStats {
  const today = todayISO.slice(0, 10);
  if (stats.lastCheckinDate === today) return stats; // checked in today — streak safe
  if (!stats.lastCheckinDate) return stats;

  const lastDate = new Date(stats.lastCheckinDate);
  const todayDate = new Date(today);
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);

  if (diffDays >= 2) {
    return { ...stats, streakDays: 0 };
  }
  return stats;
}
