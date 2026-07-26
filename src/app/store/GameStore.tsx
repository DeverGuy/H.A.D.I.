/**
 * GameStore — the single source of truth for all game logic.
 *
 * This context wraps the entire app and exposes hooks consumed by screens.
 * All 14 engine modules are wired together here.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from "react";
import { firebaseAuth } from "../lib/firebase";
import {
  getUserDoc, createUserDoc, updateUserStats, updateUserMeta,
  getUserCheckins, getUserActivity,
  addCheckin as fsAddCheckin,
  addActivity as fsAddActivity,
  subscribeToCommunityPosts, addCommunityPost, updateCommunityPost,
  subscribeToSafetyReports, addSafetyReport as fsAddSafetyReport, updateSafetyReport as fsUpdateSafetyReport,
  subscribeToEvents, updateEvent as fsUpdateEvent,
  subscribeToSubmissions, addSubmission as fsAddSubmission, updateSubmission as fsUpdateSubmission,
  subscribeToLeaderboard, upsertLeaderboardEntry,
  runSeedIfNeeded,
  type LeaderboardUserDoc,
} from "../lib/firestore";

import type {
  UserStats, GemState, CheckinRecord, CommunityPost, SafetyReport,
  GemSubmission, EventState, BuddySession, AppNotification, ActivityEntry,
  Coords, ReportType, GemCategory, NotificationType,
} from "../engine/types";

// ── Engines ──────────────────────────────────────────────────────────────────
import { calculatePoints, getLevelInfo, updateStreak, checkNewBadges, BADGE_DEFS, sumBadgeBonuses } from "../engine/points";
import { recalcBloomNow, incrementBloomCapacity, applyBloomBoost, getBloomStatus, getBloomColor } from "../engine/bloom";
import BloomWorker from "../engine/bloom.worker?worker";

const bloomWorker = new BloomWorker();
import { verifyCheckin, haversineDistance, getProximityMultiplier } from "../engine/checkin";
import { getZoneMultiplier, ZONE_DEFS, isZoneUnlocked, getZoneCompletion } from "../engine/hexmap";
import { castVote, calculateKarma, checkLocalExpertEligibility } from "../engine/community";
import { createReport, confirmReport, dismissReport, extendReport, processExpiredReports, canSubmitReport, findDuplicateReport } from "../engine/safety";
import { rankBuddies, startBuddySession, endBuddySession, isBuddySessionActive, recordGemInSession, calcBuddyEarnings } from "../engine/buddy";
import { toggleRsvp, getCountdown, validateEventCreation } from "../engine/events";
import { validateSubmission, createSubmission, confirmSubmission, flagSubmission } from "../engine/submission";
import { buildLeaderboard, applyWeeklyReset } from "../engine/leaderboard";
import { checkLocalModeEligibility, getPermissions, hasPermission } from "../engine/localmode";
import { createNotification, createActivityEntry, pruneOldNotifications, pruneOldActivity, markRead, markAllRead, getUnreadCount, notifyCheckin, notifyBadge, notifyLevelUp, notifyGemAccepted, notifySafetyConfirmed, notifyBloomChanged } from "../engine/notifications";
import { shouldRunWeeklyReset, runBloomDecayJob, runSafetyExpiryJob, runSubmissionExpiryJob, checkStreakBreak, sanitizeText, clampBloom } from "../engine/consistency";
import { localStorage_, LSKey, appCache, CacheKey, TTL, invalidateAfterCheckin, invalidateAfterSafetyChange } from "../engine/cache";
import { useGems, usePlaces } from "../data/api";
import { usePlayerStore } from "./usePlayerStore";
import { useAuth } from "../context/AuthContext";
import type { GemData } from "../data/api";
import type { Place as PlaceData } from "../data/places";
import { calculateSuitabilityMultiplier } from "../engine/weather";
import { syncEngine } from "../engine/sync";
import type { WeatherData } from "../engine/types";

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_USER_ID = "user_hemanth";

/** Returns the ISO date string (YYYY-MM-DD) of the most recent Monday. */
function currentWeekMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function seedStats(): UserStats {
  return {
    userId:      SEED_USER_ID,
    totalXP:     100,
    weeklyScore: 100,
    weeklyGems:  0,
    allTimeGems: 0,
    streakDays:  0,
    lastCheckinDate: null,
    weeklyResetDate: currentWeekMonday(),
    buddyWalks:  0,
    communityPosts: 0,
    acceptedSubmissions: 0,
    karma:       0,
    hasLocalMode: false,
    isZoneGuardian: false,
    guardianZone: null,
    firstCheckinOfWeekTimestamp: null,
  };
}



// ─── Context type ─────────────────────────────────────────────────────────────

interface GameContextType {
  // ── Database ──────────────────────────────────────────────────────────────
  allGems: GemData[];
  allPlaces: PlaceData[];

  // ── User ─────────────────────────────────────────────────────────────────
  stats: UserStats;
  levelInfo: ReturnType<typeof getLevelInfo>;
  unlockedBadges: Set<string>;
  permissions: Set<string>;

  // ── Gems ──────────────────────────────────────────────────────────────────
  gemStates: Map<number, GemState>;
  getGemBloom: (id: number) => Promise<{ capacity: number; status: ReturnType<typeof getBloomStatus>; color: string }>;

  // ── Check-in ──────────────────────────────────────────────────────────────
  checkinRecords: CheckinRecord[];
  visitedGemIds: Set<number>;
  doCheckin: (gemId: number, method: "gps" | "qr", userCoords?: Coords, gpsAccuracy?: number, qrString?: string) => CheckinResult_Public;
  lastCheckinResult: CheckinResult_Public | null;

  // ── Community ─────────────────────────────────────────────────────────────
  communityPosts: CommunityPost[];
  vote: (postId: number, direction: "up" | "down") => void;
  submitPost: (body: string, category: CommunityPost["category"], imageUrl?: string) => { ok: boolean; error?: string };
  addComment: (postId: number, text: string) => { ok: boolean; error?: string };
  localExpertStatus: ReturnType<typeof checkLocalExpertEligibility>;

  // ── Safety ────────────────────────────────────────────────────────────────
  safetyReports: SafetyReport[];
  submitSafetyReport: (type: ReportType, coords: Coords, description: string, gemId?: number) => { ok: boolean; error?: string };
  confirmSafetyReport: (reportId: string) => void;
  dismissSafetyReport: (reportId: string) => void;
  extendSafetyReport: (reportId: string) => void;

  // ── Hex Map / Zones ───────────────────────────────────────────────────────
  zoneProgress: ReturnType<typeof getZoneCompletion>[];
  isZoneUnlockedFn: (zoneId: string) => boolean;

  // ── Buddy ─────────────────────────────────────────────────────────────────
  buddySession: BuddySession | null;
  isBuddyActive: boolean;
  startBuddy: (buddyId: number) => void;
  endBuddy: () => void;

  // ── Events ────────────────────────────────────────────────────────────────
  eventStates: Map<number, EventState>;
  rsvpEvent: (eventId: number) => { ok: boolean; message: string };
  getCountdownFn: (startMs: number) => ReturnType<typeof getCountdown>;

  // ── Submissions ───────────────────────────────────────────────────────────
  submissions: GemSubmission[];
  submitGem: (data: SubmitGemInput) => { ok: boolean; errors?: string[] };
  confirmGemSubmission: (submissionId: string) => void;
  flagGemSubmission: (submissionId: string) => void;

  // ── Rewards ───────────────────────────────────────────────────────────────
  redeemPoints: (amount: number, rewardName: string) => { ok: boolean; message: string };

  // ── Leaderboard ───────────────────────────────────────────────────────────
  leaderboard: ReturnType<typeof buildLeaderboard>;

  // ── Local Mode ────────────────────────────────────────────────────────────
  localModeEligibility: ReturnType<typeof checkLocalModeEligibility>;
  activateLocalMode: () => void;

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: AppNotification[];
  activityLog: ActivityEntry[];
  unreadCount: number;
  markNotifRead: (id: string) => void;
  markAllNotifsRead: () => void;

  // ── Bloom boost (zone guardian) ────────────────────────────────────────────
  applyBloomBoostFn: (gemId: number) => void;

  // ── Weather ───────────────────────────────────────────────────────────────
  currentWeather: WeatherData;
  setMockWeather: (weather: WeatherData) => void;
  getGemSuitability: (gemId: number) => number;
}

interface CheckinResult_Public {
  valid: boolean;
  reason?: string;
  pointsAwarded?: number;
  newBloomStatus?: string;
  badgesUnlocked?: string[];
  levelUp?: boolean;
  newLevel?: string;
  streakUpdated?: boolean;
  newStreakDays?: number;
}

export interface SubmitGemInput {
  name: string;
  description: string;
  whyHidden: string;
  category: GemCategory | "";
  coords: Coords | null;
  photos: string[];
  bestTimeToVisit?: string;
  safetyNote?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  // ── Core state ─────────────────────────────────────────────────────────────
  const stats = usePlayerStore((state) => state.stats);
  const setStats = usePlayerStore((state) => state.setStats);
  const unlockedBadges = usePlayerStore((state) => state.unlockedBadges);
  const setUnlockedBadges = usePlayerStore((state) => state.setUnlockedBadges);
  
  const { data: allGems = [] } = useGems();
  const { data: allPlaces = [] } = usePlaces();

  const [gemStates, setGemStates] = useState<Map<number, GemState>>(new Map());
  
  const checkinRecords = usePlayerStore((state) => state.checkinRecords);
  const setCheckinRecords = usePlayerStore((state) => state.setCheckinRecords);
  const visitedGemIds = usePlayerStore((state) => state.visitedGemIds);
  const setVisitedGemIds = usePlayerStore((state) => state.setVisitedGemIds);

  useEffect(() => {
    if (allGems.length === 0 || allPlaces.length === 0) return;
    const placeCoords: Record<number, { lat: number; lng: number }> = {};
    for (const p of allPlaces) {
      if (p.lat != null && p.lng != null) placeCoords[p.id] = { lat: p.lat, lng: p.lng };
    }
    const map = new Map<number, GemState>();
    for (const g of allGems) {
      const realCoords = placeCoords[g.id] ?? { lat: 12.3052, lng: 76.6551 };
      map.set(g.id, {
        id: g.id,
        rarityTier: g.rarityTier,
        bloomCapacity: g.bloomCapacity,
        lastVisitTimestamp: null,
        digipinCode: g.digipinCode,
        coords: realCoords,
        category: g.category,
        basePoints: g.points,
      });
    }
    setGemStates(map);
  }, [allGems, allPlaces]);

  // ── Weather state ──────────────────────────────────────────────────────────
  const [currentWeather, setMockWeather] = useState<WeatherData>({
    condition: "clear",
    temperature: 30,
    precipitationChance: 10,
    uvIndex: 6,
  });

  const getGemSuitability = useCallback((gemId: number) => {
    const gemData = allGems.find((g) => g.id === gemId);
    if (!gemData) return 1.0;
    return calculateSuitabilityMultiplier(currentWeather, gemData.weatherProfile);
  }, [currentWeather]);

  // ── Community state ────────────────────────────────────────────────────────
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([
    { id: 1, authorId: "user_kavitha", category: "Hidden Finds", body: "Just found the most incredible rangoli painted in a tiny alleyway off Sayyaji Rao Road! The artist starts at 4am every day.", timestamp: Date.now() - 7200000, upvotes: 42, downvotes: 0, score: 42, votes: {} },
    { id: 2, authorId: "user_ravi",    category: "Safety Notes", body: "Safety note: The eastern entrance to Devaraja Market has a large crowd near the textile section. Recommend using the northern gate instead.", timestamp: Date.now() - 18000000, upvotes: 28, downvotes: 2, score: 26, votes: {} },
    { id: 3, authorId: "user_meena",   category: "Local Tips",   body: "Hidden tip: Iyer's Idli Corner in Agrahara Lane — they serve only 50 plates every morning. Go before 7am.", timestamp: Date.now() - 86400000, upvotes: 87, downvotes: 1, score: 86, votes: {} },
  ]);

  // ── Safety state ───────────────────────────────────────────────────────────
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);

  // ── Buddy state ───────────────────────────────────────────────────────────
  const [buddySession, setBuddySession] = useState<BuddySession | null>(null);

  // ── Event state ────────────────────────────────────────────────────────────
  const [eventStates, setEventStates] = useState<Map<number, EventState>>(() => {
    const m = new Map<number, EventState>();
    [1,2,3,4,5,6].forEach((id) => m.set(id, {
      id,
      linkedGemIds: [id % allGems.length + 1],
      rsvps: [],
      waitlist: [],
      capacity: 60,
      startTime: Date.now() + (id * 2 + 1) * 86_400_000,
      endTime:   Date.now() + (id * 2 + 1) * 86_400_000 + 3 * 3_600_000,
    }));
    return m;
  });

  // ── Submissions state ──────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState<GemSubmission[]>([]);

  // ── Notifications state ────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    return localStorage_.get<AppNotification[]>(LSKey.notifications) ?? [];
  });

  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() => {
    return localStorage_.get<ActivityEntry[]>(LSKey.activityLog) ?? [];
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const levelInfo = getLevelInfo(stats.totalXP);
  const permissions = getPermissions(stats) as unknown as Set<string>;
  const isBuddyActive = isBuddySessionActive(buddySession);
  const unreadCount = getUnreadCount(notifications);

  const localModeEligibility = checkLocalModeEligibility(
    stats,
    30, // account age days (would come from auth in real app)
    communityPosts.filter(
      (p) => p.authorId === stats.userId && p.score >= 5
    ).length
  );

  const localExpertStatus = checkLocalExpertEligibility(
    stats,
    communityPosts,
    30
  );

  // ── Live Firestore leaderboard entries ───────────────────────────────────
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardUserDoc[]>([]);

  // ── Firestore initialisation (runs once per authenticated session) ────────
  useEffect(() => {
    if (!userId) return;
    const auth = firebaseAuth.currentUser;

    // Seed community data if Firestore is empty
    runSeedIfNeeded();

    // Load or create user doc
    getUserDoc(userId).then((userDoc) => {
      if (userDoc?.stats) {
        // Merge with seedStats defaults so no field is ever undefined
        setStats({ ...seedStats(), ...userDoc.stats, userId });
        setUnlockedBadges(new Set(userDoc.badges ?? []));
        setVisitedGemIds(new Set(userDoc.visitedGems ?? []));
      } else {
        // Load vibes from localStorage
        let initialVibes: string[] = [];
        try {
          const raw = localStorage.getItem("hadi_user_vibes");
          if (raw) initialVibes = JSON.parse(raw);
        } catch {}

        // New user → create Firestore record
        createUserDoc(userId, {
          displayName: auth?.displayName ?? "Explorer",
          email: auth?.email ?? "",
          photoURL: auth?.photoURL ?? null,
          stats,
          badges: [],
          visitedGems: [],
          savedGems: [],
          selectedVibes: initialVibes,
        });
      }
    });

    // Load checkins
    getUserCheckins(userId).then((records) => {
      if (records.length > 0) setCheckinRecords(records.slice(-200));
    });

    // Load activity log
    getUserActivity(userId).then((entries) => {
      if (entries.length > 0) setActivityLog(entries.slice(-200));
    });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      subscribeToCommunityPosts((posts) => { if (posts.length > 0) setCommunityPosts(posts); }),
      subscribeToSafetyReports((reports) => setSafetyReports(reports)),
      subscribeToEvents((eventDocs) => {
        setEventStates((prev) => {
          const m = new Map(prev);
          eventDocs.forEach((e) => {
            m.set(e.id, {
              id: e.id,
              linkedGemIds: e.linkedGemIds,
              rsvps: e.rsvps,
              waitlist: e.waitlist,
              capacity: e.capacity,
              startTime: e.startTime,
              endTime: e.endTime,
            } as EventState);
          });
          return m;
        });
      }),
      subscribeToSubmissions((subs) => setSubmissions(subs)),
      subscribeToLeaderboard((entries) => setLiveLeaderboard(entries)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Persistence (localStorage + Firestore dual-write) ─────────────────────
  // Local storage is synchronous and fast
  useEffect(() => { localStorage_.set(LSKey.userStats, stats); }, [stats]);
  useEffect(() => { localStorage_.set(LSKey.visitedGems, [...visitedGemIds]); }, [visitedGemIds]);
  useEffect(() => { localStorage_.set(LSKey.unlockedBadges, [...unlockedBadges]); }, [unlockedBadges]);
  useEffect(() => { localStorage_.set(LSKey.checkinRecords, checkinRecords.slice(-200)); }, [checkinRecords]);
  useEffect(() => { localStorage_.set(LSKey.notifications, notifications.slice(-100)); }, [notifications]);
  useEffect(() => { localStorage_.set(LSKey.activityLog, activityLog.slice(-200)); }, [activityLog]);

  // Debounced Firestore sync to prevent write-storms on multi-state updates
  useEffect(() => {
    if (!userId) return;
    const timeout = setTimeout(() => {
      updateUserStats(userId, stats);
      upsertLeaderboardEntry({
        userId: stats.userId,
        displayName: firebaseAuth.currentUser?.displayName ?? "Explorer",
        weeklyScore: stats.weeklyScore,
        totalXP: stats.totalXP,
        weeklyGems: stats.weeklyGems,
        streakDays: stats.streakDays,
        firstCheckinOfWeekTimestamp: stats.firstCheckinOfWeekTimestamp,
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [stats, userId]);

  useEffect(() => {
    if (!userId) return;
    const timeout = setTimeout(() => {
      updateUserMeta(userId, { visitedGems: [...visitedGemIds] });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [visitedGemIds, userId]);

  useEffect(() => {
    if (!userId) return;
    const timeout = setTimeout(() => {
      updateUserMeta(userId, { badges: [...unlockedBadges] });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [unlockedBadges, userId]);

  // ── Startup jobs ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Prune expired data
    setSafetyReports((r) => runSafetyExpiryJob(r));
    setSubmissions((s) => runSubmissionExpiryJob(s));
    setNotifications((n) => pruneOldNotifications(n));
    setActivityLog((a) => pruneOldActivity(a));

    // Bloom decay
    setGemStates((prev) => {
      const next = new Map(prev);
      for (const [id, gem] of prev) {
        next.set(id, runBloomDecayJob([gem])[0]);
      }
      return next;
    });

    // Streak break check
    const today = new Date().toISOString().slice(0, 10);
    setStats((s) => checkStreakBreak(s, today));

    // Weekly reset check
    const nowISO = new Date().toISOString();
    if (shouldRunWeeklyReset(stats.weeklyResetDate, nowISO)) {
      setStats((s) => applyWeeklyReset(s, 999, nowISO)); // rank unknown client-side
    }
  }, []);

  // ── Helper: push notification + activity ─────────────────────────────────
  const pushNotif = useCallback((notif: AppNotification) => {
    setNotifications((n) => [notif, ...n].slice(0, 100));
  }, []);

  const pushActivity = useCallback((entry: ActivityEntry) => {
    setActivityLog((a) => [entry, ...a].slice(0, 200));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK-IN
  // ─────────────────────────────────────────────────────────────────────────
  const lastCheckinResultRef = useRef<CheckinResult_Public | null>(null);
  const [lastCheckinResult, setLastCheckinResult] = useState<CheckinResult_Public | null>(null);

  const doCheckin = useCallback((
    gemId: number,
    method: "gps" | "qr",
    userCoords: Coords = { lat: 12.295, lng: 76.644 },
    gpsAccuracy = 5,
    qrString?: string
  ): CheckinResult_Public => {
    const gem = gemStates.get(gemId);
    if (!gem) return { valid: false, reason: "Gem not found." };

    const lastRecord = checkinRecords.filter((r) => r.userId === stats.userId).slice(-1)[0] ?? null;

    const result = verifyCheckin({
      userCoords,
      gpsAccuracy,
      method,
      gem,
      stats,
      isBuddyActive,
      unlockedBadges,
      recentRecords: checkinRecords,
      lastRecord,
      qrString,
      weather: currentWeather,
    });

    if (!result.valid) {
      const pub: CheckinResult_Public = { valid: false, reason: result.reason };
      setLastCheckinResult(pub);
      return pub;
    }

    // ── Apply updates ────────────────────────────────────────────────────
    const now = Date.now();
    const breakdown = result.breakdown!;

    // Gem bloom
    setGemStates((prev) => {
      const next = new Map(prev);
      const g = prev.get(gemId)!;
      next.set(gemId, {
        ...g,
        bloomCapacity: clampBloom(result.newBloomCapacity!),
        lastVisitTimestamp: now,
      });
      return next;
    });

    // Record
    const record: CheckinRecord = {
      id: `ci_${now}_${Math.random().toString(36).slice(2, 6)}`,
      userId: stats.userId,
      gemId,
      timestamp: now,
      coords: userCoords,
      accuracy: gpsAccuracy,
      method,
      pointsAwarded: breakdown.total,
      multiplierBreakdown: breakdown,
    };
    setCheckinRecords((prev) => [...prev, record]);
    setVisitedGemIds((prev) => new Set([...prev, gemId]));
    if (userId) fsAddCheckin(userId, record);

    // Stats update
    const newBadgeIds = result.badgesUnlocked ?? [];
    const badgeBonusPts = sumBadgeBonuses(newBadgeIds);
    const totalPts = breakdown.total + badgeBonusPts;

    setStats((prev) => ({
      ...prev,
      totalXP:       prev.totalXP + totalPts,
      weeklyScore:   prev.weeklyScore + totalPts,
      weeklyGems:    prev.weeklyGems + 1,
      allTimeGems:   prev.allTimeGems + 1,
      streakDays:    result.newStreakDays!,
      lastCheckinDate: new Date(now).toISOString().slice(0, 10),
      firstCheckinOfWeekTimestamp: prev.firstCheckinOfWeekTimestamp ?? now,
    }));

    // Badges
    if (newBadgeIds.length > 0) {
      setUnlockedBadges((prev) => new Set([...prev, ...newBadgeIds]));
      for (const id of newBadgeIds) {
        const def = BADGE_DEFS.find((b) => b.id === id)!;
        pushNotif(notifyBadge(def.name, def.bonusPoints));
        pushActivity(createActivityEntry("badge", `Badge unlocked: ${def.name}`, def.emoji, `+${def.bonusPoints} pts`));
      }
    }

    // Level up
    if (result.levelUp) {
      pushNotif(notifyLevelUp(result.newLevel!));
      pushActivity(createActivityEntry("levelup", `Levelled up to ${result.newLevel}!`, "🎉"));
    }

    // Buddy session: record gem + buddy earnings
    if (isBuddyActive && buddySession) {
      setBuddySession((prev) => prev ? recordGemInSession(prev, gemId) : prev);
      // Buddy earnings calc (simplified — would update buddy's stats server-side)
      const buddyEarnings = calcBuddyEarnings(0, breakdown.total);
      void buddyEarnings; // tracked for buddy in a real backend
    }

    // Cache invalidation
    invalidateAfterCheckin(gemId, gem.digipinCode);

    // Activity log
    const gemData = allGems.find((g) => g.id === gemId);
    pushActivity(createActivityEntry("checkin", `Checked in: ${gemData?.name ?? "Gem #" + gemId}`, gemData?.emoji ?? "📍", `+${breakdown.total} pts`));
    pushNotif(notifyCheckin(gemData?.name ?? "Gem #" + gemId, breakdown.total));

    // Bloom warning
    if (result.newBloomStatus && result.newBloomStatus !== "Active") {
      pushNotif(notifyBloomChanged(gemData?.name ?? "Gem", result.newBloomStatus));
    }
    
    // Background sync
    syncEngine.enqueue("checkin", { gemId, method, pointsDelta: totalPts });

    const pub: CheckinResult_Public = {
      valid: true,
      pointsAwarded: totalPts,
      newBloomStatus: result.newBloomStatus,
      badgesUnlocked: newBadgeIds,
      levelUp: result.levelUp,
      newLevel: result.newLevel,
      streakUpdated: result.streakUpdated,
      newStreakDays: result.newStreakDays,
    };
    setLastCheckinResult(pub);
    return pub;
  }, [gemStates, stats, checkinRecords, isBuddyActive, unlockedBadges, buddySession, pushNotif, pushActivity, userId]);

  // ─────────────────────────────────────────────────────────────────────────
  // GEM BLOOM
  // ─────────────────────────────────────────────────────────────────────────
  const getGemBloom = useCallback(async (id: number) => {
    const gem = gemStates.get(id);
    if (!gem) return { capacity: 0, status: getBloomStatus(0), color: getBloomColor(getBloomStatus(0)) };
    
    return new Promise<{ capacity: number; status: ReturnType<typeof getBloomStatus>; color: string }>((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          bloomWorker.removeEventListener("message", handler);
          resolve({ ...e.data.result, color: getBloomColor(e.data.result.status) });
        }
      };
      bloomWorker.addEventListener("message", handler);
      bloomWorker.postMessage({ id, gem });
    });
  }, [gemStates]);

  const applyBloomBoostFn = useCallback((gemId: number) => {
    if (!hasPermission(stats, "bloom_boost")) return;
    setGemStates((prev) => {
      const next = new Map(prev);
      const gem = prev.get(gemId);
      if (!gem) return prev;
      next.set(gemId, { ...gem, bloomCapacity: clampBloom(applyBloomBoost(gem.bloomCapacity)) });
      return next;
    });
    pushActivity(createActivityEntry("checkin", "Applied Bloom Boost", "🌸"));
  }, [stats, pushActivity]);

  // ─────────────────────────────────────────────────────────────────────────
  // COMMUNITY
  // ─────────────────────────────────────────────────────────────────────────
  const vote = useCallback((postId: number, direction: "up" | "down") => {
    setCommunityPosts((posts) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return posts;
      const { updatedPost, result } = castVote(post, stats.userId, direction);
      if (result.karmaChange !== 0 && post.authorId === stats.userId) {
        setStats((s) => ({ ...s, karma: Math.max(0, s.karma + result.karmaChange) }));
      }
      updateCommunityPost(postId, { votes: updatedPost.votes, upvotes: updatedPost.upvotes, downvotes: updatedPost.downvotes, score: updatedPost.score }); // Firestore
      return posts.map((p) => (p.id === postId ? updatedPost : p));
    });
  }, [stats.userId]);

  const submitPost = useCallback((body: string, category: CommunityPost["category"], imageUrl?: string): { ok: boolean; error?: string } => {
    const clean = sanitizeText(body);
    if (!clean) return { ok: false, error: "Post cannot be empty." };
    if (clean.length > 2000) return { ok: false, error: "Post too long." };

    const newPost: CommunityPost = {
      id: Date.now(),
      authorId: stats.userId,
      category,
      body: clean,
      timestamp: Date.now(),
      upvotes: 0, downvotes: 0, score: 0, votes: {},
      imageUrl,
      comments: [],
    };
    setCommunityPosts((p) => [newPost, ...p]);
    addCommunityPost(newPost); // Firestore
    setStats((s) => ({ ...s, communityPosts: s.communityPosts + 1, weeklyScore: s.weeklyScore + 5 }));
    pushActivity(createActivityEntry("checkin", "Shared a community post", "🌿", "+5 pts"));
    return { ok: true };
  }, [stats.userId, pushActivity]);

  const addComment = useCallback((postId: number, text: string): { ok: boolean; error?: string } => {
    const clean = sanitizeText(text);
    if (!clean) return { ok: false, error: "Comment cannot be empty." };
    if (clean.length > 500) return { ok: false, error: "Comment too long." };

    setCommunityPosts((posts) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return posts;

      const newComment = { id: Date.now().toString(), authorId: stats.userId, text: clean, timestamp: Date.now() };
      const updatedComments = [...(post.comments || []), newComment];
      const updatedPost = { ...post, comments: updatedComments };

      updateCommunityPost(postId, { comments: updatedComments }); // Firestore
      return posts.map((p) => (p.id === postId ? updatedPost : p));
    });
    return { ok: true };
  }, [stats.userId]);

  // ─────────────────────────────────────────────────────────────────────────
  // SAFETY
  // ─────────────────────────────────────────────────────────────────────────
  const submitSafetyReport = useCallback((
    type: ReportType,
    coords: Coords,
    description: string,
    gemId?: number
  ): { ok: boolean; error?: string } => {
    const { allowed, reason } = canSubmitReport(stats.userId, stats.hasLocalMode, safetyReports);
    if (!allowed) return { ok: false, error: reason };

    const duplicate = findDuplicateReport(type, coords, safetyReports);
    if (duplicate) {
      // Auto-confirm the existing report instead of creating a new one
      confirmSafetyReport(duplicate.id);
      return { ok: true };
    }

    const report = createReport(stats.userId, type, coords, sanitizeText(description), gemId);
    setSafetyReports((r) => [report, ...r]);
    fsAddSafetyReport(report); // Firestore
    invalidateAfterSafetyChange();
    pushActivity(createActivityEntry("safety_confirmed", `Reported: ${type}`, "🛡️", "+5 pts"));
    setStats((s) => ({ ...s, weeklyScore: s.weeklyScore + 5 }));
    return { ok: true };
  }, [stats, safetyReports, pushActivity]);

  const confirmSafetyReport = useCallback((reportId: string) => {
    setSafetyReports((reports) => reports.map((r) => {
      if (r.id !== reportId) return r;
      const { report: updated, justConfirmed, pointsForReporter } = confirmReport(r, stats.userId);
      fsUpdateSafetyReport(reportId, { confirmations: updated.confirmations, status: updated.status });
      if (justConfirmed) {
        pushNotif(notifySafetyConfirmed(r.type));
        if (pointsForReporter > 0 && r.reporterId === stats.userId) {
          setStats((s) => ({ ...s, totalXP: s.totalXP + pointsForReporter, weeklyScore: s.weeklyScore + pointsForReporter }));
        }
        invalidateAfterSafetyChange();
      }
      return updated;
    }));
  }, [stats.userId, pushNotif]);

  const dismissSafetyReport = useCallback((reportId: string) => {
    setSafetyReports((reports) => reports.map((r) => {
      if (r.id !== reportId) return r;
      const updated = dismissReport(r, stats.userId);
      fsUpdateSafetyReport(reportId, { status: updated.status, dismissals: updated.dismissals });
      return updated;
    }));
    invalidateAfterSafetyChange();
  }, [stats.userId]);

  const extendSafetyReport = useCallback((reportId: string) => {
    setSafetyReports((reports) => reports.map((r) => {
      if (r.id !== reportId) return r;
      const updated = extendReport(r);
      fsUpdateSafetyReport(reportId, { expiresAt: updated.expiresAt, extendedBy: updated.extendedBy });
      return updated;
    }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // BUDDY
  // ─────────────────────────────────────────────────────────────────────────
  const startBuddy = useCallback((buddyId: number) => {
    const session = startBuddySession(buddyId, stats.userId);
    setBuddySession(session);
    pushActivity(createActivityEntry("buddy_request", "Buddy session started", "🤝"));
  }, [stats.userId, pushActivity]);

  const endBuddy = useCallback(() => {
    setBuddySession((s) => s ? endBuddySession(s) : null);
    setStats((s) => ({ ...s, buddyWalks: s.buddyWalks + 1 }));
    pushActivity(createActivityEntry("buddy_request", "Buddy session ended", "🤝"));
  }, [pushActivity]);

  // ─────────────────────────────────────────────────────────────────────────
  // EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  const rsvpEvent = useCallback((eventId: number): { ok: boolean; message: string } => {
    const ev = eventStates.get(eventId);
    if (!ev) return { ok: false, message: "Event not found." };
    
    const userActiveEvents = Array.from(eventStates.values()).filter(e => e.rsvps.includes(stats.userId));
    
    const { event: updated, result, pointsDelta } = toggleRsvp(ev, stats.userId, userActiveEvents);
    setEventStates((m) => { const n = new Map(m); n.set(eventId, updated); return n; });
    fsUpdateEvent(eventId, { rsvps: updated.rsvps, waitlist: updated.waitlist }); // Firestore
    if (pointsDelta > 0) {
      setStats((s) => ({ ...s, weeklyScore: s.weeklyScore + pointsDelta, totalXP: s.totalXP + pointsDelta }));
    }
    pushActivity(createActivityEntry("checkin", result.message, "🗓", pointsDelta > 0 ? `+${pointsDelta} pts` : undefined));
    return { ok: result.success, message: result.message };
  }, [eventStates, stats.userId, pushActivity]);

  const getCountdownFn = useCallback((startMs: number) => getCountdown(startMs), []);

  // ─────────────────────────────────────────────────────────────────────────
  // GEM SUBMISSIONS
  // ─────────────────────────────────────────────────────────────────────────
  const submitGem = useCallback((data: SubmitGemInput): { ok: boolean; errors?: string[] } => {
    const levelIndex = levelInfo.level.index;
    const { valid, errors } = validateSubmission({ ...data, userLevelIndex: levelIndex });
    if (!valid) return { ok: false, errors };
    if (!data.coords || !data.category) return { ok: false, errors: ["Missing required fields."] };

    const sub = createSubmission(stats.userId, {
      name: sanitizeText(data.name),
      description: sanitizeText(data.description),
      whyHidden: sanitizeText(data.whyHidden),
      category: data.category as GemCategory,
      coords: data.coords,
      photos: data.photos,
      bestTimeToVisit: data.bestTimeToVisit,
      safetyNote: data.safetyNote,
    });
    setSubmissions((s) => [sub, ...s]);
    fsAddSubmission(sub); // Firestore
    pushActivity(createActivityEntry("gem_accepted", `Submitted gem: ${data.name}`, "💎"));
    return { ok: true };
  }, [stats.userId, levelInfo, pushActivity]);

  const confirmGemSubmission = useCallback((submissionId: string) => {
    setSubmissions((subs) => subs.map((s) => {
      if (s.id !== submissionId) return s;
      const { submission: updated, justAccepted, pointsForSubmitter } = confirmSubmission(s, stats.userId);
      fsUpdateSubmission(submissionId, { confirmations: updated.confirmations, status: updated.status });
      if (justAccepted) {
        pushNotif(notifyGemAccepted(s.name));
        if (s.submitterId === stats.userId && pointsForSubmitter > 0) {
          setStats((st) => ({
            ...st,
            totalXP: st.totalXP + pointsForSubmitter,
            weeklyScore: st.weeklyScore + pointsForSubmitter,
            acceptedSubmissions: st.acceptedSubmissions + 1,
          }));
        }
      }
      return updated;
    }));
  }, [stats.userId, pushNotif]);

  const flagGemSubmission = useCallback((submissionId: string) => {
    setSubmissions((subs) => subs.map((s) => {
      if (s.id !== submissionId) return s;
      const updated = flagSubmission(s, stats.userId);
      fsUpdateSubmission(submissionId, { flags: updated.flags, status: updated.status });
      return updated;
    }));
  }, [stats.userId]);

  // ─────────────────────────────────────────────────────────────────────────
  // REWARDS
  // ─────────────────────────────────────────────────────────────────────────
  const redeemPoints = useCallback((amount: number, rewardName: string): { ok: boolean; message: string } => {
    const spendable = stats.totalXP - (stats.pointsRedeemed || 0);
    if (spendable < amount) {
      return { ok: false, message: `Insufficient points. You need ${amount} but have ${spendable}.` };
    }
    
    setStats(prev => ({
      ...prev,
      pointsRedeemed: (prev.pointsRedeemed || 0) + amount
    }));
    
    pushActivity(createActivityEntry("checkin", `Redeemed ${rewardName}`, "🎁", `-${amount} pts`));
    
    // Background sync
    syncEngine.enqueue("redeem", { rewardName, amount });

    return { ok: true, message: "Redeemed successfully" };
  }, [stats.totalXP, stats.pointsRedeemed, pushActivity]);

  // ─────────────────────────────────────────────────────────────────────────
  // LEADERBOARD  (live from Firestore, falls back to demo data while loading)
  // ─────────────────────────────────────────────────────────────────────────
  const DEMO_PLAYERS = [
    { userId: "user_priya",   displayName: "Priya Nair",  weeklyScore: 3420, totalXP: 3420, weeklyGems: 14, streakDays: 12, firstCheckinOfWeekTimestamp: Date.now() - 7 * 86400000 },
    { userId: "user_suresh",  displayName: "Suresh Rao",  weeklyScore: 2890, totalXP: 2890, weeklyGems: 11, streakDays: 8,  firstCheckinOfWeekTimestamp: Date.now() - 6 * 86400000 },
    { userId: "user_lakshmi", displayName: "Lakshmi V.",  weeklyScore: 2210, totalXP: 2210, weeklyGems: 9,  streakDays: 5,  firstCheckinOfWeekTimestamp: Date.now() - 5 * 86400000 },
    { userId: "user_divya",   displayName: "Divya K.",    weeklyScore: 1590, totalXP: 1590, weeklyGems: 4,  streakDays: 3,  firstCheckinOfWeekTimestamp: Date.now() - 4 * 86400000 },
    { userId: "user_arjun",   displayName: "Arjun M.",    weeklyScore: 1420, totalXP: 1420, weeklyGems: 4,  streakDays: 2,  firstCheckinOfWeekTimestamp: Date.now() - 3 * 86400000 },
    { userId: "user_nirmala", displayName: "Nirmala S.",  weeklyScore: 980,  totalXP: 980,  weeklyGems: 3,  streakDays: 1,  firstCheckinOfWeekTimestamp: Date.now() - 2 * 86400000 },
  ];

  const leaderboard = useMemo(() => {
    // Use live Firestore entries if available; otherwise show demo data + current user
    const base: LeaderboardUserDoc[] = liveLeaderboard.length > 0
      ? liveLeaderboard
      : DEMO_PLAYERS;

    // Always ensure current user is included with live stats
    const withoutMe = base.filter((e) => e.userId !== stats.userId);
    const allPlayers = [
      ...withoutMe,
      {
        userId: stats.userId,
        displayName: firebaseAuth.currentUser?.displayName ?? "Explorer",
        weeklyScore: stats.weeklyScore,
        totalXP: stats.totalXP,
        weeklyGems: stats.weeklyGems,
        streakDays: stats.streakDays,
        firstCheckinOfWeekTimestamp: stats.firstCheckinOfWeekTimestamp,
      },
    ];

    return buildLeaderboard(
      allPlayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        stats: {
          ...seedStats(),
          userId: p.userId,
          weeklyScore: p.weeklyScore ?? 0,
          totalXP: p.totalXP ?? 0,
          weeklyGems: p.weeklyGems ?? 0,
          allTimeGems: p.weeklyGems ?? 0,
          streakDays: p.streakDays ?? 0,
          firstCheckinOfWeekTimestamp: p.firstCheckinOfWeekTimestamp ?? null,
        } as UserStats,
      }))
    );
  }, [liveLeaderboard, stats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // ZONE PROGRESS
  // ─────────────────────────────────────────────────────────────────────────
  const zoneProgress = ZONE_DEFS.map((zone) => {
    const visitedInZone = [...visitedGemIds].filter((id) => {
      const g = gemStates.get(id);
      return g?.digipinCode === zone.digipinCode;
    }).length;
    return getZoneCompletion(zone, visitedInZone);
  });

  const isZoneUnlockedFn = useCallback((zoneId: string): boolean => {
    const zone = ZONE_DEFS.find((z) => z.id === zoneId);
    if (!zone) return false;
    const visitedByZone: Record<string, number> = {};
    for (const z of ZONE_DEFS) {
      visitedByZone[z.id] = [...visitedGemIds].filter((id) => gemStates.get(id)?.digipinCode === z.digipinCode).length;
    }
    return isZoneUnlocked(zone, stats, visitedByZone, unlockedBadges, levelInfo.level.index);
  }, [visitedGemIds, gemStates, stats, unlockedBadges, levelInfo]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL MODE
  // ─────────────────────────────────────────────────────────────────────────
  const activateLocalMode = useCallback(() => {
    if (!localModeEligibility.eligible) return;
    setStats((s) => ({ ...s, hasLocalMode: true }));
    pushActivity(createActivityEntry("levelup", "Local Mode activated!", "🏠"));
  }, [localModeEligibility.eligible, pushActivity]);

  // ─────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────
  const markNotifRead = useCallback((id: string) => {
    setNotifications((n) => markRead(n, id));
  }, []);

  const markAllNotifsRead = useCallback(() => {
    setNotifications((n) => markAllRead(n));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const value: GameContextType = {
    allGems, allPlaces,
    stats, levelInfo, unlockedBadges, permissions,
    gemStates, getGemBloom,
    checkinRecords, visitedGemIds, doCheckin, lastCheckinResult,
    communityPosts,
    vote,
    submitPost,
    addComment,
    localExpertStatus,
    safetyReports, submitSafetyReport, confirmSafetyReport, dismissSafetyReport, extendSafetyReport,
    zoneProgress, isZoneUnlockedFn,
    buddySession, isBuddyActive, startBuddy, endBuddy,
    eventStates, rsvpEvent, getCountdownFn,
    submissions, submitGem, confirmGemSubmission, flagGemSubmission,
    redeemPoints,
    leaderboard,
    localModeEligibility, activateLocalMode,
    notifications, activityLog, unreadCount, markNotifRead, markAllNotifsRead,
    applyBloomBoostFn,
    currentWeather, setMockWeather, getGemSuitability,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
