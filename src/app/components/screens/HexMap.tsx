import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp, useColors } from "../../context/AppContext";

type HexStatus = "explored" | "active" | "gem" | "locked";

interface HexZone {
  row: number;
  col: number;
  status: HexStatus;
  zoneName: string;
  digipinCode: string;
  density: "High" | "Medium" | "Low";
  multiplier: "1×" | "2×" | "3×";
  gemsCount: number;
  safetyScore: number;
}

const hexStatusColors: Record<HexStatus, string> = {
  explored: "#1A5252",
  active: "#E07B2A",
  gem: "#C9921F",
  locked: "rgba(255,255,255,0.15)",
};

const zoneNames = [
  "Heritage Core", "Artisan Quarter", "Street Food Belt", "Silk District",
  "Temple Row", "Palace Ring", "River Walk", "Fort Zone",
  "Agrahara", "Lakshmipuram", "Chamundipuram", "Nazarbad",
  "Gandhi Square", "Sayyaji Road", "Devaraja West", "Devaraja East",
  "Kukkarahalli", "CFTRI Zone", "Irwin Road", "Ashoka Belt",
  "Vontikoppal", "Kuvempunagar", "Jayalakshmipuram", "Gokulam",
  "Srirampura", "Bannimantap", "Bogadi", "Hootagalli",
  "Mysore North", "Hebbal", "Vijayanagara", "Dattagalli",
];

const digipins = [
  "MYS-4N2K", "MYS-7R8P", "MYS-1F5Q", "MYS-9G3M",
  "MYS-2P6J", "MYS-8K1T", "MYS-5L4W", "MYS-3H7N",
];

const densities: ("High" | "Medium" | "Low")[] = ["High", "Medium", "Low"];
const multipliers: ("1×" | "2×" | "3×")[] = ["1×", "2×", "3×"];

// Generate a deterministic grid
function buildGrid(): HexZone[][] {
  const rows = 8;
  const cols = 9;
  const statuses: HexStatus[] = ["explored", "explored", "explored", "active", "gem", "locked", "locked"];
  const grid: HexZone[][] = [];
  let nameIdx = 0;
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const statusIdx = (r * cols + c * 3) % statuses.length;
      const status = statuses[statusIdx];
      grid[r][c] = {
        row: r,
        col: c,
        status,
        zoneName: zoneNames[nameIdx % zoneNames.length],
        digipinCode: digipins[(r + c) % digipins.length],
        density: densities[(r + c) % 3],
        multiplier: multipliers[(r * 2 + c) % 3],
        gemsCount: status === "gem" ? Math.floor(Math.random() * 3 + 1) : status === "active" ? 1 : 0,
        safetyScore: 3 + ((r + c) % 3),
      };
      nameIdx++;
    }
  }
  return grid;
}

const GRID = buildGrid();

const densityConfig = {
  High: { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  Medium: { color: "#d97706", bg: "rgba(217,119,6,0.1)" },
  Low: { color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
};

const multiplierConfig = {
  "1×": { color: "#7A6A55", bg: "rgba(122,106,85,0.1)" },
  "2×": { color: "#E07B2A", bg: "rgba(224,123,42,0.12)" },
  "3×": { color: "#C9921F", bg: "rgba(201,146,31,0.15)" },
};

export function HexMap() {
  const { darkMode } = useApp();
  const C = useColors();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState<HexZone | null>(null);
  
  // Real-time grid state
  const [grid, setGrid] = useState<HexZone[][]>(buildGrid);

  // Simulate real-time activity (other players exploring)
  useEffect(() => {
    const interval = setInterval(() => {
      setGrid((prevGrid) => {
        const newGrid = [...prevGrid.map(row => [...row])];
        
        // Pick a random hex to update
        const r = Math.floor(Math.random() * newGrid.length);
        const c = Math.floor(Math.random() * newGrid[0].length);
        
        const currentStatus = newGrid[r][c].status;
        
        // Cycle status to simulate activity
        if (currentStatus === "locked") newGrid[r][c].status = "active";
        else if (currentStatus === "active") newGrid[r][c].status = "gem";
        else if (currentStatus === "gem") newGrid[r][c].status = "explored";
        else if (currentStatus === "explored" && Math.random() > 0.8) newGrid[r][c].status = "active";
        
        return newGrid;
      });
    }, 2000); // Update every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const hexW = 52;
  const hexH = 60;
  const colGap = 4;
  const rowGap = -14;
  const rows = grid.length;
  const cols = grid[0].length;
  const totalWidth = cols * (hexW + colGap) + hexW / 2 + 8;
  const totalHeight = rows * (hexH + rowGap) + 14;

  return (
    <div
      className="animate-fade-up flex flex-col gap-0 map-screen-height overflow-hidden"
      style={{
        background: "#0F3D3D",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-start justify-between">
        <div>
          <h1
            className="font-playfair mb-1 drop-shadow-md"
            style={{ color: "#fff", fontSize: 32, fontWeight: 800 }}
          >
            Hex Map
          </h1>
          <p className="font-dm" style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, fontWeight: 600 }}>
            Explore Mysuru by zone
          </p>
        </div>

        {/* Legend card */}
        <div
          className="rounded-[14px] p-3"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
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
                  border: s === "locked" ? "1px solid rgba(255,255,255,0.2)" : "none",
                }}
              />
              <span className="font-dm" style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {s === "explored" ? "Explored" : s === "active" ? "Active" : s === "gem" ? "Gem Zone" : "Locked"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hex Grid */}
      <div className="flex-1 overflow-auto px-4 pb-6 flex items-center justify-center">
        <div
          style={{
            position: "relative",
            width: totalWidth,
            height: totalHeight,
          }}
        >
          {grid.map((row, rIdx) =>
            row.map((zone, cIdx) => {
              const isOddRow = rIdx % 2 === 1;
              const x = cIdx * (hexW + colGap) + (isOddRow ? (hexW + colGap) / 2 : 0);
              const y = rIdx * (hexH + rowGap);
              const isSelected = selectedZone?.row === rIdx && selectedZone?.col === cIdx;

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  style={{ position: "absolute", left: x, top: y, cursor: "pointer" }}
                  onClick={() => setSelectedZone(isSelected ? null : zone)}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        left: -4,
                        top: -4,
                        width: hexW + 8,
                        height: hexH + 8,
                        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                        background: "#fff",
                        zIndex: 0,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: hexW,
                      height: hexH,
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      background: hexStatusColors[zone.status],
                      transition: "background 0.22s, filter 0.22s",
                      filter: isSelected ? "brightness(1.15)" : "brightness(1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {zone.status === "gem" && (
                      <span style={{ fontSize: 16, userSelect: "none" }}>💎</span>
                    )}
                    {zone.status === "locked" && (
                      <span style={{ fontSize: 14, userSelect: "none", opacity: 0.5 }}>🔒</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
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