// ─── Shared primitive types ────────────────────────────────────────────────────

export type GemRarityTier = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export type BloomStatus = "Active" | "Fading" | "Critical" | "Dormant";
export type GemCategory = "Art" | "Food" | "Stay" | "Temples" | "Crafts" | "Streets" | "Heritage" | "Nature";
export type HexStatus = "explored" | "active" | "gem" | "locked";
export type AvailabilityStatus = "Available" | "Busy" | "Today";
export type ReportType = "Physical Hazard" | "High Crowd" | "Temporary Closure" | "Road Obstruction" | "Lighting Issue" | "Animal Presence" | "Flooding";
export type ReportStatus = "Unconfirmed" | "Confirmed" | "Dismissed" | "Expired";
export type SubmissionStatus = "Pending" | "Accepted" | "Rejected" | "NeedsReview";
export type NotificationType = "checkin" | "points" | "badge" | "levelup" | "buddy_request" | "safety_confirmed" | "gem_accepted" | "event_reminder" | "post_upvoted" | "leaderboard" | "bloom_changed";
export type Permission = "create_events" | "submit_gems" | "confirm_gems" | "submit_safety" | "zone_guardian" | "bloom_boost" | "local_leaderboard" | "local_expert_eligible";
export type PostCategory = "All Posts" | "Local Tips" | "Safety Notes" | "Hidden Finds";

// ─── Weather ───────────────────────────────────────────────────────────────────

export type WeatherCondition = "clear" | "partly_cloudy" | "light_rain" | "heavy_rain" | "heavy_thunderstorm";
export type WeatherProfileType = "OUTDOOR_EXPOSED" | "OUTDOOR_SHELTERED" | "INDOOR_SAFE";

export interface WeatherData {
  condition: WeatherCondition;
  temperature: number; // Celsius
  precipitationChance: number; // 0-100
  uvIndex: number;
}

export interface WeatherProfile {
  type: WeatherProfileType;
  idealConditions: WeatherCondition[];
  riskConditions: WeatherCondition[];
}

// ─── Geo ────────────────────────────────────────────────────────────────────────

export interface Coords {
  lat: number;
  lng: number;
}

// ─── User / Profile ────────────────────────────────────────────────────────────

export interface UserStats {
  userId: string;
  totalXP: number;
  weeklyScore: number;
  weeklyGems: number;              // unique gems this week
  allTimeGems: number;             // total unique gems ever
  streakDays: number;
  lastCheckinDate: string | null;  // ISO date string "YYYY-MM-DD"
  weeklyResetDate: string;         // ISO date of last weekly reset
  buddyWalks: number;
  communityPosts: number;
  acceptedSubmissions: number;
  karma: number;
  hasLocalMode: boolean;
  isZoneGuardian: boolean;
  guardianZone: string | null;
  firstCheckinOfWeekTimestamp: number | null; // ms since epoch, for tie-breaking
  pointsRedeemed?: number; // total points spent on rewards
}

// ─── Gem ────────────────────────────────────────────────────────────────────────

export interface GemState {
  id: number;
  rarityTier: GemRarityTier;
  bloomCapacity: number;  // 0–100
  lastVisitTimestamp: number | null; // ms since epoch
  digipinCode: string;
  coords: Coords;
  category: GemCategory;
  basePoints: number;
}

// ─── Check-in ──────────────────────────────────────────────────────────────────

export interface CheckinRecord {
  id: string;
  userId: string;
  gemId: number;
  timestamp: number;
  coords: Coords;
  accuracy: number;          // metres
  method: "gps" | "qr";
  pointsAwarded: number;
  multiplierBreakdown: MultiplierBreakdown;
}

export interface MultiplierBreakdown {
  base: number;
  rarity: number;
  zone: number;
  proximity: number;
  streak: number;
  bloom: number;
  buddy: number;
  weather: number;
  total: number;
}

export interface CheckinResult {
  valid: boolean;
  reason?: string;
  distance?: number;        // metres
  proximityMultiplier?: number;
  pointsAwarded?: number;
  breakdown?: MultiplierBreakdown;
  newBloomCapacity?: number;
  newBloomStatus?: BloomStatus;
  badgesUnlocked?: string[];
  levelUp?: boolean;
  newLevel?: string;
  streakUpdated?: boolean;
  newStreakDays?: number;
}

// ─── Community ─────────────────────────────────────────────────────────────────

export interface CommunityPostComment {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
}

export interface CommunityPost {
  id: number;
  authorId: string;
  category: PostCategory;
  body: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  score: number;           // upvotes - downvotes
  votes: Record<string, "up" | "down">; // userId -> direction
  imageUrl?: string;
  comments?: CommunityPostComment[]; // new comments field
}

export interface VoteResult {
  newUpvotes: number;
  newDownvotes: number;
  newScore: number;
  karmaChange: number;     // awarded to author
  autoHidden: boolean;     // score < -5
}

// ─── Safety ────────────────────────────────────────────────────────────────────

export interface SafetyReport {
  id: string;
  reporterId: string;
  type: ReportType;
  coords: Coords;
  gemId?: number;
  description: string;
  status: ReportStatus;
  confirmations: string[]; // user ids
  dismissals: string[];    // user ids
  createdAt: number;       // ms epoch
  expiresAt: number;       // ms epoch
  extendedBy: number;      // times extended
}

// ─── Hex Map ───────────────────────────────────────────────────────────────────

export interface ZoneDef {
  id: string;
  name: string;
  digipinCode: string;
  polygon?: Coords[];
  totalGems: number;
  multiplier: number;
  unlockRequirement: ZoneUnlockReq;
}

export interface ZoneUnlockReq {
  type: "none" | "gems_in_zone" | "level" | "badge";
  zoneId?: string;
  gemCount?: number;
  level?: number;
  badge?: string;
}

export interface ZoneProgress {
  zoneId: string;
  visitedGems: number;
  totalGems: number;
  completionPct: number;
  unlocked: boolean;
  masterBadgeEarned: boolean;
}

// ─── Buddy ─────────────────────────────────────────────────────────────────────

export interface BuddyProfile {
  id: number;
  name: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  walks: number;
  languages: string[];
  expertise: string[];
  availability: AvailabilityStatus;
  coords: Coords;
  recentRatings: number[]; // last 20 ratings
}

export interface BuddySession {
  id: string;
  buddyId: number;
  explorerId: string;
  startedAt: number;
  endsAt: number;
  active: boolean;
  gemsCheckedIn: number[];
}

export interface BuddyMatchScore {
  buddyId: number;
  score: number;
  breakdown: {
    rating: number;
    walks: number;
    languageMatch: number;
    expertiseMatch: number;
    verifiedBonus: number;
    preferredBonus: number;
    distance: number;
  };
}

// ─── Events ────────────────────────────────────────────────────────────────────

export interface EventState {
  id: number;
  linkedGemIds: number[];
  rsvps: string[];          // user ids
  waitlist: string[];
  capacity: number;
  startTime: number;        // ms epoch
  endTime: number;
}

export interface RsvpResult {
  success: boolean;
  position: "confirmed" | "waitlist" | "full";
  message: string;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
  urgent: boolean; // < 24h
}

// ─── Gem Submission ────────────────────────────────────────────────────────────

export interface GemSubmission {
  id: string;
  submitterId: string;
  name: string;
  description: string;
  whyHidden: string;
  category: GemCategory;
  coords: Coords;
  photos: string[];
  bestTimeToVisit?: string;
  safetyNote?: string;
  status: SubmissionStatus;
  confirmations: string[];  // user ids
  flags: string[];          // user ids
  createdAt: number;
  expiresAt: number;        // 14 days from creation
  guardianReviewBy?: number; // deadline if flagged
}

export interface SubmissionValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  weeklyScore: number;
  uniqueGems: number;
  streakDays: number;
  firstCheckinTimestamp: number | null;
  allTimeXP: number;
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  priority: "critical" | "high" | "medium" | "low";
  data?: Record<string, unknown>;
}

export interface ActivityEntry {
  id: string;
  emoji: string;
  text: string;
  points?: string;
  timestamp: number;
  type: NotificationType;
}

// ─── Cache ─────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number; // ms
}
