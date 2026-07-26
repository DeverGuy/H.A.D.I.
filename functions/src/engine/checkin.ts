import type { Coords, CheckinRecord, CheckinResult, GemState, UserStats, WeatherData } from "./types";
import { getBloomStatus, getBloomMultiplier, incrementBloomCapacity } from "./bloom";
import { calculatePoints, updateStreak, getLevelInfo, checkNewBadges } from "./points";
import { getZoneMultiplier } from "./hexmap";
import { allGems } from "../data/gems";
import { calculateSuitabilityMultiplier } from "./weather";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHECKIN_RADIUS_M = 250;
const PRECISION_BONUS_RADIUS_M = 20;
const LOW_ACCURACY_RADIUS_M = 50;
const DUPLICATE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_CHECKINS_PER_HOUR = 10;
const MAX_VELOCITY_M_PER_S = 500 / 90; // ~20km/h straight line. Faster = spoofed
const MAX_GPS_ACCURACY_M = 30;     // reject readings with stated accuracy > 30m

// ─── Haversine distance ────────────────────────────────────────────────────────

export function haversineDistance(a: Coords, b: Coords): number {
  const R = 6_371_000; // metres
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── Proximity multiplier ──────────────────────────────────────────────────────

export function getProximityMultiplier(distanceM: number): number {
  if (distanceM <= PRECISION_BONUS_RADIUS_M) return 1.5;  // ≤20m
  if (distanceM <= LOW_ACCURACY_RADIUS_M)    return 1.0;  // ≤50m
  if (distanceM <= 100)                      return 0.85; // ≤100m
  if (distanceM <= MAX_CHECKIN_RADIUS_M)     return 0.7;  // ≤250m
  return 0; // out of range
}

// ─── Anti-spoofing checks ──────────────────────────────────────────────────────

interface SpoofCheck {
  valid: boolean;
  reason?: string;
}

export function checkVelocitySpoof(
  currentCoords: Coords,
  currentTimestamp: number,
  recentRecords: CheckinRecord[]
): SpoofCheck {
  if (recentRecords.length === 0) return { valid: true };

  // Analyze the last 3 check-ins to detect impossible sliding-window average velocities
  const windowSize = Math.min(3, recentRecords.length);
  const recentWindow = recentRecords
    .filter(r => currentTimestamp - r.timestamp <= DUPLICATE_WINDOW_MS)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, windowSize);

  if (recentWindow.length === 0) return { valid: true };

  for (const record of recentWindow) {
    const timeDeltaMs = currentTimestamp - record.timestamp;
    if (timeDeltaMs <= 0) return { valid: false, reason: "Invalid time delta detected." };
    
    const dist = haversineDistance(currentCoords, record.coords);
    const velocityMps = dist / (timeDeltaMs / 1000); // meters per second

    // If velocity exceeds max threshold for ANY recent record within the window, it's a spoof
    if (velocityMps > MAX_VELOCITY_M_PER_S) {
      return { valid: false, reason: "Location changed too fast relative to recent check-ins — possible GPS spoof detected." };
    }
  }

  return { valid: true };
}

export function checkGPSAccuracy(accuracyM: number): SpoofCheck {
  if (accuracyM > MAX_GPS_ACCURACY_M) {
    return { valid: false, reason: `GPS accuracy too low (${Math.round(accuracyM)}m). Move to an open area.` };
  }
  return { valid: true };
}

export function checkDuplicateCheckin(
  userId: string,
  gemId: number,
  recentRecords: CheckinRecord[],
  nowMs: number
): SpoofCheck {
  const recent = recentRecords.find(
    (r) => r.userId === userId && r.gemId === gemId && nowMs - r.timestamp < DUPLICATE_WINDOW_MS
  );
  if (recent) {
    const waitMin = Math.ceil((DUPLICATE_WINDOW_MS - (nowMs - recent.timestamp)) / 60_000);
    return { valid: false, reason: `Already checked in here recently. Try again in ${waitMin} min.` };
  }
  return { valid: true };
}

export function checkHourlyRateLimit(
  userId: string,
  recentRecords: CheckinRecord[],
  nowMs: number
): SpoofCheck {
  const last1h = recentRecords.filter(
    (r) => r.userId === userId && nowMs - r.timestamp < 3_600_000
  );
  if (last1h.length >= MAX_CHECKINS_PER_HOUR) {
    return { valid: false, reason: "Check-in limit reached (10/hour). Slow down, explorer!" };
  }
  return { valid: true };
}

// ─── Salted QR Hashing for dead-zone Failsafe (Advanced cyrb53) ──────────────────

const HADI_QR_SALT = "sandalwood_artisan_quarter_2026_v2";

/**
 * Advanced synchronous 53-bit hash (cyrb53)
 * Provides high collision resistance and avalanche effect compared to simple loops.
 */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Generates a time-sensitive salted hash QR string for a specific Gem.
 * Uses 5-minute buckets to maintain security and allow offline validation.
 */
export function generateGemQR(gemId: number, nowMs: number): string {
  const timeBucket = Math.floor(nowMs / (5 * 60 * 1000)); // 5-minute blocks
  const hashInput = `${gemId}-${timeBucket}-${HADI_QR_SALT}`;
  const hexHash = cyrb53(hashInput);
  return `HADI-QR-${gemId}-${timeBucket}-${hexHash}`;
}

/**
 * Verifies a time-sensitive salted QR string against a target Gem ID.
 * Allows +/- 1 bucket tolerance (15 mins total) to account for time drift.
 */
export function verifyGemQR(qrString: string, gemId: number, nowMs: number): boolean {
  if (!qrString) return false;
  
  // Format should match: HADI-QR-gemId-timeBucket-hash
  const parts = qrString.split("-");
  if (parts.length !== 5 || parts[0] !== "HADI" || parts[1] !== "QR") return false;

  const parsedGemId = parseInt(parts[2], 10);
  const parsedTimeBucket = parseInt(parts[3], 10);
  const providedHash = parts[4];

  if (parsedGemId !== gemId) return false;

  const currentTimeBucket = Math.floor(nowMs / (5 * 60 * 1000));
  
  // Accept current, previous, or next bucket (+/- 1 bucket)
  const isTimeValid = Math.abs(currentTimeBucket - parsedTimeBucket) <= 1;
  if (!isTimeValid) return false;

  // Re-verify the salted hash using the parsed timeBucket
  const hashInput = `${gemId}-${parsedTimeBucket}-${HADI_QR_SALT}`;
  const hexHash = cyrb53(hashInput);

  return hexHash === providedHash;
}

// ─── Main verify function ──────────────────────────────────────────────────────

export interface VerifyCheckinInput {
  userCoords: Coords;
  gpsAccuracy: number;
  method: "gps" | "qr";
  gem: GemState;
  stats: UserStats;
  isBuddyActive: boolean;
  unlockedBadges: Set<string>;
  recentRecords: CheckinRecord[];
  lastRecord: CheckinRecord | null;
  nowMs?: number;
  nowISO?: string;
  qrString?: string;
  weather: WeatherData;
}

export function verifyCheckin(input: VerifyCheckinInput): CheckinResult {
  const now = input.nowMs ?? Date.now();
  const nowISO = input.nowISO ?? new Date(now).toISOString();

  // ── GPS-only validations (skip for QR) ────────────────────────────────────
  if (input.method === "gps") {
    const acc = checkGPSAccuracy(input.gpsAccuracy);
    if (!acc.valid) return { valid: false, reason: acc.reason };

    const vel = checkVelocitySpoof(input.userCoords, now, input.recentRecords);
    if (!vel.valid) return { valid: false, reason: vel.reason };
  }

  // ── QR code verification ──────────────────────────────────────────────────
  if (input.method === "qr") {
    if (!input.qrString) {
      return { valid: false, reason: "QR code verification failed: No QR string provided." };
    }
    const isQRValid = verifyGemQR(input.qrString, input.gem.id, now);
    if (!isQRValid) {
      return { valid: false, reason: "Decryption failed: Invalid, tampered, or expired HADI QR sticker hash." };
    }
  }

  // ── Duplicate & rate limit (both methods) ─────────────────────────────────
  const dup = checkDuplicateCheckin(input.stats.userId, input.gem.id, input.recentRecords, now);
  if (!dup.valid) return { valid: false, reason: dup.reason };

  const rate = checkHourlyRateLimit(input.stats.userId, input.recentRecords, now);
  if (!rate.valid) return { valid: false, reason: rate.reason };

  // ── Distance check ────────────────────────────────────────────────────────
  const distance = input.method === "qr"
    ? 0  // QR bypasses distance
    : haversineDistance(input.userCoords, input.gem.coords);

  const proximityMultiplier = input.method === "qr" ? 1.0 : getProximityMultiplier(distance);
  if (proximityMultiplier === 0) {
    return { valid: false, reason: `Too far from gem (${Math.round(distance)}m). Move within 250m.`, distance };
  }

  // ── Bloom check ───────────────────────────────────────────────────────────
  const currentBloomStatus = getBloomStatus(input.gem.bloomCapacity);
  if (currentBloomStatus === "Dormant") {
    return { valid: false, reason: "This gem is Dormant — too many recent visitors. Come back later." };
  }
  const bloomMultiplier = getBloomMultiplier(currentBloomStatus);

  // ── Zone multiplier ───────────────────────────────────────────────────────
  const zoneMultiplier = getZoneMultiplier(input.gem.digipinCode);

  // ── Weather multiplier ────────────────────────────────────────────────────
  const gemData = allGems.find((g) => g.id === input.gem.id);
  // Default to outdoor exposed if gem not found (e.g., dynamically submitted community gem)
  const weatherProfile = gemData?.weatherProfile ?? {
    type: "OUTDOOR_EXPOSED",
    idealConditions: ["sunny", "partly_cloudy"],
    riskConditions: ["heavy_thunderstorm", "light_rain"]
  };
  const weatherMultiplier = calculateSuitabilityMultiplier(input.weather, weatherProfile);

  // ── Streak ────────────────────────────────────────────────────────────────
  const { newStreakDays, wasUpdated: streakUpdated } = updateStreak(input.stats, nowISO);

  // ── Point calculation ─────────────────────────────────────────────────────
  const breakdown = calculatePoints({
    rarityTier: input.gem.rarityTier,
    zoneMultiplier,
    proximityMultiplier,
    bloomMultiplier,
    streakDays: newStreakDays,
    buddyActive: input.isBuddyActive,
    weatherMultiplier,
  });

  // ── Bloom capacity update ─────────────────────────────────────────────────
  const newBloomCapacity = incrementBloomCapacity(input.gem.bloomCapacity, input.gem.rarityTier);
  const newBloomStatus   = getBloomStatus(newBloomCapacity);

  // ── Level & badge changes ─────────────────────────────────────────────────
  const prevXP = input.stats.totalXP;
  const nextXP = prevXP + breakdown.total;
  const { level: newLevel, didLevelUp } = getLevelInfo(nextXP, prevXP);

  const nextStats: UserStats = {
    ...input.stats,
    totalXP: nextXP,
    weeklyScore: input.stats.weeklyScore + breakdown.total,
    weeklyGems: input.stats.weeklyGems + 1,
    allTimeGems: input.stats.allTimeGems + 1,
    streakDays: newStreakDays,
    lastCheckinDate: nowISO.slice(0, 10),
    firstCheckinOfWeekTimestamp: input.stats.firstCheckinOfWeekTimestamp ?? now,
  };

  const badgesUnlocked = checkNewBadges(input.stats, nextStats, input.unlockedBadges);

  return {
    valid: true,
    distance,
    proximityMultiplier,
    pointsAwarded: breakdown.total,
    breakdown,
    newBloomCapacity,
    newBloomStatus,
    badgesUnlocked,
    levelUp: didLevelUp,
    newLevel: didLevelUp ? newLevel.name : undefined,
    streakUpdated,
    newStreakDays,
  };
}
