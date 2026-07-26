/**
 * Firestore service layer for HADI.
 * Provides all CRUD + real-time subscription functions.
 *
 * Collections:
 *  users/{uid}                   – UserStats + badges + visited/saved gems
 *  users/{uid}/checkins/{id}     – CheckinRecord
 *  users/{uid}/notifications/{id}– AppNotification
 *  users/{uid}/activity/{id}     – ActivityEntry
 *  community_posts/{id}          – CommunityPost (shared, real-time)
 *  safety_reports/{id}           – SafetyReport  (shared, real-time)
 *  events/{id}                   – EventState    (shared, real-time)
 *  gem_submissions/{id}          – GemSubmission (shared, real-time)
 *  leaderboard/{uid}             – LeaderboardEntry (updated on checkin)
 */

import {
  getFirestore,
  doc, collection,
  getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
  onSnapshot,
  query, orderBy, limit, where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseAuth } from "./firebase";
import type {
  UserStats, CheckinRecord, AppNotification, ActivityEntry,
  CommunityPost, SafetyReport, GemSubmission,
} from "../engine/types";

// ── db instance ───────────────────────────────────────────────────────────────
import { initializeApp, getApps } from "firebase/app";
export const db = getFirestore(getApps()[0]);

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid(): string {
  return firebaseAuth.currentUser?.uid ?? "anonymous";
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER DOCUMENT  (stats + meta)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserDoc {
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  stats: UserStats;
  badges: string[];
  visitedGems: number[];
  savedGems: number[];
  selectedVibes?: string[];
}

export async function getUserDoc(userId: string): Promise<UserDoc | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? (snap.data() as UserDoc) : null;
  } catch { return null; }
}

export async function createUserDoc(userId: string, data: Partial<UserDoc>): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId), {
      ...data,
      createdAt: Date.now(),
    }, { merge: true });
  } catch (e) { console.warn("[firestore] createUserDoc failed", e); }
}

export async function updateUserStats(userId: string, stats: UserStats): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId), { stats }, { merge: true });
  } catch (e) { console.warn("[firestore] updateUserStats failed", e); }
}

export async function updateUserMeta(userId: string, meta: {
  badges?: string[];
  visitedGems?: number[];
  savedGems?: number[];
  displayName?: string;
}): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId), stripUndefined(meta), { merge: true });
  } catch (e) { console.warn("[firestore] updateUserMeta failed", e); }
}

export function subscribeToUserDoc(
  userId: string,
  callback: (doc: UserDoc | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "users", userId), (snap) => {
    callback(snap.exists() ? (snap.data() as UserDoc) : null);
  }, () => callback(null));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKINS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addCheckin(userId: string, record: CheckinRecord): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", userId, "checkins", record.id),
      record
    );
  } catch (e) { console.warn("[firestore] addCheckin failed", e); }
}

export async function getUserCheckins(userId: string): Promise<CheckinRecord[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "users", userId, "checkins"), orderBy("timestamp", "desc"), limit(200))
    );
    return snap.docs.map((d) => d.data() as CheckinRecord);
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addNotification(userId: string, notif: AppNotification): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId, "notifications", notif.id), notif);
  } catch (e) { console.warn("[firestore] addNotification failed", e); }
}

export async function markNotifReadFirestore(userId: string, notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "users", userId, "notifications", notifId), { read: true });
  } catch {}
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifs: AppNotification[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "users", userId, "notifications"), orderBy("timestamp", "desc"), limit(100)),
    (snap) => callback(snap.docs.map((d) => d.data() as AppNotification)),
    () => callback([])
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════

export async function addActivity(userId: string, entry: ActivityEntry): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId, "activity", entry.id), entry);
  } catch (e) { console.warn("[firestore] addActivity failed", e); }
}

export async function getUserActivity(userId: string): Promise<ActivityEntry[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "users", userId, "activity"), orderBy("timestamp", "desc"), limit(200))
    );
    return snap.docs.map((d) => d.data() as ActivityEntry);
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY POSTS
// ═══════════════════════════════════════════════════════════════════════════════

export function subscribeToCommunityPosts(
  callback: (posts: CommunityPost[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "community_posts"), orderBy("timestamp", "desc"), limit(100)),
    (snap) => callback(snap.docs.map((d) => ({ id: Number(d.id), ...d.data() } as CommunityPost))),
    () => callback([])
  );
}

export async function addCommunityPost(post: CommunityPost): Promise<void> {
  try {
    await setDoc(doc(db, "community_posts", String(post.id)), post);
  } catch (e) { console.warn("[firestore] addCommunityPost failed", e); }
}

export async function updateCommunityPost(postId: number, data: Partial<CommunityPost>): Promise<void> {
  try {
    await updateDoc(doc(db, "community_posts", String(postId)), data);
  } catch (e) { console.warn("[firestore] updateCommunityPost failed", e); }
}

// Seed initial posts if collection is empty
export async function seedCommunityPostsIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(query(collection(db, "community_posts"), limit(1)));
    if (!snap.empty) return;
    const seeds: CommunityPost[] = [
      { id: 1, authorId: "system", category: "Hidden Finds", body: "Just found the most incredible rangoli painted in a tiny alleyway off Sayyaji Rao Road! The artist starts at 4am every day.", timestamp: Date.now() - 7200000, upvotes: 42, downvotes: 0, score: 42, votes: {} },
      { id: 2, authorId: "system", category: "Safety Notes", body: "Safety note: The eastern entrance to Devaraja Market has a large crowd near the textile section. Recommend using the northern gate instead.", timestamp: Date.now() - 18000000, upvotes: 28, downvotes: 2, score: 26, votes: {} },
      { id: 3, authorId: "system", category: "Local Tips", body: "Hidden tip: Iyer's Idli Corner in Agrahara Lane — they serve only 50 plates every morning. Go before 7am.", timestamp: Date.now() - 86400000, upvotes: 87, downvotes: 1, score: 86, votes: {} },
    ];
    await Promise.all(seeds.map((p) => setDoc(doc(db, "community_posts", String(p.id)), p)));
  } catch (e) { console.warn("[firestore] seedCommunityPosts failed", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAFETY REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function subscribeToSafetyReports(
  callback: (reports: SafetyReport[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "safety_reports"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => callback(snap.docs.map((d) => d.data() as SafetyReport)),
    () => callback([])
  );
}

export async function addSafetyReport(report: SafetyReport): Promise<void> {
  try {
    await setDoc(doc(db, "safety_reports", report.id), report);
  } catch (e) { console.warn("[firestore] addSafetyReport failed", e); }
}

export async function updateSafetyReport(reportId: string, data: Partial<SafetyReport>): Promise<void> {
  try {
    await updateDoc(doc(db, "safety_reports", reportId), data);
  } catch (e) { console.warn("[firestore] updateSafetyReport failed", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventDoc {
  id: number;
  title: string;
  subtitle: string;
  linkedGemIds: number[];
  rsvps: string[];
  waitlist: string[];
  capacity: number;
  startTime: number;
  endTime: number;
  createdAt: number;
}

export function subscribeToEvents(
  callback: (events: EventDoc[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "events"), orderBy("startTime", "asc"), limit(50)),
    (snap) => callback(snap.docs.map((d) => d.data() as EventDoc)),
    () => callback([])
  );
}

export async function updateEvent(eventId: number, data: Partial<EventDoc>): Promise<void> {
  try {
    await updateDoc(doc(db, "events", String(eventId)), data);
  } catch (e) { console.warn("[firestore] updateEvent failed", e); }
}

export async function seedEventsIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(query(collection(db, "events"), limit(1)));
    if (!snap.empty) return;

    const eventTitles = [
      { title: "Heritage Walk at Devaraja Market", subtitle: "A guided walk through 200-year-old textile lanes" },
      { title: "Rangoli Art Workshop", subtitle: "Learn traditional kolam with master artist Gowramma" },
      { title: "Sunrise Puja — Trinesvara Temple", subtitle: "Witness the ancient Hoysala ritual at 5:30 AM" },
      { title: "Channapatna Toy Making Demo", subtitle: "Hands-on lacquerware session with 3rd gen artisans" },
      { title: "Street Food Safari", subtitle: "Hidden eateries and filter coffee stops locals love" },
      { title: "Full Moon Walk — Chamundi Hill", subtitle: "Night trek with astronomy and folklore narration" },
    ];

    await Promise.all(
      eventTitles.map((t, i) =>
        setDoc(doc(db, "events", String(i + 1)), {
          id: i + 1,
          ...t,
          linkedGemIds: [(i % 10) + 1],
          rsvps: [],
          waitlist: [],
          capacity: 60,
          startTime: Date.now() + (i * 2 + 1) * 86_400_000,
          endTime: Date.now() + (i * 2 + 1) * 86_400_000 + 3 * 3_600_000,
          createdAt: Date.now(),
        })
      )
    );
  } catch (e) { console.warn("[firestore] seedEvents failed", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEM SUBMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function subscribeToSubmissions(
  callback: (submissions: GemSubmission[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "gem_submissions"), orderBy("createdAt", "desc"), limit(50)),
    (snap) => callback(snap.docs.map((d) => d.data() as GemSubmission)),
    () => callback([])
  );
}

export async function addSubmission(submission: GemSubmission): Promise<void> {
  try {
    await setDoc(doc(db, "gem_submissions", submission.id), submission);
  } catch (e) { console.warn("[firestore] addSubmission failed", e); }
}

export async function updateSubmission(submissionId: string, data: Partial<GemSubmission>): Promise<void> {
  try {
    await updateDoc(doc(db, "gem_submissions", submissionId), data);
  } catch (e) { console.warn("[firestore] updateSubmission failed", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export interface LeaderboardUserDoc {
  userId: string;
  displayName: string;
  weeklyScore: number;
  totalXP: number;
  weeklyGems: number;
  streakDays: number;
  firstCheckinOfWeekTimestamp: number | null;
}

export async function upsertLeaderboardEntry(entry: LeaderboardUserDoc): Promise<void> {
  try {
    await setDoc(doc(db, "leaderboard", entry.userId), entry, { merge: true });
  } catch (e) { console.warn("[firestore] upsertLeaderboardEntry failed", e); }
}

export function subscribeToLeaderboard(
  callback: (entries: LeaderboardUserDoc[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "leaderboard"), orderBy("weeklyScore", "desc"), limit(50)),
    (snap) => callback(snap.docs.map((d) => d.data() as LeaderboardUserDoc)),
    () => callback([])
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED RUNNER  (call once on first auth)
// ═══════════════════════════════════════════════════════════════════════════════

export async function runSeedIfNeeded(): Promise<void> {
  await Promise.all([
    seedCommunityPostsIfEmpty(),
    seedEventsIfEmpty(),
  ]);
}
