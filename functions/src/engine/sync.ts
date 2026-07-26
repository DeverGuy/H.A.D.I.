/**
 * Advanced Offline-First Optimistic Sync Engine
 * Uses a persistent queue with exponential backoff to handle intermittent connectivity.
 */

import { localStorage_ } from "./cache";

export type SyncMutation = {
  id: string;
  type: "checkin" | "safety_report" | "redeem" | "submit_gem";
  payload: any;
  timestamp: number;
  retryCount: number;
};

class SyncEngine {
  private queue: SyncMutation[] = [];
  private isProcessing = false;
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 2000;

  constructor() {
    this.loadQueue();
    // Listen for network reconnects to flush queue
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processQueue());
    }
  }

  private loadQueue() {
    this.queue = localStorage_.get<SyncMutation[]>("sync_queue") || [];
  }

  private saveQueue() {
    localStorage_.set("sync_queue", this.queue);
  }

  /**
   * Pushes a mutation to the queue for background synchronization.
   */
  public enqueue(type: SyncMutation["type"], payload: any) {
    const mutation: SyncMutation = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };
    this.queue.push(mutation);
    this.saveQueue();
    this.processQueue();
  }

  /**
   * Processes the queue with Exponential Backoff
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (!navigator.onLine) return; // Wait for reconnect

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const mutation = this.queue[0];
      
      try {
        await this.simulateNetworkRequest(mutation);
        // Success: Remove from queue
        this.queue.shift();
        this.saveQueue();
      } catch (error) {
        // Failure: Exponential backoff calculation
        mutation.retryCount++;
        this.saveQueue();

        if (mutation.retryCount >= this.MAX_RETRIES) {
          console.error(`Mutation ${mutation.id} failed after ${this.MAX_RETRIES} retries. Dropping.`);
          this.queue.shift();
          this.saveQueue();
        } else {
          // Wait exponentially longer before next attempt
          const backoff = this.BASE_DELAY_MS * Math.pow(2, mutation.retryCount);
          console.warn(`Sync failed. Retrying in ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Simulates a flaky network request to a remote server.
   * In a real app, this would use fetch() to push to Firebase/REST.
   */
  private async simulateNetworkRequest(mutation: SyncMutation): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 10% network failure rate
        if (Math.random() < 0.1) {
          reject(new Error("Simulated network timeout"));
        } else {
          console.log(`[SyncEngine] Successfully synced: ${mutation.type}`);
          resolve();
        }
      }, 800);
    });
  }
}

export const syncEngine = new SyncEngine();
