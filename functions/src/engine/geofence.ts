import { allGems } from "../data/gems";
import { haversineDistance } from "./checkin";
import type { Coords } from "./types";
import type { GemState } from "./types";

const NOTIFICATION_RADIUS = 200; // Notify when within 200m
const GEOFENCE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours cooldown per gem
const GRID_CELL_SIZE = 0.005; // ~500m grid cell size in degrees

let watchId: number | null = null;
const notifiedGems = new Map<number, number>(); // gemId -> timestamp

// ─── Spatial Hash Grid ────────────────────────────────────────────────────────

// Map "lat,lng" cell key -> Array of gems in that cell
const spatialGrid = new Map<string, typeof allGems>();

function getCellKey(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / GRID_CELL_SIZE);
  const cellLng = Math.floor(lng / GRID_CELL_SIZE);
  return `${cellLat},${cellLng}`;
}

// Pre-compute spatial grid at module load time (O(N) once)
allGems.forEach(gem => {
  const key = getCellKey(gem.coords.lat, gem.coords.lng);
  if (!spatialGrid.has(key)) {
    spatialGrid.set(key, []);
  }
  spatialGrid.get(key)!.push(gem);
});

/**
 * Returns gems in the user's cell and the 8 adjacent cells (O(1) lookup).
 */
function getNearbyGemsFromGrid(lat: number, lng: number) {
  const cellLat = Math.floor(lat / GRID_CELL_SIZE);
  const cellLng = Math.floor(lng / GRID_CELL_SIZE);
  
  const nearby: typeof allGems = [];
  
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const key = `${cellLat + dLat},${cellLng + dLng}`;
      const gemsInCell = spatialGrid.get(key);
      if (gemsInCell) {
        nearby.push(...gemsInCell);
      }
    }
  }
  return nearby;
}

export function startGeofence(onNearGem: (gemName: string, distance: number) => void) {
  if (!("geolocation" in navigator)) return;
  if (!("Notification" in window)) return;

  Notification.requestPermission();

  if (watchId !== null) return;

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const userCoords: Coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const now = Date.now();
      
      // O(1) Spatial query instead of O(N) array loop
      const gemsToCheck = getNearbyGemsFromGrid(userCoords.lat, userCoords.lng);

      gemsToCheck.forEach((gem) => {
        const distance = haversineDistance(userCoords, gem.coords);
        if (distance <= NOTIFICATION_RADIUS) {
          const lastNotified = notifiedGems.get(gem.id) || 0;
          if (now - lastNotified > GEOFENCE_COOLDOWN) {
            notifiedGems.set(gem.id, now);
            onNearGem(gem.name, distance);

            // Trigger system notification if backgrounded
            if (Notification.permission === "granted" && document.visibilityState === "hidden") {
              new Notification("HADI: Hidden Gem Nearby! 💎", {
                body: `You are ${Math.round(distance)}m away from ${gem.name}. Open HADI to check in!`,
                icon: "/pwa-192x192.png"
              });
            }
          }
        }
      });
    },
    (err) => {
      console.warn("Geofence watch error:", err);
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

export function stopGeofence() {
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}
