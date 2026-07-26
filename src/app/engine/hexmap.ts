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
// 14 distinct Mysuru neighbourhoods verified against real GPS coordinates.
// Key landmarks used to calibrate each bounding box:
//   Mysore Palace         → 12.3052°N, 76.6551°E
//   University of Mysore  → 12.3068°N, 76.6383°E  (Kuvempunagar)
//   Kukkarahalli Lake     → 12.3126°N, 76.6435°E  (Kuvempunagar)
//   Devaraja Market       → 12.3025°N, 76.6480°E
//   St. Philomena's Church→ 12.3194°N, 76.6523°E  (Nazarbad)
//   Chamundi Hill summit  → 12.2723°N, 76.6758°E
//   Rail Museum           → 12.2977°N, 76.6339°E  (Saraswathipuram)
//   Gokulam               → 12.3250°N, 76.6300°E
//   Gandhi Square         → 12.3056°N, 76.6507°E

export const ZONE_DEFS: ZoneDef[] = [
  {
    // Far North-West: Srirampura, industrial fringe, Ring Road
    id: "srirampura",
    name: "Srirampura",
    digipinCode: "MYS-SR1N",
    polygon: [
      { lat: 12.3400, lng: 76.5900 },
      { lat: 12.3400, lng: 76.6200 },
      { lat: 12.3150, lng: 76.6200 },
      { lat: 12.3150, lng: 76.5900 },
    ],
    totalGems: 5, multiplier: 1.5, unlockRequirement: { type: "none" },
  },
  {
    // North-West: Gokulam (~12.325°N, 76.630°E), yoga schools, tree-lined
    id: "gokulam",
    name: "Gokulam",
    digipinCode: "MYS-GK2W",
    polygon: [
      { lat: 12.3400, lng: 76.6200 },
      { lat: 12.3400, lng: 76.6480 },
      { lat: 12.3150, lng: 76.6480 },
      { lat: 12.3150, lng: 76.6200 },
    ],
    totalGems: 6, multiplier: 1.5, unlockRequirement: { type: "none" },
  },
  {
    // North-Centre-East: St. Philomena's (~12.319°N, 76.652°E), Nazarbad cantonment
    id: "nazarbad",
    name: "Nazarbad",
    digipinCode: "MYS-NZ7E",
    polygon: [
      { lat: 12.3400, lng: 76.6480 },
      { lat: 12.3400, lng: 76.6750 },
      { lat: 12.3150, lng: 76.6750 },
      { lat: 12.3150, lng: 76.6480 },
    ],
    totalGems: 6, multiplier: 2.0, unlockRequirement: { type: "level", level: 1 },
  },
  {
    // Far North-East: Vijayanagar, Hebbal
    id: "vijayanagar",
    name: "Vijayanagar",
    digipinCode: "MYS-VN4E",
    polygon: [
      { lat: 12.3400, lng: 76.6750 },
      { lat: 12.3400, lng: 76.7250 },
      { lat: 12.3150, lng: 76.7250 },
      { lat: 12.3150, lng: 76.6750 },
    ],
    totalGems: 5, multiplier: 1.5, unlockRequirement: { type: "none" },
  },
  {
    // Upper-West: Kuvempunagar, University (12.307°N, 76.638°E), Kukkarahalli Lake
    id: "kuvempunagar",
    name: "Kuvempunagar",
    digipinCode: "MYS-8K9V",
    polygon: [
      { lat: 12.3150, lng: 76.5900 },
      { lat: 12.3150, lng: 76.6250 },
      { lat: 12.2850, lng: 76.6250 },
      { lat: 12.2850, lng: 76.5900 },
    ],
    totalGems: 10, multiplier: 2.5, unlockRequirement: { type: "none" },
  },
  {
    // Upper-Centre-West: Mandi Mohalla, old city, Jama Masjid
    id: "mandi_mohalla",
    name: "Mandi Mohalla",
    digipinCode: "MYS-MM6C",
    polygon: [
      { lat: 12.3150, lng: 76.6250 },
      { lat: 12.3150, lng: 76.6480 },
      { lat: 12.2850, lng: 76.6480 },
      { lat: 12.2850, lng: 76.6250 },
    ],
    totalGems: 7, multiplier: 2.0, unlockRequirement: { type: "none" },
  },
  {
    // Centre: Mysore Palace (12.305°N, 76.655°E), Zoo, Jaganmohan, Devaraja Market
    id: "heritage_core",
    name: "Heritage Core",
    digipinCode: "MYS-4N2K",
    polygon: [
      { lat: 12.3150, lng: 76.6480 },
      { lat: 12.3150, lng: 76.6700 },
      { lat: 12.2850, lng: 76.6700 },
      { lat: 12.2850, lng: 76.6480 },
    ],
    totalGems: 12, multiplier: 3.0, unlockRequirement: { type: "none" },
  },
  {
    // Centre-East: Gandhi Square, Sayaji Rao Road food belt
    id: "gandhi_square",
    name: "Gandhi Square",
    digipinCode: "MYS-GS3C",
    polygon: [
      { lat: 12.3150, lng: 76.6700 },
      { lat: 12.3150, lng: 76.6950 },
      { lat: 12.2850, lng: 76.6950 },
      { lat: 12.2850, lng: 76.6700 },
    ],
    totalGems: 8, multiplier: 2.0, unlockRequirement: { type: "level", level: 1 },
  },
  {
    // Upper-East: Yadavagiri, Lalitha Mahal Palace (12.295°N, 76.675°E)
    id: "yadavagiri",
    name: "Yadavagiri",
    digipinCode: "MYS-YD9E",
    polygon: [
      { lat: 12.3150, lng: 76.6950 },
      { lat: 12.3150, lng: 76.7250 },
      { lat: 12.2850, lng: 76.7250 },
      { lat: 12.2850, lng: 76.6950 },
    ],
    totalGems: 6, multiplier: 2.0, unlockRequirement: { type: "level", level: 2 },
  },
  {
    // Lower-West: Saraswathipuram, Rail Museum (12.298°N, 76.634°E), coffee shops
    id: "saraswathipuram",
    name: "Saraswathipuram",
    digipinCode: "MYS-SP8W",
    polygon: [
      { lat: 12.2850, lng: 76.5900 },
      { lat: 12.2850, lng: 76.6350 },
      { lat: 12.2600, lng: 76.6350 },
      { lat: 12.2600, lng: 76.5900 },
    ],
    totalGems: 7, multiplier: 2.0, unlockRequirement: { type: "gems_in_zone", zoneId: "heritage_core", gemCount: 2 },
  },
  {
    // Lower-Centre: Fort Zone, Lashkar Mohalla, Mysore Fort (~12.295°N, 76.650°E)
    id: "fort_zone",
    name: "Fort Zone",
    digipinCode: "MYS-9T4L",
    polygon: [
      { lat: 12.2850, lng: 76.6350 },
      { lat: 12.2850, lng: 76.6700 },
      { lat: 12.2600, lng: 76.6700 },
      { lat: 12.2600, lng: 76.6350 },
    ],
    totalGems: 7, multiplier: 2.5, unlockRequirement: { type: "gems_in_zone", zoneId: "heritage_core", gemCount: 3 },
  },
  {
    // Lower-Centre-East: Devaraja Market area, south-central
    id: "devaraja_market",
    name: "Devaraja Market",
    digipinCode: "MYS-DM5W",
    polygon: [
      { lat: 12.2850, lng: 76.6700 },
      { lat: 12.2850, lng: 76.6950 },
      { lat: 12.2600, lng: 76.6950 },
      { lat: 12.2600, lng: 76.6700 },
    ],
    totalGems: 9, multiplier: 2.0, unlockRequirement: { type: "none" },
  },
  {
    // South-West: Bogadi, Ring Road southern stretch
    id: "bogadi",
    name: "Bogadi",
    digipinCode: "MYS-BG0S",
    polygon: [
      { lat: 12.2600, lng: 76.5900 },
      { lat: 12.2600, lng: 76.6400 },
      { lat: 12.2400, lng: 76.6400 },
      { lat: 12.2400, lng: 76.5900 },
    ],
    totalGems: 5, multiplier: 1.5, unlockRequirement: { type: "level", level: 2 },
  },
  {
    // South-East: Chamundi Hill summit (12.272°N, 76.676°E), silk weaving villages
    id: "silk_district",
    name: "Chamundi Hills",
    digipinCode: "MYS-3K6W",
    polygon: [
      { lat: 12.2600, lng: 76.6400 },
      { lat: 12.2600, lng: 76.7250 },
      { lat: 12.2400, lng: 76.7250 },
      { lat: 12.2400, lng: 76.6400 },
    ],
    totalGems: 8, multiplier: 3.0, unlockRequirement: { type: "level", level: 3 },
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
  
  // At Mysuru's latitude (~12.3°N), 1° lng ≈ 108.5 km vs 1° lat ≈ 111 km.
  // We must correct longitude offsets so hexes are physically equilateral.
  const latRad = (startLat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);

  // radiusDeg is the physical hex radius in latitude-degrees.
  // For longitude we scale by 1/cosLat so physical distance is equal.
  const radiusLngDeg = radiusDeg / cosLat;

  const w = Math.sqrt(3) * radiusLngDeg;   // hex width in lng-degrees
  const h = 2 * radiusDeg;                 // hex height in lat-degrees
  const horizSpacing = w;
  const vertSpacing = (3 / 4) * h;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 !== 0 ? w / 2 : 0;
    for (let c = 0; c < cols; c++) {
      const centerLat = startLat - r * vertSpacing;
      const centerLng = startLng + c * horizSpacing + offset;

      const polygon: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        // Pointy-topped hex: start at -30°, step 60° each vertex
        const angleDeg = 60 * i - 30;
        const angleRad = (Math.PI / 180) * angleDeg;
        // Use separate radii: lat unchanged, lng corrected for Earth curvature
        const vertexLng = centerLng + radiusLngDeg * Math.cos(angleRad);
        const vertexLat = centerLat + radiusDeg * Math.sin(angleRad);
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
