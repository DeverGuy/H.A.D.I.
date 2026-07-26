import type { BloomStatus, GemRarityTier, GemState } from "./types";

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  fading:  41,  // capacity > 40 → Fading
  critical: 71, // capacity > 70 → Critical
  dormant:  91, // capacity > 90 → Dormant
};

// ─── Capacity increment per check-in by rarity ─────────────────────────────────

const CHECKIN_INCREMENT: Record<GemRarityTier, number> = {
  Common:    4.0,
  Uncommon:  3.0,
  Rare:      2.5,
  Epic:      2.0,
  Legendary: 1.0,
};

// ─── Recovery rate per 24 h of no visits ──────────────────────────────────────
// Legendary gems recover 2× faster than Common

const DECAY_PER_24H: Record<GemRarityTier, number> = {
  Common:    2.0,
  Uncommon:  2.5,
  Rare:      3.0,
  Epic:      3.5,
  Legendary: 4.0,
};

// ─── Core functions ────────────────────────────────────────────────────────────

export function getBloomStatus(capacity: number): BloomStatus {
  if (capacity >= THRESHOLDS.dormant)  return "Dormant";
  if (capacity >= THRESHOLDS.critical) return "Critical";
  if (capacity >= THRESHOLDS.fading)   return "Fading";
  return "Active";
}

export function getBloomColor(status: BloomStatus): string {
  switch (status) {
    case "Active":   return "#22c55e";
    case "Fading":   return "#f59e0b";
    case "Critical": return "#ef4444";
    case "Dormant":  return "#9ca3af";
  }
}

/** How many points this bloom status multiplies the base award by */
export function getBloomMultiplier(status: BloomStatus): number {
  switch (status) {
    case "Active":   return 1.0;
    case "Fading":   return 0.75;
    case "Critical": return 0.5;
    case "Dormant":  return 0.0; // check-in blocked upstream
  }
}

/** Apply one check-in to a gem's capacity; returns new clamped capacity */
export function incrementBloomCapacity(current: number, tier: GemRarityTier): number {
  return Math.min(100, current + CHECKIN_INCREMENT[tier]);
}

/**
 * Apply time-based decay (called by scheduler / on load).
 * Pass the number of hours since the gem's last check-in.
 */
export function decayBloomCapacity(current: number, tier: GemRarityTier, hoursSinceLastVisit: number): number {
  const decayPer6h = DECAY_PER_24H[tier] / 4;
  const periods    = Math.floor(hoursSinceLastVisit / 6);
  const decayed    = current - decayPer6h * periods;
  return Math.max(0, decayed);
}

/**
 * Recalculate bloom capacity from the stored gem state to now.
 * Use this on app load / screen open to get up-to-date status.
 */
export function recalcBloomNow(gem: GemState): { capacity: number; status: BloomStatus } {
  if (gem.lastVisitTimestamp === null) {
    const capacity = gem.bloomCapacity;
    return { capacity, status: getBloomStatus(capacity) };
  }
  const hoursElapsed = (Date.now() - gem.lastVisitTimestamp) / 3_600_000;
  const capacity = decayBloomCapacity(gem.bloomCapacity, gem.rarityTier, hoursElapsed);
  return { capacity, status: getBloomStatus(capacity) };
}

/** Bloom Boost: Zone Guardian power — restores 20% capacity, once per gem per month */
export function applyBloomBoost(current: number): number {
  return Math.max(0, current - 20);
}

/** After an event at this gem, capacity resets to 0 */
export function resetBloomAfterEvent(): number {
  return 0;
}
