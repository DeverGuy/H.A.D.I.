import type { CommunityPost, VoteResult, UserStats } from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const KARMA_PER_UPVOTE   =  1;
const KARMA_PER_DOWNVOTE = -1;
const AUTO_HIDE_THRESHOLD = -5;
const VOTE_CHANGE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Post karma milestone milestones (cumulative karma → unlock)
export const KARMA_MILESTONES: { karma: number; unlock: string }[] = [
  { karma: 50,   unlock: "Can post Stories" },
  { karma: 100,  unlock: "Profile karma badge" },
  { karma: 250,  unlock: "Community Highlights" },
  { karma: 500,  unlock: "Local Expert badge eligible" },
  { karma: 1000, unlock: "Trusted content reporter" },
];

// ─── Voting ────────────────────────────────────────────────────────────────────

export function castVote(
  post: CommunityPost,
  voterId: string,
  direction: "up" | "down",
  nowMs?: number
): { updatedPost: CommunityPost; result: VoteResult } {
  const now = nowMs ?? Date.now();
  const existing = post.votes[voterId];

  // Self-vote guard
  if (voterId === post.authorId) {
    return {
      updatedPost: post,
      result: { newUpvotes: post.upvotes, newDownvotes: post.downvotes, newScore: post.score, karmaChange: 0, autoHidden: false },
    };
  }

  const votes = { ...post.votes };
  let upvotes = post.upvotes;
  let downvotes = post.downvotes;
  let karmaChange = 0;

  if (existing === direction) {
    // Toggle off — remove vote
    delete votes[voterId];
    if (direction === "up") { upvotes--; karmaChange = -KARMA_PER_UPVOTE; }
    else { downvotes--; karmaChange = -KARMA_PER_DOWNVOTE; /* refunding a -1 adds +1 */ }
  } else {
    if (existing) {
      // Switching direction (within change window only — enforced in store)
      if (existing === "up") { upvotes--; karmaChange -= KARMA_PER_UPVOTE; }
      else { downvotes--; karmaChange -= KARMA_PER_DOWNVOTE; }
    }
    votes[voterId] = direction;
    if (direction === "up") { upvotes++; karmaChange += KARMA_PER_UPVOTE; }
    else { downvotes++; karmaChange += KARMA_PER_DOWNVOTE; /* -1 applied */ }
  }

  const score = upvotes - downvotes;
  const autoHidden = score < AUTO_HIDE_THRESHOLD;

  const updatedPost: CommunityPost = { ...post, votes, upvotes, downvotes, score };
  const result: VoteResult = { newUpvotes: upvotes, newDownvotes: downvotes, newScore: score, karmaChange, autoHidden };

  void now; // timestamp available for vote-change-window enforcement if needed
  return { updatedPost, result };
}

// ─── Advanced Ranking Algorithm ───────────────────────────────────────────────

/**
 * Calculates the lower bound of the Wilson score confidence interval for a Bernoulli parameter.
 * Used to rank community posts by "best" rather than simple upvotes - downvotes.
 */
export function calculateWilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;
  const z = 1.96; // 95% confidence interval
  const phat = upvotes / n;
  const z2 = z * z;
  return (phat + z2 / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n)) / (1 + z2 / n);
}

export function sortPostsByBest(posts: CommunityPost[]): CommunityPost[] {
  return [...posts].sort((a, b) => calculateWilsonScore(b.upvotes, b.downvotes) - calculateWilsonScore(a.upvotes, a.downvotes));
}

// ─── Karma calculation ────────────────────────────────────────────────────────

export function calculateKarma(posts: CommunityPost[], authorId: string): number {
  return posts
    .filter((p) => p.authorId === authorId)
    .reduce((sum, p) => sum + p.score, 0);
}

/**
 * Decays karma if the user has been inactive.
 * Allows a 30-day grace period, then decays karma slightly every day to encourage continuous engagement.
 */
export function calculateDecayedKarma(baseKarma: number, lastActivityMs: number, nowMs?: number): number {
  const now = nowMs ?? Date.now();
  const inactiveDays = Math.max(0, (now - lastActivityMs) / (24 * 3_600_000));
  if (inactiveDays <= 30) return baseKarma; // 30 day grace period
  
  const decayFactor = Math.pow(0.99, inactiveDays - 30); // 1% loss per day after 30 days
  return Math.floor(baseKarma * decayFactor);
}

// ─── Local Expert badge eligibility ──────────────────────────────────────────

export interface LocalExpertCheck {
  eligible: boolean;
  reasons: string[];
}

export function checkLocalExpertEligibility(
  stats: UserStats,
  posts: CommunityPost[],
  accountAgeDays: number
): LocalExpertCheck {
  const reasons: string[] = [];
  const authorPosts = posts.filter((p) => p.authorId === stats.userId);
  const qualifyingPosts = authorPosts.filter((p) => p.score >= 10);

  if (qualifyingPosts.length < 25) reasons.push(`Need ${25 - qualifyingPosts.length} more posts with ≥10 net score`);
  if (accountAgeDays < 60) reasons.push(`Account must be ≥60 days old (${60 - accountAgeDays} days to go)`);
  if (!stats.hasLocalMode) reasons.push("Local Mode must be active");
  if (stats.karma < 500) reasons.push(`Need ${500 - stats.karma} more karma`);

  // Category coverage: at least 5 qualifying posts per required category (simplified check)
  const requiredCategories = ["Local Tips", "Safety Notes", "Hidden Finds"];
  for (const cat of requiredCategories) {
    const count = qualifyingPosts.filter((p) => p.category === cat).length;
    if (count < 5) reasons.push(`Need ${5 - count} more qualifying '${cat}' posts`);
  }

  return { eligible: reasons.length === 0, reasons };
}

// ─── Post validation ──────────────────────────────────────────────────────────

export const POST_MAX_LENGTHS: Record<string, number> = {
  "Local Tips":    280,
  "Hidden Finds":  280,
  "Safety Notes":  500,
  Story:           2000,
};

export function validatePostBody(body: string, category: string): { valid: boolean; error?: string } {
  const max = POST_MAX_LENGTHS[category] ?? 280;
  if (!body.trim()) return { valid: false, error: "Post body cannot be empty." };
  if (body.length > max) return { valid: false, error: `${category} posts max ${max} characters.` };
  return { valid: true };
}
