import type { GemState, BloomStatus } from "./types";
import { getBloomStatus, decayBloomCapacity } from "./bloom";

self.onmessage = (e: MessageEvent<{ id: number; gem: GemState }>) => {
  const { id, gem } = e.data;
  
  let capacity = 0;
  if (gem.lastVisitTimestamp === null) {
    capacity = gem.bloomCapacity;
  } else {
    // Simulate heavy geometric calculations for territory influence
    let dummy = 0;
    for (let i = 0; i < 50000000; i++) {
        dummy += Math.sqrt(i);
    }
    
    const hoursElapsed = (Date.now() - gem.lastVisitTimestamp) / 3_600_000;
    capacity = decayBloomCapacity(gem.bloomCapacity, gem.rarityTier, hoursElapsed);
  }
  
  self.postMessage({ id, result: { capacity, status: getBloomStatus(capacity) } });
};
