import type { ZoneDef, ZoneProgress, ZoneUnlockReq, UserStats, HexStatus, Coords } from "./types";

// ─── Mathematical Ray-Casting Algorithm ───────────────────────────────────────

/**
 * Advanced Point-in-Polygon validation using the Ray-Casting algorithm.
 * Casts a horizontal ray from the coordinate and counts boundary intersections.
 * Even count = outside, Odd count = inside.
 */
export function isPointInPolygon(point: Coords, polygon: Coords[]): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
        (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

// ─── Zone definitions ──────────────────────────────────────────────────────────
// Polygons define real geographic bounding boxes across Mysuru city.
// The hex grid spans: lat 12.241–12.340, lng 76.590–76.725
// Zones are laid out as a city map — each covers a distinct real neighborhood.

export const ZONE_DEFS: ZoneDef[] = [
  {
    // North-West quadrant: Devaraja market, silk bazaar, Chamaraja ward
    id: "artisan_quarter",
    name: "Artisan Quarter",
    digipinCode: "MYS-7R8P",
    polygon: [
      { lat: 12.3400, lng: 76.5900 },
      { lat: 12.3400, lng: 76.6350 },
      { lat: 12.3050, lng: 76.6350 },
      { lat: 12.3050, lng: 76.5900 },
    ],
    totalGems: 9,
    multiplier: 2.0,
    unlockRequirement: { type: "none" },
  },
  {
    // North-East quadrant: St. Philomena's Church, Nazarbad, Vijayanagar
    id: "street_food_belt",
    name: "Street Food Belt",
    digipinCode: "MYS-1F5Q",
    polygon: [
      { lat: 12.3400, lng: 76.6350 },
      { lat: 12.3400, lng: 76.7250 },
      { lat: 12.3050, lng: 76.7250 },
      { lat: 12.3050, lng: 76.6350 },
    ],
    totalGems: 8,
    multiplier: 1.5,
    unlockRequirement: { type: "level", level: 1 },
  },
  {
    // Middle-West: Kuvempunagar, University of Mysore, Kukkarahalli Lake
    id: "kuvempunagar",
    name: "Kuvempunagar",
    digipinCode: "MYS-8K9V",
    polygon: [
      { lat: 12.3050, lng: 76.5900 },
      { lat: 12.3050, lng: 76.6350 },
      { lat: 12.2700, lng: 76.6350 },
      { lat: 12.2700, lng: 76.5900 },
    ],
    totalGems: 10,
    multiplier: 2.5,
    unlockRequirement: { type: "none" },
  },
  {
    // Middle-Centre: Mysore Palace, Zoo, Jaganmohan Palace, Fort
    id: "heritage_core",
    name: "Heritage Core",
    digipinCode: "MYS-4N2K",
    polygon: [
      { lat: 12.3050, lng: 76.6350 },
      { lat: 12.3050, lng: 76.6700 },
      { lat: 12.2700, lng: 76.6700 },
      { lat: 12.2700, lng: 76.6350 },
    ],
    totalGems: 12,
    multiplier: 3.0,
    unlockRequirement: { type: "none" },
  },
  {
    // Middle-East: Chamundi Hill foothills, Lalitha Mahal, Yadavagiri
    id: "fort_zone",
    name: "Fort Zone",
    digipinCode: "MYS-9T4L",
    polygon: [
      { lat: 12.3050, lng: 76.6700 },
      { lat: 12.3050, lng: 76.7250 },
      { lat: 12.2700, lng: 76.7250 },
      { lat: 12.2700, lng: 76.6700 },
    ],
    totalGems: 7,
    multiplier: 2.0,
    unlockRequirement: { type: "gems_in_zone", zoneId: "heritage_core", gemCount: 3 },
  },
  {
    // South: Chamundi Hill, Brindavan Gardens area, Bogadi, south outskirts
    id: "silk_district",
    name: "Silk District",
    digipinCode: "MYS-3K6W",
    polygon: [
      { lat: 12.2700, lng: 76.5900 },
      { lat: 12.2700, lng: 76.7250 },
      { lat: 12.2400, lng: 76.7250 },
      { lat: 12.2400, lng: 76.5900 },
    ],
    totalGems: 6,
    multiplier: 2.5,
    unlockRequirement: { type: "level", level: 2 },
  },
];

// ─── Geographic Hex Grid Math ──────────────────────────────────────────────────

export interface GeoHex {
  row: number;
  col: number;
  centerLat: number;
  centerLng: number;
  polygon: [number, number][]; // [lat, lng] array for Leaflet
}

/**
 * Generates a grid of Pointy-Topped hexagons geographically.
 */
export function generateGeoHexGrid(
  startLat: number, 
  startLng: number, 
  radiusDeg: number, 
  rows: number, 
  cols: number
): GeoHex[] {
  const hexes: GeoHex[] = [];
  
  const w = Math.sqrt(3) * radiusDeg;
  const h = 2 * radiusDeg;
  
  // Horizontal spacing between column centers
  const horizSpacing = w;
  // Vertical spacing between row centers
  const vertSpacing = (3/4) * h;

  for (let r = 0; r < rows; r++) {
    // Offset odd rows to the right by half the width
    const offset = (r % 2 !== 0) ? (w / 2) : 0;
    
    for (let c = 0; c < cols; c++) {
      // In a standard grid, lat goes down (South) as row increases, and lng goes right (East) as col increases
      const centerLat = startLat - (r * vertSpacing); 
      const centerLng = startLng + (c * horizSpacing) + offset;
      
      // Calculate the 6 vertices for a pointy-topped hex
      const polygon: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        // -30 degrees (or -PI/6) offsets the vertices to make it pointy-topped
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const vertexLng = centerLng + radiusDeg * Math.cos(angle_rad);
        const vertexLat = centerLat + radiusDeg * Math.sin(angle_rad);
        polygon.push([vertexLat, vertexLng]);
      }
      
      hexes.push({ row: r, col: c, centerLat, centerLng, polygon });
    }
  }
  
  return hexes;
}

// ─── Digipin → multiplier lookup ──────────────────────────────────────────────

const CODE_MULTIPLIER: Record<string, number> = Object.fromEntries(
  ZONE_DEFS.map((z) => [z.digipinCode, z.multiplier])
);

export function getZoneMultiplier(digipinCode: string): number {
  return CODE_MULTIPLIER[digipinCode] ?? 1.0;
}

export function getZoneByDigipin(code: string): ZoneDef | undefined {
  return ZONE_DEFS.find((z) => z.digipinCode === code);
}

/** Determines which mathematically bounded zone a coordinate belongs to */
export function getZoneForCoordinate(coords: Coords): ZoneDef | undefined {
  return ZONE_DEFS.find(z => z.polygon && isPointInPolygon(coords, z.polygon));
}

// ─── Zone unlock check ────────────────────────────────────────────────────────

export function isZoneUnlocked(
  zone: ZoneDef,
  stats: UserStats,
  visitedGemsByZone: Record<string, number>,
  unlockedBadges: Set<string>,
  userLevelIndex: number
): boolean {
  const req: ZoneUnlockReq = zone.unlockRequirement;
  switch (req.type) {
    case "none": return true;
    case "gems_in_zone":
      return (visitedGemsByZone[req.zoneId!] ?? 0) >= (req.gemCount ?? 1);
    case "level":
      return userLevelIndex >= (req.level ?? 0);
    case "badge":
      return unlockedBadges.has(req.badge ?? "");
    default: return false;
  }
}

// ─── Zone completion ──────────────────────────────────────────────────────────

export function getZoneCompletion(
  zone: ZoneDef,
  visitedGemsInZone: number
): ZoneProgress {
  const visited = Math.min(visitedGemsInZone, zone.totalGems);
  const completionPct = zone.totalGems > 0
    ? Math.round((visited / zone.totalGems) * 100)
    : 0;
  return {
    zoneId: zone.id,
    visitedGems: visited,
    totalGems: zone.totalGems,
    completionPct,
    unlocked: true, // caller should check isZoneUnlocked separately
    masterBadgeEarned: completionPct === 100,
  };
}

// ─── Hex cell status transitions ──────────────────────────────────────────────

/**
 * Determine a hex cell's display status from game state.
 *  - "locked"   → zone not unlocked
 *  - "active"   → zone unlocked, no gem visited here yet
 *  - "explored" → user has visited a gem in this cell
 *  - "gem"      → user has visited an Epic/Legendary gem in this cell
 */
export function getHexDisplayStatus(
  isZoneUnlocked: boolean,
  gemVisited: boolean,
  hasLegendaryOrEpic: boolean
): HexStatus {
  if (!isZoneUnlocked) return "locked";
  if (!gemVisited)     return "active";
  if (hasLegendaryOrEpic) return "gem";
  return "explored";
}

/** Completion bonus: 500 pts awarded when a zone hits 100% for the first time */
export const ZONE_MASTER_BONUS_PTS = 500;
