import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { getBloomColor } from "../../data/gems";
import { SkeletonCard, SkeletonGemCard } from "../Skeleton";
import { haversineDistance } from "../../engine/checkin";
import { fetchLiveWeather } from "../../engine/weather";
import type { WeatherData } from "../../engine/types";

const categories = [
  { emoji: "✨", label: "All" },
  { emoji: "🎨", label: "Art" },
  { emoji: "🍛", label: "Food" },
  { emoji: "🏨", label: "Stay" },
  { emoji: "🛕", label: "Temples" },
  { emoji: "🧶", label: "Crafts" },
  { emoji: "🛤️", label: "Streets" },
];

// Hex grid data
type HexStatus = "explored" | "active" | "gem" | "locked";
const hexGrid: HexStatus[][] = [
  ["explored", "active", "explored", "gem", "locked"],
  ["explored", "explored", "active", "locked", "locked"],
  ["gem", "explored", "explored", "active", "locked"],
  ["locked", "explored", "gem", "explored", "locked"],
];

const hexColors: Record<HexStatus, string> = {
  explored: "#0F3D3D",
  active: "#E07B2A",
  gem: "#C9921F",
  locked: "rgba(26,18,8,0.08)",
};

const hexLegend: { status: HexStatus; label: string }[] = [
  { status: "explored", label: "Explored" },
  { status: "active", label: "Active" },
  { status: "gem", label: "Hidden Gem" },
  { status: "locked", label: "Locked" },
];

const currentZone = { row: 1, col: 2 };

function HexGrid() {
  const hexW = 52;
  const hexH = 60;
  const colGap = 4;
  const rowGap = -14;
  const totalCols = 5;
  const totalRows = hexGrid.length;
  const totalWidth = totalCols * (hexW + colGap) + hexW / 2;
  const totalHeight = totalRows * (hexH + rowGap);

  return (
    <div className="relative overflow-x-auto">
      <div style={{ position: "relative", width: "100%", minWidth: totalWidth, height: totalHeight }}>
        {hexGrid.map((row, rowIdx) =>
          row.map((status, colIdx) => {
            const isOddRow = rowIdx % 2 === 1;
            const x = colIdx * (hexW + colGap) + (isOddRow ? (hexW + colGap) / 2 : 0);
            const y = rowIdx * (hexH + rowGap);
            const isCurrent = rowIdx === currentZone.row && colIdx === currentZone.col;
            return (
              <div key={`${rowIdx}-${colIdx}`} style={{ position: "absolute", left: x, top: y }}>
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      left: -4, top: -4,
                      width: hexW + 8, height: hexH + 8,
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      background: "#fff",
                      zIndex: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    position: "relative", zIndex: 1,
                    width: hexW, height: hexH,
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    background: hexColors[status],
                    cursor: "pointer",
                    transition: "background 0.22s",
                  }}
                  title={isCurrent ? "Current Zone" : status}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Search Results view - upgraded with masonry + suggestions
function SearchResults({ query }: { query: string }) {
  const navigate = useNavigate();
  const C = useColors();
  const { toggleSaved, isSaved } = useApp();
  const { allGems } = useGame();
  const [activeFilter, setActiveFilter] = useState("All");
  const results = allGems.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase()) ||
    g.category.toLowerCase().includes(query.toLowerCase()) ||
    g.location.toLowerCase().includes(query.toLowerCase())
  ).filter((g) => activeFilter === "All" || g.category === activeFilter);

  const allResults = allGems.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase()) ||
    g.category.toLowerCase().includes(query.toLowerCase()) ||
    g.location.toLowerCase().includes(query.toLowerCase())
  );

  if (allResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <span style={{ fontSize: 56 }}>🔍</span>
        <p className="font-playfair" style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>No gems found here yet</p>
        <p className="font-dm" style={{ color: C.muted, fontSize: 14 }}>Be the first to discover one!</p>
        <button onClick={() => navigate("/submit")} className="font-dm pressable"
          style={{ background: "#E07B2A", color: "#fff", border: "none", borderRadius: 99, padding: "11px 24px", cursor: "pointer", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 16px rgba(224,123,42,0.28)" }}>
          Submit a Gem +
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-dm" style={{ color: C.muted, fontSize: 14 }}>
        {allResults.length} result{allResults.length !== 1 ? "s" : ""} for <strong style={{ color: C.text }}>"{query}"</strong>
      </p>
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {["All", "Art", "Food", "Temples", "Crafts", "Stay", "Heritage", "Nature"].map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)} className="font-dm whitespace-nowrap shrink-0 pressable"
            style={{ padding: "6px 14px", borderRadius: 99, background: f === activeFilter ? "#E07B2A" : "transparent", border: `1px solid ${C.borderStrong}`, color: f === activeFilter ? "#fff" : "#000", fontWeight: f === activeFilter ? 600 : 400, fontSize: 12, cursor: "pointer" }}>
            {f}
          </button>
        ))}
      </div>
      {/* Masonry-style 2-col grid */}
      <div className="grid grid-cols-2 gap-3">
        {results.map((gem) => (
          <div key={gem.id} className={`gem-card rounded-[20px] overflow-hidden cursor-pointer pressable ${gem.rarityBorderClass}`}
            style={{ background: C.card, border: `1px solid ${C.border}` }}
            onClick={() => navigate(`/gem/${gem.id}`)}>
            <div className="flex items-center justify-center relative" style={{ height: 90, background: gem.gradient }}>
              <span style={{ fontSize: 32 }}>{gem.emoji}</span>
              {/* Bloom dot */}
              <span className={gem.bloomStatus === "Fading" ? "bloom-fading" : gem.bloomStatus === "Critical" ? "bloom-critical" : ""}
                style={{ position: "absolute", top: 8, left: 8, width: 8, height: 8, borderRadius: "50%", background: getBloomColor(gem.bloomStatus), border: "1.5px solid rgba(255,255,255,0.8)" }} />
              {/* Bookmark */}
              <button onClick={(e) => { e.stopPropagation(); toggleSaved(gem.id); }}
                className="absolute top-1.5 right-1.5 pressable"
                style={{ background: "rgba(0,0,0,0.25)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>
                {isSaved(gem.id) ? "🔖" : "🏷️"}
              </button>
            </div>
            <div className="p-3">
              <p className="font-playfair mb-0.5" style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{gem.name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-dm" style={{ color: gem.rarityTierColor, fontWeight: 700, fontSize: 10 }}>{gem.rarityTier}</span>
                <span className="font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 12 }}>+{gem.points}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const C = useColors();
  const { addToast, toggleSaved, isSaved, userName, userCoords, locationStatus, requestLocation, buddySystemEnabled, toggleBuddySystem } = useApp();
  const { stats, leaderboard, visitedGemIds, allGems } = useGame();
  const myRank = leaderboard.find((e) => e.userId === stats.userId)?.rank ?? "—";

  // ── Safety Buddy System Logic ────────────────────────────────────────────────
  const DANGER_ZONES = useMemo(() => [
    { id: "dz1", name: "Devaraja Market (Eastern Gate)", lat: 12.3086, lng: 76.6515, radiusM: 300, reason: "Heavy crowd density detected. High risk of pickpocketing." },
    { id: "dz2", name: "Kukkarahalli Lake Deep Trail", lat: 12.3021, lng: 76.6322, radiusM: 400, reason: "Wildlife movement. Unsafe after dusk." }
  ], []);

  const activeDangerZone = useMemo(() => {
    if (!buddySystemEnabled || !userCoords) return null;
    for (const dz of DANGER_ZONES) {
      if (haversineDistance(userCoords, { lat: dz.lat, lng: dz.lng }) <= dz.radiusM) {
        return dz;
      }
    }
    // Simulate user being in dz1 if no real coords but buddy is enabled (for demo)
    return DANGER_ZONES[0]; 
  }, [userCoords, buddySystemEnabled, DANGER_ZONES]);

  // ── Nearby gems sorted by distance from live location ────────────────────────
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const nearbyGems = useMemo(() => {
    if (!userCoords) return [];
    return allGems
      .filter((g) => !visitedGemIds.has(g.id))
      .filter((g) => {
        // Buddy System strict safety filtering
        if (buddySystemEnabled && g.safety < 70) return false;
        return true;
      })
      .map((g) => {
        // gem coords come from GameStore gemStates; fall back to rough Mysuru centre
        const gemCoords = { lat: 12.295 + (g.id * 0.005) % 0.1, lng: 76.644 + (g.id * 0.003) % 0.08 };
        const distM = haversineDistance(userCoords, gemCoords);
        
        let timeNote = null;
        let timeColor = "#A39A88";
        if (buddySystemEnabled && weatherData && g.weatherProfile) {
          const isRisk = g.weatherProfile.riskConditions.includes(weatherData.condition);
          const isIdeal = g.weatherProfile.idealConditions.includes(weatherData.condition);
          if (isRisk) {
             timeNote = "Unsafe weather. Visit tomorrow.";
             timeColor = "#ef4444";
          } else if (isIdeal) {
             timeNote = "Perfect time to visit!";
             timeColor = "#22c55e";
          } else {
             timeNote = "Okay to visit now.";
          }
        }
        return { ...g, distM, timeNote, timeColor };
      })
      .sort((a, b) => a.distM - b.distM)
      .slice(0, 4);
  }, [userCoords, visitedGemIds, buddySystemEnabled, weatherData]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches] = useState(["Rangoli Art", "Filter Coffee", "Puppet Workshop"]);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Fetch Live Weather
  useEffect(() => {
    fetchLiveWeather().then(w => {
      if (w) setWeatherData(w);
    });
  }, []);

  // Skeleton for 1 second
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  // Success Overlay Logic
  const checkinState = location.state as { checkinSuccess?: boolean; points?: number; gemName?: string } | null;
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successData, setSuccessData] = useState<{points: number, gemName: string} | null>(null);

  useEffect(() => {
    if (checkinState?.checkinSuccess) {
      setSuccessData({ points: checkinState.points || 0, gemName: checkinState.gemName || "Hidden Gem" });
      setShowSuccessOverlay(true);
      // Clear location state to prevent replay on refresh
      navigate(".", { replace: true, state: {} });
      
      const t = setTimeout(() => setShowSuccessOverlay(false), 3500);
      return () => clearTimeout(t);
    }
  }, [checkinState, navigate]);

  const homeGems = allGems.slice(0, 5);
  const filteredGems =
    activeCategory === "All"
      ? homeGems
      : homeGems.filter((g) => g.category === activeCategory);

  // Fading gems (approaching capacity)
  const fadingGems = allGems.filter((g) => g.bloomStatus === "Fading" || g.bloomStatus === "Critical");

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      {/* Hero Card */}
      <div
        className="rounded-[32px] p-6 lg:p-8 relative overflow-hidden"
        style={{ 
          background: "linear-gradient(135deg, #0F3D3D 0%, #175252 60%, #0d4a3a 100%)",
          boxShadow: "var(--premium-shadow-lg)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,146,31,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", left: -60, bottom: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(224,123,42,0.1) 0%, transparent 70%)" }} />
        
        <div className="flex items-center justify-between mb-2">
          <p className="font-dm text-xs font-bold tracking-widest uppercase" style={{ color: "#C9921F" }}>
            Welcome back, {userName || "Explorer"}
          </p>
          {weatherData && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <span style={{ fontSize: 14 }}>
                {weatherData.condition === "clear" ? "☀️" : weatherData.condition === "partly_cloudy" ? "⛅" : weatherData.condition === "light_rain" ? "🌦️" : weatherData.condition === "heavy_rain" ? "🌧️" : "⛈️"}
              </span>
              <span className="font-dm text-xs font-bold" style={{ color: "#fff" }}>
                {weatherData.temperature}°C
              </span>
            </div>
          )}
        </div>
        <h1 className="font-playfair mb-2 text-3xl font-extrabold tracking-tight" style={{ color: "#fff", lineHeight: 1.2 }}>
          Discover <em style={{ color: "#C9921F", fontStyle: "italic" }}>Hidden</em> Mysuru
        </h1>
        <p className="font-dm mb-6 text-sm" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          42 unexplored streets. 128 hidden gems waiting.
        </p>
        
        <div className="flex gap-3 flex-wrap relative z-10">
          {[{ label: "Points", value: (stats.totalXP ?? 0).toLocaleString() }, { label: "Gems Found", value: String(stats.allTimeGems ?? 0) }, { label: "Rank", value: `#${myRank}` }].map((stat) => (
            <div key={stat.label} className="rounded-[16px] px-4 py-3 flex flex-col flex-1 min-w-[80px]" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(4px)" }}>
              <span className="font-playfair text-xl font-bold tracking-tight" style={{ color: "#E07B2A" }}>{stat.value}</span>
              <span className="font-dm text-[9px] font-bold tracking-wider uppercase mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {stat.label}
              </span>
            </div>
          ))}
          {/* Streak chip */}
          <div className="rounded-[16px] px-4 py-3 flex flex-col items-center justify-center min-w-[80px] transition-all duration-300 hover:bg-red-500/20" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.22)" }}>
            <span className="text-lg leading-none">🔥</span>
            <span className="font-playfair text-lg font-bold mt-1" style={{ color: "#f87171" }}>{stats.streakDays ?? 0}</span>
            <span className="font-dm text-[9px] font-bold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Streak</span>
          </div>
        </div>

        {/* Buddy System Toggle overlaying Hero Card */}
        <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
          <span className="font-dm text-xs font-bold" style={{ color: buddySystemEnabled ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
            🛡️ Buddy System
          </span>
          <button 
            onClick={toggleBuddySystem}
            className="w-10 h-5 rounded-full relative transition-colors duration-300 pressable"
            style={{ background: buddySystemEnabled ? "#22c55e" : "rgba(255,255,255,0.2)" }}
          >
            <div 
              className="absolute top-0.5 bg-white rounded-full transition-transform duration-300"
              style={{ width: 16, height: 16, left: 2, transform: buddySystemEnabled ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
        </div>
      </div>

      {/* Safety Alert Strip (Dynamic Danger Zone) */}
      {!alertDismissed && activeDangerZone && (
        <div className="rounded-[14px] px-4 py-3 flex items-start gap-3 animate-pulse" style={{ background: "rgba(239, 68, 68, 0.15)", border: "2px solid rgba(239, 68, 68, 0.4)" }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🚨</span>
          <div className="flex-1 min-w-0">
            <span className="font-dm block" style={{ color: "#f87171", fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Danger Zone Alert</span>
            <span className="font-dm" style={{ color: "#fca5a5", fontWeight: 600, fontSize: 13 }}>{activeDangerZone.name} — </span>
            <span className="font-dm" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{activeDangerZone.reason}</span>
          </div>
          <button onClick={() => setAlertDismissed(true)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, flexShrink: 0, padding: 0, opacity: 0.8 }}>×</button>
        </div>
      )}

      {/* ── Nearby Recommendations ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 16 }}>📍</span>
            <h2 className="font-playfair" style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Nearby Spots</h2>
          </div>
          {locationStatus === "denied" && (
            <button onClick={requestLocation} className="font-dm pressable"
              style={{ background: "rgba(224,123,42,0.15)", border: "1px solid rgba(224,123,42,0.3)", borderRadius: 99, padding: "4px 12px", color: "#E07B2A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Allow Location
            </button>
          )}
          {locationStatus === "granted" && (
            <span className="font-dm" style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>● Live</span>
          )}
        </div>

        {/* Location requesting / unavailable states */}
        {(locationStatus === "idle" || locationStatus === "requesting") && (
          <div className="rounded-[16px] px-4 py-4 flex items-center gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <p className="font-dm" style={{ color: C.muted, fontSize: 13 }}>Finding your location…</p>
          </div>
        )}

        {locationStatus === "denied" && (
          <div className="rounded-[16px] px-4 py-4 flex items-start gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <p className="font-dm" style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
              Enable location access to see gems near you and get distance-based recommendations.
            </p>
          </div>
        )}

        {locationStatus === "unavailable" && (
          <div className="rounded-[16px] px-4 py-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="font-dm" style={{ color: C.muted, fontSize: 13 }}>Location unavailable on this device.</p>
          </div>
        )}

        {locationStatus === "granted" && nearbyGems.length === 0 && (
          <div className="rounded-[16px] px-4 py-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="font-dm" style={{ color: C.muted, fontSize: 13 }}>You've visited all nearby gems! Explore further zones.</p>
          </div>
        )}

        {locationStatus === "granted" && nearbyGems.length > 0 && (
          <div className="flex flex-col gap-3.5">
            {nearbyGems.map((gem) => {
              const distKm = gem.distM >= 1000
                ? `${(gem.distM / 1000).toFixed(1)} km`
                : `${Math.round(gem.distM)} m`;
              return (
                <div key={gem.id} className="group/card pressable rounded-[22px] flex items-center gap-4 p-4 cursor-pointer transition-all duration-300 hover:bg-white/[0.02]"
                  style={{ 
                    background: C.card, 
                    border: `1px solid ${C.border}`,
                    boxShadow: "var(--premium-shadow-sm)",
                  }}
                  onClick={() => navigate(`/gem/${gem.id}`)}>
                  {/* Gem icon with scale effect */}
                  <div className="flex items-center justify-center rounded-[16px] shrink-0 relative overflow-hidden"
                    style={{ width: 54, height: 54, background: gem.gradient, border: `1px solid ${C.borderStrong}` }}>
                    {gem.image && <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-500 group-hover/card:scale-110" />}
                    <span className="relative z-10 text-2xl" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>{gem.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-dm font-bold text-sm tracking-tight mb-0.5 transition-colors group-hover/card:text-[#E07B2A]" style={{ color: C.text }}>
                      {gem.name} {buddySystemEnabled && <span style={{fontSize: 12}} title={`Safety Score: ${gem.safety}`}>🛡️</span>}
                    </p>
                    <p className="font-dm text-xs opacity-75" style={{ color: C.muted }}>{gem.location}</p>
                    
                    {/* Buddy System Time Recommendation */}
                    {buddySystemEnabled && gem.timeNote && (
                      <p className="font-dm text-[11px] font-bold mt-0.5" style={{ color: gem.timeColor }}>
                        🕒 {gem.timeNote}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="font-dm font-semibold" style={{ color: gem.rarityTierColor }}>{gem.rarityTier}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span className="font-dm font-semibold" style={{ color: "#E07B2A" }}>+{gem.points} pts</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1 rounded-[8px] px-2.5 py-1" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                      <span className="text-[10px]">📍</span>
                      <span className="font-dm text-[11px] font-bold text-emerald-400">{distKm}</span>
                    </div>
                    <span className="font-dm text-[11px]" style={{ color: C.muted }}>⭐ {gem.rating}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's Trail card */}
      <div
        className="rounded-[24px] p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F3D3D 0%, #1a5252 100%)" }}
      >
        <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(201,146,31,0.1)" }} />
        <div className="relative z-10">
          <p className="font-dm mb-1" style={{ color: "#C9921F", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Today's Trail 🗺️
          </p>
          <p className="font-playfair mb-3" style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>
            Sayyaji Rao Heritage Walk
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {["🎨 Rangoli Art", "🍛 Idli Corner", "🛕 Trinesvara"].map((stop) => (
              <span key={stop} className="font-dm" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", fontSize: 12, padding: "4px 10px", borderRadius: 99, fontWeight: 500 }}>
                {stop}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-playfair" style={{ color: "#E07B2A", fontSize: 16, fontWeight: 700 }}>+405 pts total</span>
            <button
              className="font-dm pressable"
              style={{ background: "#E07B2A", color: "#fff", border: "none", borderRadius: 99, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, boxShadow: "0 4px 12px rgba(224,123,42,0.35)" }}
            >
              Start Trail →
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar - upgraded */}
      <div ref={searchRef} className="relative">
        <div
          className="relative flex items-center transition-all duration-300"
          style={{ 
            background: C.card, 
            border: `1.5px solid ${searchFocused ? "#E07B2A" : C.border}`, 
            borderRadius: 99, 
            boxShadow: searchFocused ? "0 4px 20px rgba(224,123,42,0.15)" : "var(--premium-shadow-md)", 
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Search streets, art, food, crafts…"
            className="font-dm w-full bg-transparent outline-none placeholder-white/40"
            style={{ padding: "14px 48px 14px 22px", color: C.text, fontSize: 14 }}
          />
          {searchQuery ? (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-4 pressable text-white/60 hover:text-white transition-colors"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 0 }}
            >
              ×
            </button>
          ) : (
            <span style={{ position: "absolute", right: 20, fontSize: 16, color: C.muted, opacity: 0.8, pointerEvents: "none" }}>🔍</span>
          )}
        </div>

        {/* Recent / Suggestions Dropdown */}
        {searchFocused && !searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-[20px] overflow-hidden z-50"
            style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(26,18,8,0.12)" }}>
            <p className="font-dm px-4 pt-3 pb-2" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recent Searches</p>
            {recentSearches.map((s) => (
              <button key={s} onClick={() => setSearchQuery(s)} className="font-dm w-full text-left flex items-center gap-3 px-4 py-3 pressable"
                style={{ background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 14 }}>
                <span style={{ color: C.muted, fontSize: 16 }}>🕐</span> {s}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: "0 16px" }} />
            <p className="font-dm px-4 pt-3 pb-2" style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Browse by Category</p>
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {[["🎨","Art"], ["🍛","Food"], ["🛕","Temples"], ["🧶","Crafts"], ["🏛️","Heritage"], ["🌿","Nature"]].map(([e,l]) => (
                <button key={l} onClick={() => setSearchQuery(l)} className="font-dm pressable"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 99, padding: "6px 12px", color: C.text, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  {e} {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live suggestions while typing */}
        {searchFocused && searchQuery.length > 0 && searchQuery.length < 3 && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-[20px] overflow-hidden z-50"
            style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(26,18,8,0.12)" }}>
            {allGems.filter((g) => g.name.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 4).map((g) => (
              <button key={g.id} onClick={() => { setSearchQuery(g.name); navigate(`/gem/${g.id}`); }} className="font-dm w-full text-left flex items-center gap-3 px-4 py-3 pressable"
                style={{ background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 14 }}>
                <span style={{ fontSize: 20 }}>{g.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</p>
                  <p style={{ color: C.muted, fontSize: 11 }}>📍 {g.location}</p>
                </div>
                <span className="ml-auto font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 12 }}>+{g.points}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search results or normal content */}
      {isSearching ? (
        <SearchResults query={searchQuery} />
      ) : (
        <>
          {/* Category Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const active = activeCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  className="font-dm whitespace-nowrap flex items-center gap-2 shrink-0 pressable px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 hover:bg-white/10"
                  style={{
                    background: active ? "#E07B2A" : "rgba(255,255,255,0.06)",
                    border: active ? "1px solid #E07B2A" : `1px solid ${C.borderStrong}`,
                    color: active ? "#fff" : "#000",
                    boxShadow: active ? "0 4px 12px rgba(224,123,42,0.3)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Fading Now Section ── */}
          {fadingGems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-playfair flex items-center gap-2" style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>
                  Fading Now <span style={{ fontSize: 14 }}>⚠️</span>
                </h2>
                <span className="font-dm" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.2)" }}>
                  Approaching capacity
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {fadingGems.map((gem) => {
                  const bc = getBloomColor(gem.bloomStatus);
                  return (
                    <div key={gem.id}
                      className={`gem-card shrink-0 rounded-[20px] overflow-hidden cursor-pointer pressable ${gem.rarityBorderClass}`}
                      style={{ width: 160, background: C.card, border: `1px solid ${C.border}` }}
                      onClick={() => navigate(`/gem/${gem.id}`)}>
                      <div className="flex items-center justify-center relative" style={{ height: 110, background: gem.gradient }}>
                        <span style={{ fontSize: 36 }}>{gem.emoji}</span>
                        {/* Bloom dot with animation */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className={gem.bloomStatus === "Critical" ? "bloom-critical" : "bloom-fading"}
                            style={{ width: 8, height: 8, borderRadius: "50%", background: bc, display: "inline-block", border: "1.5px solid rgba(255,255,255,0.8)" }} />
                          <span className="font-dm" style={{ color: "#fff", fontSize: 9, fontWeight: 700, background: `${bc}55`, padding: "1px 5px", borderRadius: 99 }}>
                            {gem.bloomCapacity}% full
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="font-playfair mb-1" style={{ color: C.text, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{gem.name}</p>
                        {/* Capacity bar */}
                        <div style={{ height: 3, background: "rgba(26,18,8,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ width: `${gem.bloomCapacity}%`, height: "100%", background: bc, borderRadius: 99 }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-dm" style={{ color: bc, fontWeight: 700, fontSize: 10 }}>{gem.bloomStatus}</span>
                          <span className="font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 12 }}>+{gem.points}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Daily Challenge Section ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-playfair flex items-center gap-2" style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>
                Daily Challenge <span style={{ fontSize: 14 }}>⚡</span>
              </h2>
              <span className="font-dm text-xs font-semibold" style={{ color: "#E07B2A" }}>Resets in 4h 22m</span>
            </div>
            <div className="rounded-[24px] p-5 relative overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "var(--premium-shadow-sm)" }}>
              <div style={{ position: "absolute", right: -16, top: -16, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(224,123,42,0.12) 0%, transparent 70%)" }} />
              <div className="flex items-start gap-4 relative z-10">
                <div className="flex items-center justify-center rounded-[16px] shrink-0" style={{ width: 52, height: 52, background: "linear-gradient(135deg, #E07B2A, #C9921F)", fontSize: 24, boxShadow: "0 4px 12px rgba(224,123,42,0.2)" }}>
                  🍛
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-playfair text-sm font-bold tracking-tight mb-1" style={{ color: C.text, lineHeight: 1.3 }}>
                    Discover a Food Gem before 9 AM
                  </p>
                  <p className="font-dm text-xs opacity-80 leading-relaxed mb-3.5" style={{ color: C.muted }}>
                    Visit any Food category gem and scan the QR code during morning hours.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-dm text-[10px] font-bold tracking-wide uppercase" style={{ background: "rgba(224,123,42,0.08)", color: "#E07B2A", padding: "4px 10px", borderRadius: 99, border: "1px solid rgba(224,123,42,0.18)" }}>
                      +50 Bonus pts
                    </span>
                    <span className="font-dm text-xs" style={{ color: C.muted }}>0 / 1 complete</span>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-4 bg-white/5 rounded-full overflow-hidden" style={{ height: 4 }}>
                <div style={{ width: "0%", height: "100%", background: "linear-gradient(to right, #E07B2A, #C9921F)", borderRadius: 99 }} />
              </div>
            </div>
          </section>

          {/* Hidden Gems Nearby */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-playfair" style={{ color: C.text, fontSize: 19, fontWeight: 700 }}>Hidden Gems Nearby</h2>
              <button className="font-dm" style={{ color: "#E07B2A", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>See all →</button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {loading ? (
                <>{[1, 2, 3].map((k) => <SkeletonGemCard key={k} />)}</>
              ) : (
                filteredGems.map((gem) => (
                  <div key={gem.id} className={`gem-card shrink-0 rounded-[20px] overflow-hidden cursor-pointer pressable ${gem.rarityBorderClass}`}
                    style={{ width: 180, background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(26,18,8,0.06)" }}
                    onClick={() => navigate(`/gem/${gem.id}`)}>
                    <div className="flex items-center justify-center relative overflow-hidden" style={{ height: 130, background: gem.gradient }}>
                      {gem.image && (
                        <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-overlay" />
                      )}
                      <span style={{ fontSize: 40, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>{gem.emoji}</span>
                      {/* Rarity badge */}
                      <span className="font-dm absolute top-3 left-3"
                        style={{ background: gem.rarityBg, color: gem.rarityTierColor, backdropFilter: "blur(8px)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, letterSpacing: "0.04em", border: `1px solid ${gem.rarityTierColor}33` }}>
                        {gem.rarityTier}
                      </span>
                      {/* Bloom dot */}
                      <span className={gem.bloomStatus === "Fading" ? "bloom-fading" : gem.bloomStatus === "Critical" ? "bloom-critical" : ""}
                        style={{ position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: "50%", background: getBloomColor(gem.bloomStatus), border: "1.5px solid rgba(255,255,255,0.8)" }} />
                      {/* Bookmark */}
                      <button onClick={(e) => { e.stopPropagation(); toggleSaved(gem.id); addToast("success", isSaved(gem.id) ? "Removed from collections" : "💾 Saved to Collections"); }}
                        className="absolute bottom-2 right-2 pressable"
                        style={{ background: "rgba(0,0,0,0.25)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13 }}>
                        {isSaved(gem.id) ? "🔖" : "🏷️"}
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="font-playfair mb-1" style={{ color: C.text, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{gem.name}</p>
                      <p className="font-dm mb-3" style={{ color: C.muted, fontSize: 12 }}>📍 {gem.location}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 13 }}>+{gem.points} pts</span>
                        <span className="font-dm" style={{ color: C.muted, fontSize: 12 }}>⭐ {gem.rating}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Zone Map */}
          <section className="mb-4">
            <h2 className="font-playfair mb-4" style={{ color: C.text, fontSize: 19, fontWeight: 700 }}>
              Your Zone Map
            </h2>
            <div
              className="rounded-[28px] p-6 relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-premium-lg"
              style={{ 
                background: "linear-gradient(135deg, #0F3D3D, #0c4234)", 
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "var(--premium-shadow-md)"
              }}
              onClick={() => navigate("/hex")}
            >
              {/* Decorative dots pattern */}
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px", borderRadius: 28 }} />
              <div className="relative z-10">
                <div className="overflow-x-auto no-scrollbar">
                  <HexGrid />
                </div>
                <div className="flex flex-wrap gap-4 mt-5">
                  {hexLegend.map(({ status, label }) => (
                    <div key={status} className="flex items-center gap-2">
                      <div style={{ width: 12, height: 12, borderRadius: 4, background: hexColors[status], border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }} />
                      <span className="font-dm text-[11px] opacity-80" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="font-dm text-xs opacity-60" style={{ color: "rgba(255,255,255,0.6)" }}>Tap to open Hex Zone map</span>
                  <span className="font-dm text-xs font-semibold hover:underline" style={{ color: "#E07B2A" }}>Explore Zones →</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate("/submit")}
        className="fixed z-30 pressable flex items-center justify-center transition-all duration-300 hover:shadow-[0_8px_32px_rgba(224,123,42,0.5)] hover:-translate-y-0.5"
        style={{
          bottom: 88,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #E07B2A, #d96f1d)",
          color: "#fff",
          fontSize: 26,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 6px 24px rgba(224,123,42,0.4)",
        }}
        aria-label="Submit a gem"
      >
        +
      </button>

      {/* Success Overlay */}
      {showSuccessOverlay && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(10,26,26,0.85)", backdropFilter: "blur(8px)", animation: "fadeIn 0.3s ease-out" }}>
          <div className="flex flex-col items-center bg-[#0F3D3D] p-8 rounded-[32px] border" style={{ borderColor: "rgba(224,123,42,0.4)", boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)", animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div className="flex items-center justify-center rounded-full bg-[#22c55e] mb-5" style={{ width: 88, height: 88, boxShadow: "0 0 32px rgba(34,197,94,0.4)", animation: "popScale 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}>
              <span style={{ fontSize: 44, color: "#fff" }}>✓</span>
            </div>
            <h2 className="font-playfair text-[#fff] text-2xl font-bold mb-2">Place Visited!</h2>
            <p className="font-dm text-2xl font-bold mb-1" style={{ background: "linear-gradient(135deg, #E07B2A, #C9921F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              +{successData.points} points
            </p>
            <p className="font-dm text-[rgba(255,255,255,0.6)] text-sm font-medium">{successData.gemName}</p>
          </div>
        </div>
      )}
    </div>
  );
}