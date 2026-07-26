import type { EventState, RsvpResult, Countdown } from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const WAITLIST_MAX = 20;
const POINTS_RSVP             = 5;
const POINTS_CHECKIN_ANY_GEM  = 75;
const POINTS_CHECKIN_ALL_GEMS = 200;
const POINTS_LEAVE_REVIEW     = 25;
const POINTS_CREATOR_BONUS    = 150; // if ≥5 attendees show up

// ─── RSVP ─────────────────────────────────────────────────────────────────────

export function checkTimeConflict(newEvent: EventState, userEvents: EventState[]): boolean {
  return userEvents.some(
    (e) => e.id !== newEvent.id && newEvent.startTime < e.endTime && newEvent.endTime > e.startTime
  );
}

export function canRsvp(event: EventState, userId: string, userActiveEvents: EventState[] = []): RsvpResult {
  if (checkTimeConflict(event, userActiveEvents)) {
    return { success: false, position: "full", message: "Time conflict with another event you are attending." };
  }
  if (event.rsvps.includes(userId)) {
    return { success: false, position: "confirmed", message: "You already have an RSVP." };
  }
  if (event.waitlist.includes(userId)) {
    return { success: false, position: "waitlist", message: "You are already on the waitlist." };
  }

  const confirmedCount = event.rsvps.length;
  if (confirmedCount < event.capacity) {
    return { success: true, position: "confirmed", message: "RSVP confirmed!" };
  }
  if (event.waitlist.length < WAITLIST_MAX) {
    return { success: true, position: "waitlist", message: `You've been added to the waitlist (position ${event.waitlist.length + 1}).` };
  }
  return { success: false, position: "full", message: "This event is full and the waitlist is closed." };
}

export function toggleRsvp(event: EventState, userId: string, userActiveEvents: EventState[] = []): { event: EventState; result: RsvpResult; pointsDelta: number } {
  // Cancel existing
  if (event.rsvps.includes(userId)) {
    const rsvps = event.rsvps.filter((id) => id !== userId);
    // Promote from waitlist if slot opens
    let waitlist = [...event.waitlist];
    if (waitlist.length > 0) {
      const [promoted, ...rest] = waitlist;
      rsvps.push(promoted);
      waitlist = rest;
    }
    return { event: { ...event, rsvps, waitlist }, result: { success: true, position: "confirmed", message: "RSVP cancelled." }, pointsDelta: -POINTS_RSVP };
  }
  if (event.waitlist.includes(userId)) {
    const waitlist = event.waitlist.filter((id) => id !== userId);
    return { event: { ...event, waitlist }, result: { success: true, position: "waitlist", message: "Removed from waitlist." }, pointsDelta: 0 };
  }

  const check = canRsvp(event, userId, userActiveEvents);
  if (!check.success) return { event, result: check, pointsDelta: 0 };

  if (check.position === "confirmed") {
    return { event: { ...event, rsvps: [...event.rsvps, userId] }, result: check, pointsDelta: POINTS_RSVP };
  } else {
    return { event: { ...event, waitlist: [...event.waitlist, userId] }, result: check, pointsDelta: 0 };
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────────

export function getCountdown(startTimeMs: number, nowMs?: number): Countdown {
  const now = nowMs ?? Date.now();
  const diff = Math.max(0, startTimeMs - now);

  const totalSeconds = Math.floor(diff / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  if (diff <= 0) {
    label = "Live now";
  } else if (days > 0) {
    label = `${days}d ${hours}h`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m`;
  } else {
    label = `${minutes}m ${seconds}s`;
  }

  return { days, hours, minutes, seconds, label, urgent: diff > 0 && diff < 86_400_000 };
}

// ─── Attendance points ────────────────────────────────────────────────────────

export function calculateEventPoints(
  eventGemIds: number[],
  checkedInGemIds: number[],
  leftReview: boolean
): number {
  const checkedInSet = new Set(checkedInGemIds);
  const anyLinkedGem = eventGemIds.some((id) => checkedInSet.has(id));
  if (!anyLinkedGem) return 0;

  const allLinked = eventGemIds.every((id) => checkedInSet.has(id));
  let pts = anyLinkedGem ? POINTS_CHECKIN_ANY_GEM : 0;
  if (allLinked && eventGemIds.length > 0) pts = POINTS_CHECKIN_ALL_GEMS;
  if (leftReview) pts += POINTS_LEAVE_REVIEW;
  return pts;
}

export function calcCreatorBonus(attendeeCount: number): number {
  return attendeeCount >= 5 ? POINTS_CREATOR_BONUS : 0;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const MIN_LEAD_TIME_MS  = 24 * 3_600_000;
const MAX_DURATION_MS   = 8  * 3_600_000;
const MAX_ACTIVE_EVENTS = 3;

export function validateEventCreation(
  startMs: number,
  endMs: number,
  activeEventCount: number,
  userLevelIndex: number,
  hasLocalMode: boolean,
  nowMs?: number
): { valid: boolean; errors: string[] } {
  const now = nowMs ?? Date.now();
  const errors: string[] = [];

  if (!hasLocalMode && userLevelIndex < 2) {
    errors.push("Must be Level 3 (Pathfinder) or have Local Mode to create events.");
  }
  if (startMs - now < MIN_LEAD_TIME_MS) errors.push("Events must be created at least 24 hours in advance.");
  if (endMs - startMs > MAX_DURATION_MS) errors.push("Events cannot be longer than 8 hours.");
  if (endMs <= startMs) errors.push("End time must be after start time.");
  if (activeEventCount >= MAX_ACTIVE_EVENTS) errors.push("You already have 3 active events.");

  return { valid: errors.length === 0, errors };
}
