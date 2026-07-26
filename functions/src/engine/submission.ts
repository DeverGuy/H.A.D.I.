import type { GemSubmission, GemCategory, Coords, SubmissionValidationResult } from "./types";
import { isInMysuru } from "./consistency";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CONFIRMATION_NEEDED    = 5;
const FLAG_THRESHOLD         = 3;
const GUARDIAN_REVIEW_MS     = 72 * 3_600_000;
const SUBMISSION_EXPIRY_MS   = 14 * 24 * 3_600_000;
const MIN_NEARBY_RADIUS_M    = 30;    // reject if existing gem within this distance
const SUBMITTER_POINTS       = 300;
const GEM_SMITH_PROGRESS_INC = 1;

// ─── Validation ────────────────────────────────────────────────────────────────

export function validateSubmission(data: {
  name: string;
  description: string;
  whyHidden: string;
  category: GemCategory | "";
  coords: Coords | null;
  photos: string[];
  userLevelIndex: number;
}): SubmissionValidationResult {
  const errors: string[] = [];

  if (!data.name.trim() || data.name.length > 60) errors.push("Name is required and must be ≤60 characters.");
  if (data.description.length < 100 || data.description.length > 1000) errors.push("Description must be 100–1000 characters.");
  if (data.whyHidden.length < 50 || data.whyHidden.length > 300) errors.push("'Why Hidden' must be 50–300 characters.");
  if (!data.category) errors.push("Category is required.");
  if (!data.coords) errors.push("Location is required — tap on the map or use your GPS.");
  if (data.photos.length < 1 || data.photos.length > 6) errors.push("Please add 1–6 photos.");
  if (data.userLevelIndex < 2) errors.push("You must be Level 3 (Pathfinder) to submit gems.");
  if (data.coords && !isInMysuru(data.coords.lat, data.coords.lng)) {
    errors.push("Invalid location. Submissions are currently restricted to the city's geographical bounding box.");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export function createSubmission(
  submitterId: string,
  data: {
    name: string;
    description: string;
    whyHidden: string;
    category: GemCategory;
    coords: Coords;
    photos: string[];
    bestTimeToVisit?: string;
    safetyNote?: string;
  },
  nowMs?: number
): GemSubmission {
  const now = nowMs ?? Date.now();
  return {
    id: `sub_${now}_${Math.random().toString(36).slice(2, 8)}`,
    submitterId,
    ...data,
    status: "Pending",
    confirmations: [],
    flags: [],
    createdAt: now,
    expiresAt: now + SUBMISSION_EXPIRY_MS,
  };
}

// ─── Community confirmations / flags ─────────────────────────────────────────

export interface ConfirmSubmissionResult {
  submission: GemSubmission;
  justAccepted: boolean;
  pointsForSubmitter: number;
}

export function confirmSubmission(sub: GemSubmission, userId: string): ConfirmSubmissionResult {
  if (sub.submitterId === userId) return { submission: sub, justAccepted: false, pointsForSubmitter: 0 };
  if (sub.confirmations.includes(userId) || sub.flags.includes(userId)) return { submission: sub, justAccepted: false, pointsForSubmitter: 0 };

  const confirmations = [...sub.confirmations, userId];
  const justAccepted  = confirmations.length === CONFIRMATION_NEEDED;
  const updatedSub: GemSubmission = {
    ...sub,
    confirmations,
    status: justAccepted ? "Accepted" : sub.status,
  };
  return { submission: updatedSub, justAccepted, pointsForSubmitter: justAccepted ? SUBMITTER_POINTS : 0 };
}

export function flagSubmission(sub: GemSubmission, userId: string, nowMs?: number): GemSubmission {
  if (sub.submitterId === userId) return sub;
  if (sub.confirmations.includes(userId) || sub.flags.includes(userId)) return sub;
  const now = nowMs ?? Date.now();

  const flags = [...sub.flags, userId];
  const needsReview = flags.length >= FLAG_THRESHOLD && sub.confirmations.length < CONFIRMATION_NEEDED;
  return {
    ...sub,
    flags,
    status: needsReview ? "NeedsReview" : sub.status,
    guardianReviewBy: needsReview ? now + GUARDIAN_REVIEW_MS : sub.guardianReviewBy,
  };
}

// ─── Guardian decision ────────────────────────────────────────────────────────

export function guardianAccept(sub: GemSubmission): { sub: GemSubmission; pointsForSubmitter: number } {
  return { sub: { ...sub, status: "Accepted" }, pointsForSubmitter: SUBMITTER_POINTS };
}

export function guardianReject(sub: GemSubmission): GemSubmission {
  return { ...sub, status: "Rejected" };
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

export function processExpiredSubmissions(submissions: GemSubmission[], nowMs?: number): GemSubmission[] {
  const now = nowMs ?? Date.now();
  return submissions.map((s) =>
    s.status === "Pending" && now >= s.expiresAt
      ? { ...s, status: "Rejected" as const }
      : s
  );
}

export { SUBMITTER_POINTS, GEM_SMITH_PROGRESS_INC };
