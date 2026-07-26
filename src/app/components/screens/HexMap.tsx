import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { ZONE_DEFS, getHexDisplayStatus, generateGeoHexGrid, getZoneForCoordinate } from "../../engine/hexmap";
import { allPlaces } from "../../data/places";

type HexStatus = "explored" | "active" | "gem" | "locked";

interface HexZone {
  row: number; col: number; status: HexStatus;
  zoneId: string; zoneName: string; digipinCode: string;
  multiplier: string; gemId: number | null; density: string;
  gemsCount: number; safetyScore: number;
  polygon: [number, number][];
  centerLat: number; centerLng: number;
}

const ZONE_DATA: Record<string, { emoji: string; tagline: string; facts: string[]; nearbyPlaceIds: number[] }> = {
  srirampura: {
    emoji: "🛣️", tagline: "Where the city meets the highway",
    facts: [
      "Srirampura is Mysuru's gateway — the Bangalore–Mysore highway ends here, and thousands of commuters pass through daily.",
      "The area is known for its large medical hub — several major hospitals and clinics cluster along its main roads.",
      "Neighbourhood residents host one of Mysuru's quietest and most authentic Ganesha Chaturthi celebrations each year.",
    ],
    nearbyPlaceIds: [4, 18],
  },
  gokulam: {
    emoji: "🧘", tagline: "The yoga capital within the city",
    facts: [
      "Gokulam is internationally famous for Ashtanga yoga — hundreds of Western students come here every year to train under masters.",
      "The neighbourhood has a charming European café culture — many yoga retreats set up juice bars and health cafés along its lanes.",
      "Gokulam was developed in the 1980s and is one of Mysuru's cleanest, most tree-lined residential areas.",
    ],
    nearbyPlaceIds: [16, 18],
  },
  gandhi_square: {
    emoji: "🕰️", tagline: "The bustling colonial heart of the city",
    facts: [
      "Gandhi Square's iconic clock tower was built during the British era and remains the most recognisable landmark of central Mysuru.",
      "The square is ringed by Mysuru's most legendary filter coffee shops — Nandy's Filter Coffee has been here since 1962.",
      "At 6 PM every day, traffic stops spontaneously as cycle-rickshaw wallahs, pedestrians and vendors swarm the square.",
    ],
    nearbyPlaceIds: [12, 13, 14],
  },
  vijayanagar: {
    emoji: "🏘️", tagline: "Mysuru's modern residential heartland",
    facts: [
      "Vijayanagar is one of Mysuru's fastest-growing areas — a planned township developed in the 1990s with wide roads and parks.",
      "The Hebbal area within this zone is close to the new Mysuru–Bengaluru expressway, making it a booming real estate hub.",
      "Vijayanagar hosts some of Mysuru's best biriyani restaurants — the Old Mysore style dum biriyani here is unmatched.",
    ],
    nearbyPlaceIds: [9, 16],
  },
  devaraja_market: {
    emoji: "🌸", tagline: "A century-old sensory overload of colour and fragrance",
    facts: [
      "Devaraja Market was built in 1900 and supplies flowers to the Mysore Palace daily — tonnes of jasmine, rose and marigold arrive before dawn.",
      "The market has a dedicated section of banana-leaf-wrapped bundles of incense — Mysuru is India's agarbatti capital.",
      "Sandalwood soap bars made with real Mysuru sandal oil are sold here at a fraction of the retail price.",
    ],
    nearbyPlaceIds: [1, 2, 13],
  },
  mandi_mohalla: {
    emoji: "🕌", tagline: "The old city's cultural crossroads",
    facts: [
      "Mandi Mohalla is Mysuru's most diverse neighbourhood — Hindu temples, mosques and churches all stand within a few streets of each other.",
      "The Jama Masjid here is one of the most beautiful mosques in Karnataka, with intricate white-and-gold architecture.",
      "This zone once served as the grain market for all of Mysuru — 'Mandi' literally means 'grain market' in Urdu.",
    ],
    nearbyPlaceIds: [8, 10, 13],
  },
  heritage_core: {
    emoji: "🏰", tagline: "The royal heart of Mysuru",
    facts: [
      "Mysore Palace is lit up by 97,000 bulbs every Sunday evening — a spectacle visible from Chamundi Hill 3km away.",
      "The current Palace took 5 years to build (1897–1912) after the previous one burned down during a royal wedding.",
      "The Dasara procession from this zone is a 400-year-old tradition attracting over a million visitors each year.",
    ],
    nearbyPlaceIds: [1, 2, 3, 8],
  },
  nazarbad: {
    emoji: "⛪", tagline: "Colonial bungalows and soaring Gothic spires",
    facts: [
      "St. Philomena's Church in Nazarbad is one of the largest churches in Asia — built in 1936 in the Gothic Revival style.",
      "The Windflower Spa & Resort in this zone is set inside a restored colonial bungalow with original teak floors.",
      "Nazarbad translates roughly to 'place watched by the gaze' — it was once a residential cantonment for British officers.",
    ],
    nearbyPlaceIds: [9, 10, 16, 17],
  },
  kuvempunagar: {
    emoji: "🌿", tagline: "A green, lakeside residential gem",
    facts: [
      "Named after poet-laureate Kuvempu — Karnataka's greatest 20th-century poet and the first Jnanpith Award winner from the state.",
      "Kukkarahalli Lake here hosts 200+ species of birds including painted storks, kingfishers and rare black-headed ibises.",
      "The University of Mysore (est. 1916) is one of India's oldest universities — its Crawford Hall building is a heritage landmark.",
    ],
    nearbyPlaceIds: [18, 19, 4],
  },
  saraswathipuram: {
    emoji: "🚂", tagline: "Old Mysuru charm with a dash of steam",
    facts: [
      "The National Rail Museum branch here displays original royal saloon carriages used by the Mysore Maharajas — including a golden carriage.",
      "Saraswathipuram's filter coffee shops are legendary among locals — early morning queues form before 7 AM.",
      "This neighbourhood is home to several traditional sweet shops making original Mysuru Pak — a dense, ghee-rich fudge invented in Mysuru.",
    ],
    nearbyPlaceIds: [4, 11, 12],
  },
  fort_zone: {
    emoji: "⚔️", tagline: "Ancient walls and hidden histories",
    facts: [
      "Mysore Fort was originally built of mud by the Wadiyar kings in 1524 and only later reinforced with stone.",
      "Tipu Sultan used this fort complex as his summer capital before eventually shifting his throne to Srirangapatna.",
      "Locals believe hidden underground tunnels connect the Fort to the Palace 1 km away — archaeologists haven't confirmed it yet!",
    ],
    nearbyPlaceIds: [8, 1, 7],
  },
  yadavagiri: {
    emoji: "🌅", tagline: "Hilltop views and heritage hotels",
    facts: [
      "Yadavagiri sits at a slight elevation and offers some of the best views of the city skyline and Chamundi Hill.",
      "The Lalitha Mahal Palace Hotel (1921) was built solely to accommodate the Viceroy of India — today it's a 5-star heritage hotel.",
      "The area is dotted with sprawling old Mysuru bungalows, many from the Dewan era, with private gardens and ancient jackfruit trees.",
    ],
    nearbyPlaceIds: [15, 6, 19],
  },
  bogadi: {
    emoji: "🌆", tagline: "Mysuru's rising new quarter",
    facts: [
      "Bogadi is one of Mysuru's fastest-developing zones — the Outer Ring Road passes through it, driving rapid residential growth.",
      "The area has become a hub for IT professionals who work remotely — coworking spaces and modern cafés opened here post-2020.",
      "Bogadi Lake is a hidden birding spot — early morning walks reveal kingfishers, herons and migratory waterfowl.",
    ],
    nearbyPlaceIds: [5, 18, 20],
  },
  silk_district: {
    emoji: "⛰️", tagline: "Sacred peaks and silk-weaving valleys",
    facts: [
      "Chamundi Hill rises to 1,065 metres — the 1,000 steps carved into the hillside by Dodda Devaraja Wadiyar in the 17th century.",
      "A massive Nandi (sacred bull) statue carved from a single granite boulder stands midway up the hill — it's 4.8m tall.",
      "Mysore Silk has a GI tag — only silk produced in this region, with real gold zari, can legally carry the 'Mysore Silk' name.",
    ],
    nearbyPlaceIds: [6, 15, 19, 5],
  },
};

const hexStatusColors: Record<HexStatus, string> = {
  explored: "rgba(26,82,82,0.55)",
  active: "rgba(224,123,42,0.55)",
  gem: "rgba(201,146,31,0.8)",
  locked: "rgba(255,255,255,0.04)",
};
const hexStatusStrokes: Record<HexStatus, string> = {
  explored: "#2a7a7a", active: "#E07B2A", gem: "#FFD700", locked: "rgba(255,255,255,0.15)",
};
const multiplierConfig: Record<string, { color: string; bg: string }> = {
  "1.5x": { color: "#7A6A55", bg: "rgba(122,106,85,0.15)" },
  "2.0x": { color: "#E07B2A", bg: "rgba(224,123,42,0.15)" },
  "2.5x": { color: "#C9921F", bg: "rgba(201,146,31,0.15)" },
  "3.0x": { color: "#FFD700", bg: "rgba(255,215,0,0.15)" },
};

export function HexMap() {
  const { darkMode } = useApp();
  const C = useColors();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState<HexZone | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const selectedZoneRef = useRef<HexZone | null>(null);
  selectedZoneRef.current = selectedZone;

  const { allGems, visitedGemIds, isZoneUnlockedFn } = useGame();

  const grid = useMemo(() => {
    const geoHexes = generateGeoHexGrid(12.3400, 76.5900, 0.006, 12, 14);
    const gemCoords: Record<string, number> = {
      "3,5": 1, "4,8": 2, "6,6": 3, "8,3": 4, "7,9": 5,
      "9,7": 6, "3,11": 7, "1,8": 8, "5,2": 9, "9,10": 10,
    };
    return geoHexes.map((geoHex) => {
      const r = geoHex.row; const c = geoHex.col;
      // Assign zone by actual GPS coordinates — each hex center is checked
      // against the real geographic bounding polygons of each Mysuru zone
      const coordZone = getZoneForCoordinate({ lat: geoHex.centerLat, lng: geoHex.centerLng });
      // Fallback: if no polygon matches (e.g. edge hexes outside defined areas), use Heritage Core
      const zone = coordZone ?? ZONE_DEFS.find(z => z.id === "heritage_core") ?? ZONE_DEFS[0];
      const gemId = gemCoords[`${r},${c}`] || null;
      const gemData = gemId ? allGems.find(x => x.id === gemId) : null;
      const isUnlocked = isZoneUnlockedFn(zone.id);
      const isVisited = gemId ? visitedGemIds.has(gemId) : false;
      const isLegendary = gemData?.rarityTier === "Epic" || gemData?.rarityTier === "Legendary";
      let status: HexStatus = "locked";
      if (gemId) { status = getHexDisplayStatus(isUnlocked, isVisited, isLegendary); }
      else { status = isUnlocked ? "active" : "locked"; if (isUnlocked && ((r * 7 + c * 3) % 10) > 6) status = "explored"; }
      return { row: r, col: c, status, zoneId: zone.id, zoneName: zone.name, digipinCode: zone.digipinCode || `MYS-${r}${c}X`, multiplier: `${zone.multiplier.toFixed(1)}x`, gemId, density: "Medium", gemsCount: gemId ? 1 : 0, safetyScore: 4, polygon: geoHex.polygon, centerLat: geoHex.centerLat, centerLng: geoHex.centerLng } as HexZone;
    });
  }, [allGems, visitedGemIds, isZoneUnlockedFn]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapContainerRef.current, { center: [12.3051, 76.6450], zoom: 13, zoomControl: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri" }).addTo(leafletMapRef.current);
    }
    const map = leafletMapRef.current;
    polygonLayersRef.current.forEach(p => p.remove());
    polygonLayersRef.current = [];
    grid.forEach((zone) => {
      const zoneInfo = ZONE_DATA[zone.zoneId];
      const emoji = zoneInfo?.emoji ?? "📍";
      const poly = L.polygon(zone.polygon, { color: hexStatusStrokes[zone.status], fillColor: hexStatusColors[zone.status], fillOpacity: 1, weight: 1.5, opacity: 1 }).addTo(map);

      // Hover tooltip
      poly.bindTooltip(
        `<div class="hex-tooltip"><span class="hex-tooltip-emoji">${emoji}</span> ${zone.zoneName}</div>`,
        { sticky: true, direction: "top", offset: [0, -8], opacity: 1 }
      );

      // Highlight on hover
      poly.on("mouseover", () => {
        if (!(selectedZoneRef.current?.row === zone.row && selectedZoneRef.current?.col === zone.col)) {
          poly.setStyle({ weight: 2.5, fillOpacity: 0.75 });
        }
      });
      poly.on("mouseout", () => {
        if (!(selectedZoneRef.current?.row === zone.row && selectedZoneRef.current?.col === zone.col)) {
          poly.setStyle({ weight: 1.5, fillOpacity: 1 });
        }
      });

      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        polygonLayersRef.current.forEach(p => p.setStyle({ weight: 1.5 }));
        poly.setStyle({ weight: 4, color: "#FFD700" });
        setSelectedZone(zone);
      });
      polygonLayersRef.current.push(poly);
    });
  }, [grid]);

  useEffect(() => { return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } }; }, []);

  const zoneInfo = selectedZone ? ZONE_DATA[selectedZone.zoneId] : null;
  const nearbyPlaces = useMemo(() => {
    if (!selectedZone || !zoneInfo) return [];
    return zoneInfo.nearbyPlaceIds.map(id => allPlaces.find(p => p.id === id)).filter(Boolean);
  }, [selectedZone, zoneInfo]);

  const multiplierStyle = selectedZone ? (multiplierConfig[selectedZone.multiplier] || { color: "#E07B2A", bg: "rgba(224,123,42,0.15)" }) : { color: "#E07B2A", bg: "rgba(224,123,42,0.15)" };

  return (
    <div className="animate-fade-up relative flex flex-col map-screen-height overflow-hidden bg-[#0F3D3D]">
      {/* Floating header */}
      <div className="absolute top-0 left-0 right-0 z-[500] px-5 pt-6 pb-3 flex items-start justify-between pointer-events-none">
        <div className="rounded-2xl px-4 py-2 pointer-events-auto" style={{ background: "rgba(15,61,61,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="font-playfair text-white text-xl font-bold">Hex Map</div>
          <div className="font-dm text-white/60 text-xs">Tap a hex to explore</div>
        </div>
        <div className="rounded-2xl p-3 pointer-events-auto" style={{ background: "rgba(15,61,61,0.92)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {(["explored","active","gem","locked"] as HexStatus[]).map(s => (
            <div key={s} className="flex items-center gap-2 mb-1 last:mb-0">
              <div style={{ width:10, height:10, borderRadius:3, background:hexStatusColors[s], border:`1px solid ${hexStatusStrokes[s]}`, flexShrink:0 }} />
              <span className="font-dm text-white text-xs font-semibold">{s==="explored"?"Explored":s==="active"?"Active":s==="gem"?"Gem Zone":"Locked"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 w-full" style={{ minHeight: 0 }}>
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Bottom Sheet */}
      {selectedZone && zoneInfo && (
        <>
          <div className="absolute inset-0 z-[600]" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => { setSelectedZone(null); polygonLayersRef.current.forEach(p => { const z = selectedZoneRef.current; if (z) p.setStyle({ weight: 1.5, color: hexStatusStrokes[z.status] }); }); }} />
          <div className="absolute bottom-0 left-0 right-0 z-[700] rounded-t-[28px]" style={{ background: "#0D2828", maxHeight: "75vh", boxShadow: "0 -10px 60px rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)", animation: "slideUp 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width:36, height:4, borderRadius:99, background:"rgba(255,255,255,0.15)" }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 24px)" }}>
              <div className="px-5 pb-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-2xl text-3xl flex-shrink-0" style={{ width:56, height:56, background:"rgba(224,123,42,0.15)", border:"1px solid rgba(224,123,42,0.3)" }}>{zoneInfo.emoji}</div>
                    <div>
                      <h2 className="font-playfair text-white text-2xl font-bold leading-tight">{selectedZone.zoneName}</h2>
                      <p className="font-dm text-white/50 text-sm mt-0.5">{zoneInfo.tagline}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedZone(null)} style={{ width:32, height:32, background:"rgba(255,255,255,0.08)", border:"none", borderRadius:"50%", cursor:"pointer", color:"rgba(255,255,255,0.5)", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
                </div>
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <div className="font-dm px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: hexStatusColors[selectedZone.status], border:`1px solid ${hexStatusStrokes[selectedZone.status]}`, color: selectedZone.status === "locked" ? "rgba(255,255,255,0.4)" : "#fff" }}>
                    {selectedZone.status === "explored" ? "✅ Explored" : selectedZone.status === "active" ? "🟠 Active" : selectedZone.status === "gem" ? "💎 Gem Zone" : "🔒 Locked"}
                  </div>
                  <div className="font-dm px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: multiplierStyle.bg, color: multiplierStyle.color }}>⚡ {selectedZone.multiplier} Pts</div>
                  <div className="font-dm px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)" }}>📡 {selectedZone.digipinCode}</div>
                </div>
                {/* Facts */}
                <h3 className="font-playfair text-white text-lg font-bold mb-3">🔍 Did You Know?</h3>
                <div className="flex flex-col gap-2 mb-5">
                  {zoneInfo.facts.map((fact, i) => (
                    <div key={i} className="font-dm rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.82)" }}>
                      <span className="font-bold text-amber-400 mr-2">{i + 1}.</span>{fact}
                    </div>
                  ))}
                </div>
                {/* Nearby Places */}
                {nearbyPlaces.length > 0 && (
                  <>
                    <h3 className="font-playfair text-white text-lg font-bold mb-3">📍 Explore Nearby</h3>
                    <div className="flex flex-col gap-2 mb-5">
                      {nearbyPlaces.map(place => place && (
                        <div key={place.id} className="flex items-center gap-3 rounded-2xl overflow-hidden cursor-pointer" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }} onClick={() => { setSelectedZone(null); navigate("/places"); }}>
                          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: place.gradient || "rgba(224,123,42,0.2)" }}>{place.emoji}</div>
                          <div className="flex-1 min-w-0 py-2 pr-3">
                            <div className="font-dm text-white font-semibold text-sm truncate">{place.name}</div>
                            <div className="font-dm text-white/45 text-xs mt-0.5 truncate">{place.location}</div>
                            {place.description && <div className="font-dm text-white/55 text-xs mt-1 leading-relaxed" style={{ display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{place.description}</div>}
                          </div>
                          <div className="pr-3 text-white/25 text-lg">›</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {/* CTA */}
                <button className="font-dm w-full" onClick={() => { if (selectedZone.status !== "locked") { setSelectedZone(null); navigate("/map"); } }} style={{ height:52, borderRadius:99, background: selectedZone.status === "locked" ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg, #E07B2A, #C9921F)", color: selectedZone.status === "locked" ? "rgba(255,255,255,0.3)" : "#fff", fontWeight:800, fontSize:16, border:"none", cursor: selectedZone.status === "locked" ? "not-allowed" : "pointer", boxShadow: selectedZone.status === "locked" ? "none" : "0 6px 24px rgba(224,123,42,0.4)" }}>
                  {selectedZone.status === "locked" ? "🔒 Explore nearby to unlock" : "🗺️ Open on Full Map →"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .hex-tooltip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: #fff;
          white-space: nowrap;
        }
        .hex-tooltip-emoji { font-size: 15px; }
        .leaflet-tooltip {
          background: rgba(13, 40, 40, 0.95) !important;
          border: 1px solid rgba(255,255,255,0.15) !important;
          border-radius: 10px !important;
          padding: 6px 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          backdrop-filter: blur(8px);
          color: #fff !important;
        }
        .leaflet-tooltip::before {
          border-top-color: rgba(13,40,40,0.95) !important;
        }
      `}</style>
    </div>
  );
}
