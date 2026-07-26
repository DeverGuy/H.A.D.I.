import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { ZONE_DEFS, getHexDisplayStatus, generateGeoHexGrid } from "../../engine/hexmap";

type HexStatus = "explored" | "active" | "gem" | "locked";

interface HexZone {
  row: number;
  col: number;
  status: HexStatus;
  zoneId: string;
  zoneName: string;
  digipinCode: string;
  multiplier: "1.5×" | "2.0×" | "2.5×" | "3.0×";
  gemId: number | null;
  density: "High" | "Medium" | "Low";
  gemsCount: number;
  safetyScore: number;
  polygon: [number, number][]; // Leaflet LatLngTuple
  centerLat: number;
  centerLng: number;
}

const hexStatusColors: Record<HexStatus, string> = {
  explored: "rgba(26, 82, 82, 0.6)",
  active: "rgba(224, 123, 42, 0.6)", 
  gem: "rgba(201, 146, 31, 0.8)",
  locked: "rgba(255, 255, 255, 0.05)",
};

const hexStatusStrokes: Record<HexStatus, string> = {
  explored: "#1A5252",
  active: "#E07B2A", 
  gem: "#FFD700",
  locked: "rgba(255, 255, 255, 0.2)",
};

const densityConfig = {
  High: { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  Medium: { color: "#d97706", bg: "rgba(217,119,6,0.1)" },
  Low: { color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
};

const multiplierConfig = {
  "1.5×": { color: "#7A6A55", bg: "rgba(122,106,85,0.1)" },
  "2.0×": { color: "#E07B2A", bg: "rgba(224,123,42,0.12)" },
  "2.5×": { color: "#C9921F", bg: "rgba(201,146,31,0.15)" },
  "3.0×": { color: "#FFD700", bg: "rgba(255,215,0,0.15)" },
};

export function HexMap() {
  const { darkMode } = useApp();
  const C = useColors();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState<HexZone | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  
  const { allGems, visitedGemIds, isZoneUnlockedFn } = useGame();

  // Generate real-time grid based on game state
  const grid = useMemo(() => {
    // Generate geographic hexes over Mysuru
    // Center of Mysuru ~ 12.3051, 76.6450
    // A radius of 0.005 degrees is approx 500 meters width per hex
    const geoHexes = generateGeoHexGrid(12.3400, 76.5900, 0.006, 12, 14);
    
    // Distribute actual gems to some random hexes for visual effect (just mapping 10 gems)
    const gemCoords: Record<string, number> = {
      "3,5": 1, "4,8": 2, "6,6": 3, "8,3": 4, "7,9": 5,
      "9,7": 6, "3,11": 7, "1,8": 8, "5,2": 9, "9,10": 10
    };

    return geoHexes.map((geoHex) => {
      const r = geoHex.row;
      const c = geoHex.col;
      // Procedurally assign zones so they clump geographically
      const zoneIdx = Math.floor((r / 12) * 2.5 + (c / 14) * 2.5) % ZONE_DEFS.length;
      const zone = ZONE_DEFS[zoneIdx];
      
      const gemId = gemCoords[`${r},${c}`] || null;
      const gemData = gemId ? allGems.find(x => x.id === gemId) : null;
      
      const isUnlocked = isZoneUnlockedFn(zone.id);
      const isVisited = gemId ? visitedGemIds.has(gemId) : false;
      const isLegendary = gemData?.rarityTier === "Epic" || gemData?.rarityTier === "Legendary";
      
      let status: HexStatus = "locked";
      
      if (gemId) {
        status = getHexDisplayStatus(isUnlocked, isVisited, isLegendary);
      } else {
        status = isUnlocked ? "active" : "locked";
        // Visual noise
        if (isUnlocked && ((r * 7 + c * 3) % 10) > 6) {
           status = "explored";
        }
      }

      return {
        row: r,
        col: c,
        status,
        zoneId: zone.id,
        zoneName: zone.name,
        digipinCode: zone.digipinCode || `MYS-${r}${c}X`,
        multiplier: `${zone.multiplier.toFixed(1)}×` as any,
        gemId,
        density: "Medium",
        gemsCount: gemId ? 1 : 0,
        safetyScore: 4,
        polygon: geoHex.polygon,
        centerLat: geoHex.centerLat,
        centerLng: geoHex.centerLng,
      } as HexZone;
    });
  }, [allGems, visitedGemIds, isZoneUnlockedFn]);

  // Build the imperative Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapContainerRef.current, {
        center: [12.3051, 76.6450],
        zoom: 13,
        zoomControl: false,
      });

      // Esri satellite tiles
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri" }
      ).addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;

    // Remove old polygons
    polygonLayersRef.current.forEach(p => p.remove());
    polygonLayersRef.current = [];

    // Draw hex polygons
    grid.forEach((zone) => {
      const poly = L.polygon(zone.polygon, {
        color: hexStatusStrokes[zone.status],
        fillColor: hexStatusColors[zone.status],
        fillOpacity: 1,
        weight: 1,
        opacity: 0.95,
      }).addTo(map);

      poly.on("click", () => setSelectedZone(zone));
      polygonLayersRef.current.push(poly);
    });

    return () => {
      // Don't destroy the map on grid redraws, just clean polygons
    };
  }, [grid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="animate-fade-up relative flex flex-col gap-0 map-screen-height overflow-hidden bg-[#0F3D3D]">
      {/* Header overlaying map */}
      <div className="absolute top-0 left-0 right-0 z-[400] px-6 pt-8 pb-4 flex items-start justify-between pointer-events-none">
        <div>
          <h1
            className="font-playfair mb-1 drop-shadow-md"
            style={{ color: "#fff", fontSize: 32, fontWeight: 800 }}
          >
            Hex Map
          </h1>
          <p className="font-dm drop-shadow-md" style={{ color: "rgba(255,255,255,0.95)", fontSize: 16, fontWeight: 600 }}>
            Explore Mysuru by zone
          </p>
        </div>

        {/* Legend card */}
        <div
          className="rounded-[14px] p-3 pointer-events-auto"
          style={{ background: "rgba(15,61,61,0.85)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {(["explored", "active", "gem", "locked"] as HexStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2 mb-1 last:mb-0">
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: hexStatusColors[s],
                  flexShrink: 0,
                  border: `1px solid ${hexStatusStrokes[s]}`,
                }}
              />
              <span className="font-dm" style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {s === "explored" ? "Explored" : s === "active" ? "Active" : s === "gem" ? "Gem Zone" : "Locked"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaflet Hex Grid — fills all remaining height */}
      <div className="flex-1 w-full relative" style={{ minHeight: 0 }}>
        {/* Subtle dark overlay */}
        <div className="absolute inset-0 pointer-events-none z-[400]" style={{ background: "rgba(15,61,61,0.25)" }} />
        {/* The actual map container */}
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Zone Detail Modal */}
      {selectedZone && (
        <>
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease-out" }}
            onClick={() => setSelectedZone(null)}
          >
            <div
              className="rounded-[24px] w-full"
              style={{
                background: C.bg,
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                maxHeight: "90vh",
                maxWidth: 600,
                overflowY: "auto",
                animation: "modalSlideIn 0.3s cubic-bezier(0.22,1,0.36,1)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 99,
                  background: "rgba(26,18,8,0.15)",
                }}
              />
            </div>

            <div className="px-6 pt-2">
              {/* Zone name */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2
                    className="font-playfair mb-1 drop-shadow-sm"
                    style={{ color: C.text, fontSize: 28, fontWeight: 800 }}
                  >
                    {selectedZone.zoneName}
                  </h2>
                  <p className="font-dm" style={{ color: C.muted, fontSize: 14, fontWeight: 600 }}>
                    Zone {selectedZone.row + 1}-{selectedZone.col + 1} · Mysuru
                  </p>
                </div>
                <button
                  onClick={() => setSelectedZone(null)}
                  style={{
                    background: "rgba(26,18,8,0.07)",
                    border: "none",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: C.muted,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Digipin */}
              <div
                className="font-dm inline-flex items-center gap-2 mb-5 px-3 py-2 rounded-[10px]"
                style={{
                  background: darkMode ? "rgba(78,196,150,0.12)" : "rgba(15,61,61,0.08)",
                  color: darkMode ? "#5ecba1" : "#0F3D3D",
                  border: darkMode ? "1px solid rgba(78,196,150,0.2)" : "none",
                }}
              >
                <span style={{ fontSize: 14 }}>📡</span>
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.06em" }}>
                  {selectedZone.digipinCode}
                </span>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 mb-5">
                {/* Density */}
                <div
                  className="font-dm flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
                  style={{
                    background: densityConfig[selectedZone.density].bg,
                    color: densityConfig[selectedZone.density].color,
                  }}
                >
                  <span style={{ fontSize: 12 }}>👥</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {selectedZone.density} Density
                  </span>
                </div>

                {/* Multiplier */}
                <div
                  className="font-dm flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
                  style={{
                    background: multiplierConfig[selectedZone.multiplier].bg,
                    color: multiplierConfig[selectedZone.multiplier].color,
                  }}
                >
                  <span style={{ fontSize: 12 }}>⚡</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {selectedZone.multiplier} Points
                  </span>
                </div>

                {/* Gems */}
                <div
                  className="font-dm flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
                  style={{ background: "rgba(201,146,31,0.1)", color: "#C9921F" }}
                >
                  <span style={{ fontSize: 12 }}>💎</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {selectedZone.gemsCount} Gem{selectedZone.gemsCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Safety score */}
              <div className="flex items-center gap-2 mb-6">
                <span style={{ fontSize: 16 }}>🛡️</span>
                <span className="font-dm" style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
                  Safety Score
                </span>
                <div className="flex gap-0.5 ml-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} style={{ fontSize: 14 }}>
                      {star <= selectedZone.safetyScore ? "⭐" : "☆"}
                    </span>
                  ))}
                </div>
                <span className="font-dm ml-1" style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                  {selectedZone.safetyScore}/5
                </span>
              </div>

              {/* CTA */}
              <button
                className="font-dm w-full pressable"
                onClick={() => {
                  if (selectedZone.status !== "locked") {
                    navigate("/map", { state: { mysteryZone: selectedZone } });
                  }
                }}
                style={{
                  height: 52,
                  borderRadius: 99,
                  background: selectedZone.status === "locked" ? C.cardAlt : "#E07B2A",
                  color: selectedZone.status === "locked" ? C.muted : "#fff",
                  fontWeight: 800,
                  fontSize: 18,
                  border: "none",
                  cursor: selectedZone.status === "locked" ? "not-allowed" : "pointer",
                  boxShadow:
                    selectedZone.status === "locked"
                      ? "none"
                      : "0 6px 20px rgba(224,123,42,0.3)",
                }}
              >
                {selectedZone.status === "locked"
                  ? "🔒 Zone Locked — Explore nearby first"
                  : "Explore This Zone →"}
              </button>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}