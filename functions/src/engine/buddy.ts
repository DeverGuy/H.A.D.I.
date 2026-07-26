import type { BuddyProfile, BuddyMatchScore, BuddySession, Coords } from "./types";
import { haversineDistance } from "./checkin";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_MATCH_RADIUS_M     = 10_000; // 10 km
const SESSION_DURATION_MS    = 8 * 3_600_000; // 8 hours
const SESSION_JOIN_WINDOW_MS = 5 * 60_000;    // 5 minutes
const BUDDY_EARNINGS_CAP     = 500;            // max pts buddy earns per session
const BUDDY_EARNINGS_PCT     = 0.10;           // buddy earns 10% of explorer's points
const EXPLORER_BONUS_PCT     = 0.50;           // explorer earns +50% during session

// ─── Matching algorithm ────────────────────────────────────────────────────────

export function scoreBuddy(
  buddy: BuddyProfile,
  userCoords: Coords,
  userLanguages: string[],
  userExpertisePrefs: string[],
  preferredBuddyIds: Set<number>
): BuddyMatchScore {
  if (buddy.availability === "Busy") {
    return { buddyId: buddy.id, score: -1, breakdown: { rating: 0, walks: 0, languageMatch: 0, expertiseMatch: 0, verifiedBonus: 0, preferredBonus: 0, distance: 0 } };
  }

  const distM = haversineDistance(userCoords, buddy.coords);
  if (distM > MAX_MATCH_RADIUS_M) {
    return { buddyId: buddy.id, score: -1, breakdown: { rating: 0, walks: 0, languageMatch: 0, expertiseMatch: 0, verifiedBonus: 0, preferredBonus: 0, distance: 0 } };
  }

  const ratingScore     = buddy.rating * 20;
  const walksScore      = Math.min(buddy.walks * 0.1, 50); // capped at 50
  const langMatches     = userLanguages.filter((l) => buddy.languages.includes(l)).length;
  const langScore       = langMatches * 10;
  const expertiseMatches = userExpertisePrefs.filter((e) => buddy.expertise.includes(e)).length;
  const expertiseScore  = expertiseMatches * 15;
  const verifiedBonus   = buddy.verified ? 25 : 0;
  const preferredBonus  = preferredBuddyIds.has(buddy.id) ? 30 : 0;
  const distanceScore   = Math.max(0, 10 - distM / 1000); // closer = higher

  const score = ratingScore + walksScore + langScore + expertiseScore + verifiedBonus + preferredBonus + distanceScore;

  return {
    buddyId: buddy.id,
    score,
    breakdown: { rating: ratingScore, walks: walksScore, languageMatch: langScore, expertiseMatch: expertiseScore, verifiedBonus, preferredBonus, distance: distanceScore },
  };
}

export function rankBuddies(
  buddies: BuddyProfile[],
  userCoords: Coords,
  userLanguages: string[],
  userExpertisePrefs: string[],
  preferredBuddyIds: Set<number>
): BuddyProfile[] {
  const scored = buddies.map((b) => ({
    buddy: b,
    score: scoreBuddy(b, userCoords, userLanguages, userExpertisePrefs, preferredBuddyIds),
  }));

  return scored
    .filter((s) => s.score.score >= 0)
    .sort((a, b) => {
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return b.buddy.reviewCount - a.buddy.reviewCount; // tie-break: more reviews
    })
    .map((s) => s.buddy);
}

// ─── Session management ────────────────────────────────────────────────────────

export function startBuddySession(buddyId: number, explorerId: string, nowMs?: number): BuddySession {
  const now = nowMs ?? Date.now();
  return {
    id: `session_${now}_${Math.random().toString(36).slice(2, 8)}`,
    buddyId,
    explorerId,
    startedAt: now,
    endsAt: now + SESSION_DURATION_MS,
    active: true,
    gemsCheckedIn: [],
  };
}

export function isBuddySessionActive(session: BuddySession | null, nowMs?: number): boolean {
  if (!session || !session.active) return false;
  return (nowMs ?? Date.now()) < session.endsAt;
}

export function endBuddySession(session: BuddySession): BuddySession {
  return { ...session, active: false };
}

export function recordGemInSession(session: BuddySession, gemId: number): BuddySession {
  if (session.gemsCheckedIn.includes(gemId)) return session;
  return { ...session, gemsCheckedIn: [...session.gemsCheckedIn, gemId] };
}

// ─── Point calculations & Geo-fencing ──────────────────────────────────────────

const MAX_BUDDY_DISTANCE_M = 150; // max allowed distance before session rewards pause

export function checkBuddyProximity(explorerCoords: Coords, buddyCoords: Coords): boolean {
  return haversineDistance(explorerCoords, buddyCoords) <= MAX_BUDDY_DISTANCE_M;
}

/** Explorer's check-in points during a buddy session */
export function applyBuddyExplorerBonus(basePoints: number, isWithinRange: boolean = true): number {
  if (!isWithinRange) return basePoints; // No bonus if geo-fence is broken
  return Math.floor(basePoints * (1 + EXPLORER_BONUS_PCT));
}

/** Points the buddy earns from one explorer check-in */
export function calcBuddyEarnings(explorerPointsThisSession: number, newPointsFromCheckin: number, isWithinRange: boolean = true): number {
  if (!isWithinRange) return 0; // Buddy earns nothing if they drifted too far
  const earned = Math.floor(newPointsFromCheckin * BUDDY_EARNINGS_PCT);
  const remaining = BUDDY_EARNINGS_CAP - explorerPointsThisSession;
  return Math.max(0, Math.min(earned, remaining));
}

// ─── Rating ────────────────────────────────────────────────────────────────────

const RECENCY_WEIGHT   = 2;  // last 20 reviews count 2×
const RECENCY_WINDOW   = 20;

export function calcWeightedRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const recent = ratings.slice(-RECENCY_WINDOW);
  const older  = ratings.slice(0, Math.max(0, ratings.length - RECENCY_WINDOW));
  const sumRecent = recent.reduce((s, r) => s + r, 0) * RECENCY_WEIGHT;
  const sumOlder  = older.reduce((s, r) => s + r, 0);
  const totalWeight = recent.length * RECENCY_WEIGHT + older.length;
  return totalWeight > 0 ? Math.round((sumRecent + sumOlder) / totalWeight * 10) / 10 : 0;
}

export function canRateBuddy(sessionEndedAt: number, nowMs?: number): boolean {
  const now = nowMs ?? Date.now();
  return now - sessionEndedAt < 48 * 3_600_000; // 48 h window
}

// ─── Verification ─────────────────────────────────────────────────────────────

export function meetsBuddyVerificationThreshold(buddy: BuddyProfile): boolean {
  return buddy.walks >= 10 && calcWeightedRating(buddy.recentRatings) >= 4.0;
}
