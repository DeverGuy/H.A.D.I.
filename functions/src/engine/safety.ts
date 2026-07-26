import type { SafetyReport, ReportType, Coords } from "./types";
import { haversineDistance } from "./checkin";

// ─── Report expiry windows (ms) ───────────────────────────────────────────────

const EXPIRY_MS: Record<ReportType, number> = {
  "Physical Hazard":     24 * 3_600_000,
  "High Crowd":           6 * 3_600_000,
  "Temporary Closure":   72 * 3_600_000,
  "Road Obstruction":    48 * 3_600_000,
  "Lighting Issue":      12 * 3_600_000,
  "Animal Presence":      4 * 3_600_000,
  "Flooding":             8 * 3_600_000,
};

const CONFIRMATION_THRESHOLD = 3;
const DISMISSAL_THRESHOLD    = 5;
const CONFIRMATION_POINTS    = 40;
const CONFIRMATION_RADIUS_M  = 200;
const EXTENSION_FRACTION     = 0.5; // 50% of original TTL

// ─── Create ────────────────────────────────────────────────────────────────────

export function createReport(
  reporterId: string,
  type: ReportType,
  coords: Coords,
  description: string,
  gemId?: number,
  nowMs?: number
): SafetyReport {
  const now = nowMs ?? Date.now();
  const ttl = EXPIRY_MS[type];
  return {
    id: `report_${now}_${Math.random().toString(36).slice(2, 8)}`,
    reporterId,
    type,
    coords,
    gemId,
    description,
    status: "Unconfirmed",
    confirmations: [],
    dismissals: [],
    createdAt: now,
    expiresAt: now + ttl,
    extendedBy: 0,
  };
}

/**
 * Advanced Spatial Clustering
 * Detects if a new report is a duplicate of an existing active report within a 50m radius.
 */
export function findDuplicateReport(
  type: ReportType,
  coords: Coords,
  activeReports: SafetyReport[]
): SafetyReport | undefined {
  return activeReports.find(
    (r) => r.type === type && r.status !== "Expired" && r.status !== "Dismissed" && haversineDistance(r.coords, coords) < 50
  );
}

// ─── Confirm / Dismiss ────────────────────────────────────────────────────────

export interface ConfirmResult {
  report: SafetyReport;
  justConfirmed: boolean;       // hit the threshold this action
  pointsForReporter: number;
}

export function confirmReport(report: SafetyReport, userId: string, weight: number = 1): ConfirmResult {
  if (report.confirmations.includes(userId) || report.dismissals.includes(userId)) {
    return { report, justConfirmed: false, pointsForReporter: 0 };
  }
  
  // Advanced reputation-weighted voting: if weight > 1, we push the user ID multiple times to simulate higher weight 
  // without altering the data schema, or we just calculate length.
  const newConfirmations = new Array(Math.floor(weight)).fill(userId);
  const confirmations = [...report.confirmations, ...newConfirmations];
  
  const justConfirmed = confirmations.length >= CONFIRMATION_THRESHOLD && report.status === "Unconfirmed";
  const updatedReport: SafetyReport = {
    ...report,
    confirmations,
    status: report.status === "Unconfirmed" && justConfirmed ? "Confirmed" : report.status,
  };
  return { report: updatedReport, justConfirmed, pointsForReporter: justConfirmed ? CONFIRMATION_POINTS : 0 };
}

export function dismissReport(report: SafetyReport, userId: string): SafetyReport {
  if (report.confirmations.includes(userId) || report.dismissals.includes(userId)) return report;
  const dismissals = [...report.dismissals, userId];
  const autoDismissed = dismissals.length >= DISMISSAL_THRESHOLD && report.confirmations.length < CONFIRMATION_THRESHOLD;
  return {
    ...report,
    dismissals,
    status: autoDismissed ? "Dismissed" : report.status,
  };
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

export function isExpired(report: SafetyReport, nowMs?: number): boolean {
  return (nowMs ?? Date.now()) >= report.expiresAt;
}

export function extendReport(report: SafetyReport): SafetyReport {
  const originalTTL = EXPIRY_MS[report.type];
  const extension   = Math.round(originalTTL * EXTENSION_FRACTION);
  return {
    ...report,
    expiresAt: report.expiresAt + extension,
    extendedBy: report.extendedBy + 1,
  };
}

export function expireReport(report: SafetyReport): SafetyReport {
  return { ...report, status: "Expired" };
}

/** Run on a batch of reports — returns updated list with expired ones marked */
export function processExpiredReports(reports: SafetyReport[], nowMs?: number): SafetyReport[] {
  const now = nowMs ?? Date.now();
  return reports.map((r) =>
    r.status !== "Expired" && r.status !== "Dismissed" && isExpired(r, now)
      ? expireReport(r)
      : r
  );
}

// ─── Gem safety score ─────────────────────────────────────────────────────────

/** Returns 0–5 score for a gem based on active reports in its area */
export function getGemSafetyScore(gemId: number | undefined, activeReports: SafetyReport[]): number {
  const relevant = activeReports.filter(
    (r) => r.status === "Confirmed" && (r.gemId === gemId || r.gemId === undefined)
  );
  return Math.max(0, 5 - relevant.length * 0.5);
}

// ─── Per-user rate limit ──────────────────────────────────────────────────────

export function canSubmitReport(
  userId: string,
  hasLocalMode: boolean,
  reports: SafetyReport[],
  nowMs?: number
): { allowed: boolean; reason?: string } {
  const now = nowMs ?? Date.now();
  const dailyLimit = hasLocalMode ? 5 : 1;
  const todayReports = reports.filter(
    (r) => r.reporterId === userId && now - r.createdAt < 86_400_000
  );
  if (todayReports.length >= dailyLimit) {
    return { allowed: false, reason: `Daily limit of ${dailyLimit} reports reached.` };
  }
  return { allowed: true };
}

export { CONFIRMATION_RADIUS_M };
