import type { GemRarityTier, MultiplierBreakdown, UserStats } from "./types";

// ─── Rarity base points ────────────────────────────────────────────────────────

const RARITY_BASE: Record<GemRarityTier, number> = {
  Common:    25,
  Uncommon:  50,
  Rare:      100,
  Epic:      200,
  Legendary: 500,
};

export function getBasePoints(tier: GemRarityTier): number {
  return RARITY_BASE[tier];
}

// ─── Streak multiplier ─────────────────────────────────────────────────────────

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 3.0;
  if (streakDays >= 7)  return 2.0;
  if (streakDays >= 3)  return 1.5;
  return 1.0;
}

// ─── Full point calculation ────────────────────────────────────────────────────

export interface PointCalcInput {
  rarityTier: GemRarityTier;
  zoneMultiplier: number;      // from hexmap (1×, 1.5×, 2×, 3×)
  proximityMultiplier: number; // from checkin engine (0.85, 1.0, 1.5)
  bloomMultiplier: number;     // from bloom engine (1.0, 0.75, 0.5)
  streakDays: number;
  buddyActive: boolean;
  weatherMultiplier: number;
}

export function calculatePoints(input: PointCalcInput): MultiplierBreakdown {
  const base        = getBasePoints(input.rarityTier);
  const rarity      = RARITY_BASE[input.rarityTier] / 25; // normalized factor for display
  const zone        = input.zoneMultiplier;
  const proximity   = input.proximityMultiplier;
  const streak      = getStreakMultiplier(input.streakDays);
  const bloom       = input.bloomMultiplier;
  const buddy       = input.buddyActive ? 1.5 : 1.0;
  const weather     = input.weatherMultiplier;

  const total = Math.floor(base * zone * proximity * streak * bloom * buddy * weather);

  return { base, rarity, zone, proximity, streak, bloom, buddy, weather, total };
}

// ─── Levels ────────────────────────────────────────────────────────────────────

export interface LevelDef {
  index: number;
  name: string;
  icon: string;
  minXP: number;
  maxXP: number;
}

export const LEVELS: LevelDef[] = [
  { index: 0, name: "Wanderer",    icon: "🌱", minXP: 0,     maxXP: 500 },
  { index: 1, name: "Explorer",    icon: "🔭", minXP: 500,   maxXP: 1500 },
  { index: 2, name: "Pathfinder",  icon: "🗺️", minXP: 1500,  maxXP: 4000 },
  { index: 3, name: "Sage",        icon: "⚡", minXP: 4000,  maxXP: 10000 },
  { index: 4, name: "Legend",      icon: "🌟", minXP: 10000, maxXP: Infinity },
];

export interface LevelInfo {
  level: LevelDef;
  progress: number;    // 0–100
  ptsToNext: number;
  nextLevel: LevelDef | null;
  didLevelUp: boolean;
}

export function getLevelInfo(xp: number, previousXP?: number): LevelInfo {
  let level = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) { level = LEVELS[i]; break; }
  }
  const nextLevel = LEVELS[level.index + 1] ?? null;
  const range = nextLevel ? nextLevel.minXP - level.minXP : 1;
  const earned = xp - level.minXP;
  const progress = nextLevel ? Math.min(100, Math.round((earned / range) * 100)) : 100;
  const ptsToNext = nextLevel ? nextLevel.minXP - xp : 0;

  let didLevelUp = false;
  if (previousXP !== undefined) {
    const prevLevel = getLevelAt(previousXP);
    didLevelUp = level.index > prevLevel;
  }

  return { level, progress, ptsToNext, nextLevel, didLevelUp };
}

function getLevelAt(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i;
  }
  return 0;
}

// ─── Streak management ─────────────────────────────────────────────────────────

/** Call on every check-in to update streak state. Returns new streak days. */
export function updateStreak(stats: UserStats, nowISO: string): {
  newStreakDays: number;
  wasUpdated: boolean;
} {
  const today = nowISO.slice(0, 10); // "YYYY-MM-DD"
  const last = stats.lastCheckinDate;

  if (!last) return { newStreakDays: 1, wasUpdated: true };
  if (last === today) return { newStreakDays: stats.streakDays, wasUpdated: false }; // already checked in today

  const lastDate = new Date(last);
  const todayDate = new Date(today);
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);

  if (diffDays === 1) {
    return { newStreakDays: stats.streakDays + 1, wasUpdated: true };
  } else {
    // Streak broken
    return { newStreakDays: 1, wasUpdated: true };
  }
}

// ─── Badges ────────────────────────────────────────────────────────────────────

export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bonusPoints: number;
  check: (stats: UserStats) => boolean;
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_step",
    name: "First Step",
    emoji: "👣",
    description: "Check in to your first gem",
    bonusPoints: 50,
    check: (s) => s.allTimeGems >= 1,
  },
  {
    id: "ten_gems",
    name: "10 Gems",
    emoji: "💎",
    description: "Discover 10 unique gems",
    bonusPoints: 200,
    check: (s) => s.allTimeGems >= 10,
  },
  {
    id: "streak_seeker",
    name: "Streak Seeker",
    emoji: "🔥",
    description: "Maintain a 7-day check-in streak",
    bonusPoints: 150,
    check: (s) => s.streakDays >= 7,
  },
  {
    id: "community_voice",
    name: "Community Voice",
    emoji: "🌿",
    description: "Share 5 helpful local tips in the community hub",
    bonusPoints: 300,
    check: (s) => s.communityPosts >= 5,
  },
  {
    id: "buddy_explorer",
    name: "Buddy Explorer",
    emoji: "🤝",
    description: "Complete 5 buddy walks",
    bonusPoints: 250,
    check: (s) => s.buddyWalks >= 5,
  },
  {
    id: "gem_smith",
    name: "Gem Smith",
    emoji: "⚒️",
    description: "Submit 3 accepted gem proposals",
    bonusPoints: 400,
    check: (s) => s.acceptedSubmissions >= 3,
  },
  {
    id: "local_sage",
    name: "Local Sage",
    emoji: "🏠",
    description: "Unlock Local Mode",
    bonusPoints: 100,
    check: (s) => s.hasLocalMode,
  },
];

/** Returns badge IDs newly unlocked after a stats update */
export function checkNewBadges(prev: UserStats, next: UserStats, alreadyUnlocked: Set<string>): string[] {
  const newlyUnlocked: string[] = [];
  for (const badge of BADGE_DEFS) {
    if (!alreadyUnlocked.has(badge.id) && !badge.check(prev) && badge.check(next)) {
      newlyUnlocked.push(badge.id);
    }
  }
  return newlyUnlocked;
}

/** Sum bonus points for a list of badge ids */
export function sumBadgeBonuses(badgeIds: string[]): number {
  return badgeIds.reduce((sum, id) => {
    const def = BADGE_DEFS.find((b) => b.id === id);
    return sum + (def?.bonusPoints ?? 0);
  }, 0);
}
