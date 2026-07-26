import type { UserStats, Permission } from "./types";
import { LEVELS } from "./points";

// ─── Unlock requirements ──────────────────────────────────────────────────────

const REQUIREMENTS = {
  minAccountAgeDays: 30,
  minGems:           10,
  minCommunityPosts:  3,
  minPostKarma:       5, // per qualifying post
  minXP:           1500, // Level 3 (Sage in our 5-tier, which is index 2 = Pathfinder at 1500)
} as const;

// ─── Eligibility check ────────────────────────────────────────────────────────

export interface LocalModeEligibility {
  eligible: boolean;
  reasons: string[];
}

export function checkLocalModeEligibility(
  stats: UserStats,
  accountAgeDays: number,
  qualifyingPostCount: number // posts with net karma ≥ 5
): LocalModeEligibility {
  const reasons: string[] = [];

  if (accountAgeDays < REQUIREMENTS.minAccountAgeDays) {
    reasons.push(`Account must be ≥${REQUIREMENTS.minAccountAgeDays} days old (${REQUIREMENTS.minAccountAgeDays - accountAgeDays} days remaining).`);
  }
  if (stats.allTimeGems < REQUIREMENTS.minGems) {
    reasons.push(`Need ${REQUIREMENTS.minGems - stats.allTimeGems} more gem check-ins.`);
  }
  if (qualifyingPostCount < REQUIREMENTS.minCommunityPosts) {
    reasons.push(`Need ${REQUIREMENTS.minCommunityPosts - qualifyingPostCount} more community posts with net karma ≥5.`);
  }
  if (stats.totalXP < REQUIREMENTS.minXP) {
    reasons.push(`Need ${REQUIREMENTS.minXP - stats.totalXP} more XP (must reach Level 3 Pathfinder).`);
  }

  return { eligible: reasons.length === 0, reasons };
}

// ─── Permission matrix ────────────────────────────────────────────────────────

/** Returns the full set of permissions for a user */
export function getPermissions(stats: UserStats): Set<Permission> {
  const perms = new Set<Permission>();

  // All users get nothing special in tourist mode
  if (!stats.hasLocalMode) return perms;

  // Local Mode unlocks
  perms.add("submit_safety");
  perms.add("local_leaderboard");
  perms.add("local_expert_eligible");

  // Level 3+ (Pathfinder, index 2)
  const levelIndex = getLevelIndex(stats.totalXP);
  if (levelIndex >= 2) {
    perms.add("submit_gems");
    perms.add("confirm_gems");
    perms.add("create_events");
  }

  // Level 5 (Legend, index 4) = Zone Guardian eligibility
  if (stats.isZoneGuardian) {
    perms.add("zone_guardian");
    perms.add("bloom_boost");
  }

  return perms;
}

export function hasPermission(stats: UserStats, permission: Permission): boolean {
  return getPermissions(stats).has(permission);
}

function getLevelIndex(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i;
  }
  return 0;
}

// ─── Tourist vs Local feature matrix (for display) ───────────────────────────

export interface FeatureRow {
  feature: string;
  tourist: string;
  local: string;
}

export const FEATURE_MATRIX: FeatureRow[] = [
  { feature: "Check in to gems",           tourist: "Yes",             local: "Yes" },
  { feature: "Community posts",            tourist: "Yes",             local: "Yes" },
  { feature: "View events",                tourist: "Yes",             local: "Yes" },
  { feature: "Create events",              tourist: "No",              local: "Yes (Level 3+)" },
  { feature: "Submit gem proposals",       tourist: "No",              local: "Yes (Level 3+)" },
  { feature: "Confirm gem submissions",    tourist: "No",              local: "Yes (Level 3+)" },
  { feature: "Submit safety reports",      tourist: "1/day",           local: "5/day" },
  { feature: "Zone Guardian eligibility",  tourist: "No",              local: "Yes (Level 5)" },
  { feature: "Bloom Boost usage",          tourist: "No",              local: "Zone Guardians only" },
  { feature: "Local-only leaderboard",     tourist: "No",              local: "Yes" },
  { feature: "Local Expert badge",         tourist: "No",              local: "Yes" },
];

// ─── Zone Guardian assignment ─────────────────────────────────────────────────

/** Elect new guardian: highest XP local user in that zone who accepted nomination */
export function electZoneGuardian(
  candidates: { userId: string; xp: number }[]
): string | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.xp - a.xp)[0].userId;
}
