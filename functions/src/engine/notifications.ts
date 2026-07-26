import type { AppNotification, ActivityEntry, NotificationType } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INBOX_RETENTION_MS    = 30 * 24 * 3_600_000; // 30 days
const ACTIVITY_RETENTION_MS = 90 * 24 * 3_600_000; // 90 days

// ─── Priority by type ─────────────────────────────────────────────────────────

const PRIORITY: Record<NotificationType, AppNotification["priority"]> = {
  safety_confirmed:  "critical",
  badge:             "high",
  levelup:           "high",
  gem_accepted:      "high",
  buddy_request:     "medium",
  event_reminder:    "medium",
  checkin:           "low",
  points:            "low",
  post_upvoted:      "low",
  leaderboard:       "low",
  bloom_changed:     "low",
};

// ─── Notification factory ──────────────────────────────────────────────────────

export function createNotification(
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  nowMs?: number
): AppNotification {
  return {
    id: `notif_${(nowMs ?? Date.now())}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    timestamp: nowMs ?? Date.now(),
    read: false,
    priority: PRIORITY[type],
    data,
  };
}

// ─── Named constructors ───────────────────────────────────────────────────────

export function notifyCheckin(gemName: string, points: number): AppNotification {
  return createNotification("points", "Check-in Complete", `+${points} pts · ${gemName}`);
}

export function notifyBadge(badgeName: string, bonusPts: number): AppNotification {
  return createNotification("badge", `Badge Unlocked: ${badgeName}`, `+${bonusPts} bonus points awarded!`);
}

export function notifyLevelUp(newLevelName: string): AppNotification {
  return createNotification("levelup", "Level Up!", `You are now a ${newLevelName} 🎉`);
}

export function notifyGemAccepted(gemName: string): AppNotification {
  return createNotification("gem_accepted", "Gem Accepted!", `Your submission '${gemName}' is now live on the map.`);
}

export function notifySafetyConfirmed(area: string): AppNotification {
  return createNotification("safety_confirmed", "Safety Alert Confirmed", `Hazard confirmed near ${area}. Exercise caution.`);
}

export function notifyBuddyRequest(buddyName: string): AppNotification {
  return createNotification("buddy_request", "Buddy Request", `${buddyName} wants to guide your next walk!`);
}

export function notifyBloomChanged(gemName: string, newStatus: string): AppNotification {
  return createNotification("bloom_changed", `${gemName} — Bloom Changed`, `This gem's status is now ${newStatus}.`);
}

// ─── Inbox management ─────────────────────────────────────────────────────────

export function markRead(notifications: AppNotification[], id: string): AppNotification[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllRead(notifications: AppNotification[]): AppNotification[] {
  return notifications.map((n) => ({ ...n, read: true }));
}

export function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function pruneOldNotifications(notifications: AppNotification[], nowMs?: number): AppNotification[] {
  const now = nowMs ?? Date.now();
  return notifications.filter((n) => now - n.timestamp < INBOX_RETENTION_MS);
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export function createActivityEntry(
  type: NotificationType,
  text: string,
  emoji: string,
  points?: string,
  nowMs?: number
): ActivityEntry {
  return {
    id: `act_${(nowMs ?? Date.now())}_${Math.random().toString(36).slice(2, 6)}`,
    emoji,
    text,
    points,
    timestamp: nowMs ?? Date.now(),
    type,
  };
}

export function pruneOldActivity(entries: ActivityEntry[], nowMs?: number): ActivityEntry[] {
  const now = nowMs ?? Date.now();
  return entries.filter((e) => now - e.timestamp < ACTIVITY_RETENTION_MS);
}

// ─── Upvote batching ──────────────────────────────────────────────────────────

/**
 * Given low-priority upvote notifications accumulated during the day,
 * collapse them into a single digest notification.
 */
export function buildUpvoteDigest(
  upvoteNotifs: AppNotification[],
  nowMs?: number
): AppNotification | null {
  const count = upvoteNotifs.length;
  if (count === 0) return null;
  const totalUpvotes = upvoteNotifs.reduce((sum, n) => sum + ((n.data?.upvoteCount as number) ?? 1), 0);
  return createNotification(
    "post_upvoted",
    "Community Activity",
    `Your posts got ${totalUpvotes} new upvote${totalUpvotes !== 1 ? "s" : ""} today.`,
    { upvoteCount: totalUpvotes },
    nowMs
  );
}
