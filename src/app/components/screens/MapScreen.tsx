import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { haversineDistance } from "../../engine/checkin";
import { getWeatherChoicePrompt } from "../../engine/weather";

import { allPlaces } from "../../data/places";

/* ── Types ─────────────────────────────────────────────────────── */
export type PlaceCategory = "Heritage" | "Temple" | "Church" | "Food" | "Stay" | "Nature" | "Hidden Gem";

interface Place {
  id: number; emoji: string; name: string; subtitle: string;
  category: PlaceCategory; lat: number; lng: number;
  description: string; rating: number; points?: number; gemId?: number; tag?: string;
}

interface Hazard {
  id: number; emoji: string; type: "Road" | "Safety" | "Closed" | "Info";
  area: string; description: string; severity: "Low" | "Medium" | "High";
  timeAgo: string; upvotes: number; lat: number; lng: number;
}



  // ── Init map ──────────────────────────────────────────────────────── */
const hardcodedPlaces: Place[] = [
  { id: 1,  emoji: "🏰", name: "Mysore Palace",          subtitle: "Palace Area",      category: "Heritage",    lat: 12.3052, lng: 76.6551, rating: 4.9, description: "The majestic seat of the Wadiyar dynasty — one of India's top-visited monuments, glowing in 100,000 bulbs every Sunday.", tag: "Must Visit" },
  { id: 2,  emoji: "🖼️", name: "Jaganmohan Palace",      subtitle: "Shakthinagar",     category: "Heritage",    lat: 12.3063, lng: 76.6522, rating: 4.5, description: "A 19th-century palace converted into an art gallery showcasing royal paintings, musical instruments and antique artifacts." },
  { id: 3,  emoji: "🎡", name: "Mysore Zoo",              subtitle: "Ramanuja Rd",      category: "Heritage",    lat: 12.3009, lng: 76.6546, rating: 4.6, description: "One of the oldest and most well-maintained zoological gardens in India, home to 1,400+ animals across 170+ species." },
  { id: 4,  emoji: "🚂", name: "Rail Museum",             subtitle: "Irwin Road",       category: "Heritage",    lat: 12.2977, lng: 76.6339, rating: 4.3, description: "A lovingly curated museum displaying vintage steam locomotives, royal saloons and railway artefacts from the British era." },
  { id: 5,  emoji: "🏛️", name: "Karanji Lake Dome",      subtitle: "Hunsur Rd",        category: "Heritage",    lat: 12.2950, lng: 76.6470, rating: 4.4, description: "A butterfly park inside Karanji Lake — 1,200+ butterfly varieties flutter inside a massive 10,000 sq ft walk-through enclosure." },
  { id: 6,  emoji: "🛕", name: "Chamundeshwari Temple",  subtitle: "Chamundi Hill",    category: "Temple",      lat: 12.2723, lng: 76.6975, rating: 4.8, description: "The crown jewel of Mysuru — a 12th-century temple atop Chamundi Hill, sacred to Goddess Chamundeshwari.", tag: "Sacred" },
  { id: 7,  emoji: "🛕", name: "Trinesvara Temple",      subtitle: "Lakshmipuram",     category: "Temple",      lat: 12.2940, lng: 76.6570, rating: 4.7, description: "A 300-year-old hidden Shiva temple with rare Hoysala stonework. Sunrise puja at 5:30 AM is a transcendent experience.", points: 200, gemId: 3, tag: "Hidden Gem" },
  { id: 8,  emoji: "🛕", name: "Venkataramana Temple",   subtitle: "Fort Area",        category: "Temple",      lat: 12.3027, lng: 76.6534, rating: 4.5, description: "A beautiful Vaishnavite temple near Mysore Fort known for its intricately carved gopuram and morning abhisheka rituals." },
  { id: 9,  emoji: "⛪", name: "St. Philomena's Church", subtitle: "Ashoka Rd",        category: "Church",      lat: 12.3193, lng: 76.6518, rating: 4.8, description: "A soaring neo-Gothic cathedral built in 1936 — one of the largest churches in Asia, with stunning stained-glass windows.", tag: "Must Visit" },
  { id: 10, emoji: "⛪", name: "St. Bartholomew's",      subtitle: "Nazarbad",         category: "Church",      lat: 12.3065, lng: 76.6528, rating: 4.5, description: "Built by British soldiers in 1832, a serene colonial-era church with whitewashed walls and a peaceful garden cemetery." },
  { id: 11, emoji: "🍛", name: "Iyer's Idli Corner",     subtitle: "Agrahara Lane",    category: "Food",        lat: 12.2985, lng: 76.6430, rating: 4.9, description: "50 plates a day, gone by 7 AM. Slow-cooked sambar and Chamundi Hill herb chutney — the definitive Mysuru breakfast.", points: 85, gemId: 2, tag: "Legendary" },
  { id: 12, emoji: "☕", name: "Nandy's Filter Coffee",  subtitle: "Gandhi Square",    category: "Food",        lat: 12.3015, lng: 76.6498, rating: 4.8, description: "Running since 1962. Arabica-robusta blend roasted in a charcoal drum out back. A cup of history in every sip.", points: 65, gemId: 7 },
  { id: 13, emoji: "🍽️", name: "Hotel RRR",              subtitle: "Gandhi Square",    category: "Food",        lat: 12.3060, lng: 76.6535, rating: 4.6, description: "Authentic Karnataka thali served on banana leaves. A beloved local institution that's been feeding families for decades." },
  { id: 14, emoji: "🥞", name: "Vinayaka Mylari",        subtitle: "Nazarbad",         category: "Food",        lat: 12.3038, lng: 76.6494, rating: 4.7, description: "Famous for its uniquely soft dosas made from a decades-old fermented batter recipe. Arrive early — lines form by 6:30 AM.", tag: "Local Fav" },
  { id: 15, emoji: "🏰", name: "Lalitha Mahal Palace",   subtitle: "Mysore East",      category: "Stay",        lat: 12.2965, lng: 76.6701, rating: 4.9, description: "A breathtaking 1921 palace-hotel with baroque architecture, butler service and panoramic views of Chamundi Hill.", tag: "Heritage Stay" },
  { id: 16, emoji: "🏩", name: "The Windflower Resort",  subtitle: "Nazarbad Ring Rd", category: "Stay",        lat: 12.3180, lng: 76.6400, rating: 4.7, description: "A serene luxury resort blending traditional Karnataka architecture with modern spa facilities and infinity pools." },
  { id: 17, emoji: "🏨", name: "Hotel Sandesh Prince",   subtitle: "Nazarbad",         category: "Stay",        lat: 12.3062, lng: 76.6503, rating: 4.5, description: "A well-loved city hotel in the heart of Mysuru, perfectly placed for walking distance to the Palace and markets." },
  { id: 18, emoji: "🌿", name: "Kukkarahalli Lake",      subtitle: "Near CFTRI",       category: "Nature",      lat: 12.3126, lng: 76.6435, rating: 4.5, description: "A 90-acre bird sanctuary maintained by University of Mysore — 200+ species including painted storks and kingfishers.", points: 95, gemId: 9 },
  { id: 19, emoji: "🏔️", name: "Chamundi Hill",          subtitle: "Mysuru South",     category: "Nature",      lat: 12.2733, lng: 76.6972, rating: 4.8, description: "Sacred hill with a winding 1,000-step staircase and panoramic views of the entire Mysuru city and palace below." },
  { id: 20, emoji: "🌸", name: "Brindavan Gardens",      subtitle: "KRS Dam, Mandya",  category: "Nature",      lat: 12.4244, lng: 76.5725, rating: 4.7, description: "Terraced gardens on the banks of KRS Dam with musical fountains illuminated in colour every evening after dusk.", tag: "Day Trip" },
  { id: 21, emoji: "🎨", name: "Rangoli Street Art",     subtitle: "Sayyaji Rao Rd",   category: "Hidden Gem",  lat: 12.2995, lng: 76.6495, rating: 4.8, description: "An ephemeral masterpiece drawn fresh each dawn by local artist Gowramma using natural pigments. Gone by 10 AM.", points: 120, gemId: 1, tag: "HADI Gem" },
  { id: 22, emoji: "🎭", name: "Puppet Workshop Hall",   subtitle: "Chamundipuram",    category: "Hidden Gem",  lat: 12.2940, lng: 76.6450, rating: 4.9, description: "The last surviving Yakshagana puppet studio in Karnataka. Craftsman Yellappa uses 18th-century manuscript techniques.", points: 220, gemId: 8, tag: "HADI Gem" },
  { id: 23, emoji: "🧵", name: "Mysore Silk Weaver",     subtitle: "Ashoka Road",      category: "Hidden Gem",  lat: 12.3030, lng: 76.6580, rating: 4.7, description: "Fourth-generation royal silk weavers. Each handmade saree takes 3–4 days and uses a secret jacquard loom setup.", points: 250, gemId: 10, tag: "HADI Gem" },
  { id: 24, emoji: "🧶", name: "Channapatna Toys",       subtitle: "Devaraja Market",  category: "Hidden Gem",  lat: 12.3048, lng: 76.6520, rating: 4.6, description: "A 3rd-generation lacquerware studio inside Devaraja Market. Each toy is hand-finished over 3–4 days.", points: 150, gemId: 4, tag: "HADI Gem" },
  { id: 25, emoji: "🕌", name: "Jama Masjid Backstreet", subtitle: "Nazarbad",         category: "Hidden Gem",  lat: 12.3067, lng: 76.6528, rating: 4.6, description: "A living architecture timeline from Tipu Sultan-era arched doorways to British-period wrought-iron balconies.", points: 180, gemId: 6, tag: "HADI Gem" },
];

// Tiny deterministic jitter so two places at exact same location don't perfectly stack
const jitter = (id: number, scale = 0.0003) => (((id * 2654435761) >>> 0) / 0xFFFFFFFF - 0.5) * scale * 2;

const mapCat = (c: string): PlaceCategory => {
  if (c === "Attractions") return "Heritage";
  if (c === "Temples") return "Temple";
  if (c === "Churches") return "Church";
  if (c === "Hidden Gems") return "Hidden Gem";
  return c as PlaceCategory;
};

const places: Place[] = [...hardcodedPlaces];
for (const p of allPlaces) {
  if (!places.find(hp => hp.id === p.id || hp.name === p.name)) {
    // Use real coords from places.ts data if available, otherwise fallback to city center with jitter
    const lat = p.lat ?? (12.3052 + jitter(p.id * 3));
    const lng = p.lng ?? (76.6551 + jitter(p.id * 7));
    places.push({
      id: p.id,
      emoji: p.emoji,
      name: p.name,
      subtitle: p.location,
      category: mapCat(p.category),
      lat,
      lng,
      description: p.description || "A wonderful place to explore in Mysuru.",
      rating: 4.0 + (p.id % 10) * 0.1,
    });
  }
}

const hazards: Hazard[] = [
  { id: 1, emoji: "🚧", type: "Road",   area: "Sayyaji Rao Rd",    description: "Road repair work blocking eastbound lane near Gandhi Square.",              severity: "Medium", timeAgo: "2h ago",  upvotes: 14, lat: 12.2995, lng: 76.6510 },
  { id: 2, emoji: "⚠️", type: "Safety", area: "Devaraja Market",    description: "Heavy crowd congestion — pickpocket risk elevated. Keep valuables secure.", severity: "High",   timeAgo: "45m ago", upvotes: 32, lat: 12.3048, lng: 76.6530 },
  { id: 3, emoji: "🚫", type: "Closed", area: "Kukkarahalli Lake",  description: "North gate entrance temporarily closed for maintenance until May 3.",       severity: "Low",    timeAgo: "1d ago",  upvotes: 8,  lat: 12.3126, lng: 76.6435 },
  { id: 4, emoji: "⚠️", type: "Safety", area: "Chamundi Hill Steps",description: "Slippery stone steps after overnight rain. Use handrail support.",         severity: "High",   timeAgo: "3h ago",  upvotes: 21, lat: 12.2733, lng: 76.6972 },
  { id: 5, emoji: "🚧", type: "Road",   area: "Nazarbad",           description: "Water pipe burst causing a 200m road diversion near Jama Masjid.",          severity: "Medium", timeAgo: "6h ago",  upvotes: 18, lat: 12.3067, lng: 76.6510 },
  { id: 6, emoji: "🚫", type: "Closed", area: "Jaganmohan Palace",  description: "Gallery closed today for a private royal ceremony event.",                  severity: "Low",    timeAgo: "5h ago",  upvotes: 5,  lat: 12.3063, lng: 76.6522 },
];

/* ── Config ────────────────────────────────────────────────────── */
const catConfig: Record<PlaceCategory, { color: string; bg: string; icon: string; label: string }> = {
  Heritage:     { color: "#C9921F", bg: "rgba(201,146,31,0.12)",  icon: "🏛️", label: "Heritage" },
  Temple:       { color: "#E07B2A", bg: "rgba(224,123,42,0.12)",  icon: "🛕", label: "Temples" },
  Church:       { color: "#7c3aed", bg: "rgba(124,58,237,0.12)",  icon: "⛪", label: "Churches" },
  Food:         { color: "#dc2626", bg: "rgba(220,38,38,0.12)",   icon: "🍽️", label: "Food" },
  Stay:         { color: "#059669", bg: "rgba(5,150,105,0.12)",   icon: "🏨", label: "Stay" },
  Nature:       { color: "#16a34a", bg: "rgba(22,163,74,0.12)",   icon: "🌿", label: "Nature" },
  "Hidden Gem": { color: "#0F3D3D", bg: "rgba(15,61,61,0.15)",   icon: "💎", label: "Hidden Gems" },
};

const ALL_CATEGORIES: PlaceCategory[] = ["Heritage", "Temple", "Church", "Food", "Stay", "Nature"];

const severityColor: Record<string, string> = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };

/* ── Icon factories (pure Leaflet, no react-leaflet) ───────────── */
function makeIcon(emoji: string, color: string, selected: boolean, suitability: number = 1.0, warningEmoji?: string): L.DivIcon {
  const size = selected ? 52 : 44;
  const shadow = selected
    ? `0 6px 24px ${color}88, 0 2px 8px rgba(0,0,0,0.25)`
    : `0 3px 12px ${color}55, 0 1px 4px rgba(0,0,0,0.2)`;
  const pulse = selected && suitability >= 1.0
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.4;animation:markerPulse 1.5s ease-in-out infinite;"></div>`
    : "";
  
  const grayscale = suitability < 0.5 ? "grayscale(100%) opacity(60%)" : "none";
  const badge = (suitability < 0.5 && warningEmoji) 
    ? `<div style="position:absolute;top:-6px;right:-6px;background:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.2);">${warningEmoji}</div>`
    : (suitability >= 1.2 ? `<div style="position:absolute;top:-6px;right:-6px;background:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.2);">✨</div>` : "");

  return L.divIcon({
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:${shadow};border:${selected ? "3px" : "2.5px"} solid #fff;font-size:${selected ? 22 : 18}px;cursor:pointer;transition:all 0.2s;filter:${grayscale}">${pulse}${emoji}${badge}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeHazardIcon(emoji: string, color: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:38px;height:38px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px ${color}66;border:2.5px solid #fff;font-size:17px;cursor:pointer;">${emoji}</div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/* ── Component ─────────────────────────────────────────────────── */
export function MapScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const C = useColors();
  const { darkMode, savedGems, requestLocation, userCoords } = useApp();
  const { stats, visitedGemIds, checkinRecords, allGems, getGemSuitability, currentWeather } = useGame();

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Array<{ marker: L.Marker; id: number }>>([]);
  const mysteryCircleRef = useRef<L.Circle | null>(null);

  const mysteryZone = location.state?.mysteryZone;

  // Use state (not ref) so changing target triggers re-render and re-draws the circle
  const [mysteryTarget, setMysteryTarget] = useState<Place | null>(null);

  useEffect(() => {
    if (mysteryZone) {
      // Pick a fresh random Hidden Gem every time a new mystery zone is entered
      const hiddenGems = places.filter(p => p.category === "Hidden Gem");
      const pool = hiddenGems.length > 0 ? hiddenGems : places;
      const randomIndex = Math.floor(Math.random() * pool.length);
      setMysteryTarget(pool[randomIndex]);
    } else {
      setMysteryTarget(null);
    }
  }, [mysteryZone]);

  const [mapTab, setMapTab] = useState<"Explore" | "Hazards">("Explore");
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | "All">("All");
  const [selected, setSelected] = useState<Place | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [upvoted, setUpvoted] = useState<Set<number>>(new Set());

  // Filter out 'Hidden Gem' from the 'All' view, and never show it unless activeCategory is explicitly 'Hidden Gem' (which is removed from the pills)
  const filtered = activeCategory === "All" 
    ? places.filter((p) => p.category !== "Hidden Gem") 
    : places.filter((p) => p.category === activeCategory);
  const cfg = selected ? catConfig[selected.category] : null;

  // Auto-fit bounds when category changes
  useEffect(() => {
    if (mapTab === "Explore" && mapInstanceRef.current && markersRef.current.length > 0) {
      const bounds = L.latLngBounds(markersRef.current.map(m => m.marker.getLatLng()));
      if (bounds.isValid()) {
        mapInstanceRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 16 });
      }
    }
  }, [activeCategory, mapTab, filtered]);

  const handleMyLocation = () => {
    if (!mapInstanceRef.current) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.flyTo([latitude, longitude], 15, { duration: 1.5 });
        
        // Add a pulsing blue dot for the user's location
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(59,130,246,0.6);animation:markerPulse 2s infinite"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        L.marker([latitude, longitude], { icon }).addTo(mapInstanceRef.current!);
      }, () => {
        // Fallback to center if permission denied
        mapInstanceRef.current?.flyTo([12.305, 76.655], 13);
      });
    }
  };

  // ── Initialise Leaflet map once ──────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [12.3, 76.6515],
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; CARTO", subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // ── Sync markers whenever tab or category changes ────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove all existing markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];
    if (mysteryCircleRef.current) {
      mysteryCircleRef.current.remove();
      mysteryCircleRef.current = null;
    }

    if (mysteryZone && mysteryTarget) {
      const target = mysteryTarget;
      mysteryCircleRef.current = L.circle([target.lat, target.lng], {
        radius: 100,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2
      }).addTo(map);

      map.flyTo([target.lat, target.lng], 17, { duration: 1.5 });
      return;
    }

    if (mapTab === "Explore") {
      const isStorm = currentWeather.condition === "heavy_rain" || currentWeather.condition === "heavy_thunderstorm";
      const warningEmoji = isStorm ? "⛈️" : "☀️";

      filtered.forEach((place) => {
        let suitability = 1.0;
        if (place.gemId) suitability = getGemSuitability(place.gemId);

        const isSelected = selected?.id === place.id;
        const icon = makeIcon(place.emoji, catConfig[place.category].color, isSelected, suitability, warningEmoji);
        const marker = L.marker([place.lat, place.lng], { icon });
        marker.on("click", () => {
          setSelected((prev) => (prev?.id === place.id ? null : place));
        });
        marker.addTo(map);
        markersRef.current.push({ marker, id: place.id });
      });
    } else {
      hazards.forEach((h) => {
        const icon = makeHazardIcon(h.emoji, severityColor[h.severity]);
        const marker = L.marker([h.lat, h.lng], { icon });
        marker.on("click", () => {
          setSelectedHazard((prev) => (prev?.id === h.id ? null : h));
        });
        marker.addTo(map);
        markersRef.current.push({ marker, id: h.id });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTab, activeCategory, filtered.length, currentWeather, getGemSuitability, mysteryZone, mysteryTarget]);

  // ── Update selected marker icon when selection changes ───────
  useEffect(() => {
    if (mapTab !== "Explore") return;
    const isStorm = currentWeather.condition === "heavy_rain" || currentWeather.condition === "heavy_thunderstorm";
    const warningEmoji = isStorm ? "⛈️" : "☀️";

    markersRef.current.forEach(({ marker, id }) => {
      const place = places.find((p) => p.id === id);
      if (!place) return;
      let suitability = 1.0;
      if (place.gemId) suitability = getGemSuitability(place.gemId);
      marker.setIcon(makeIcon(place.emoji, catConfig[place.category].color, selected?.id === id, suitability, warningEmoji));
    });
  }, [selected, mapTab, currentWeather, getGemSuitability]);

  const handleTabSwitch = useCallback((tab: "Explore" | "Hazards") => {
    setMapTab(tab);
    setSelected(null);
    setSelectedHazard(null);
  }, []);

  return (
    <div
      className="map-screen-height animate-fade-up relative w-full flex items-center justify-center"
      style={{ overflow: "hidden" }}
    >
      <style>{`
        @keyframes markerPulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.5);opacity:0} }
        .leaflet-container { font-family: 'DM Sans', sans-serif; }
        .leaflet-control-attribution { font-size: 10px; opacity: 0.6; }
        .leaflet-bar a { background: rgba(255,255,255,0.95) !important; backdrop-filter: blur(8px); border-color: rgba(26,18,8,0.1) !important; color: #0F3D3D !important; font-weight: 700 !important; }
        .leaflet-bar a:hover { background: #0F3D3D !important; color: #fff !important; }
      `}</style>

      {/* ── Map container div ── */}
      <div ref={mapDivRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />

      {/* ── Header overlay ── */}
      <div
        className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 pt-4 pb-3"
        style={{ background: "linear-gradient(to bottom, rgba(15,61,61,0.92) 0%, rgba(15,61,61,0.6) 70%, transparent 100%)", pointerEvents: "none" }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🧭</span>
            <span className="font-playfair" style={{ color: "#E07B2A", fontStyle: "italic", fontSize: 20, fontWeight: 700 }}>HADI</span>
            <span className="font-dm" style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>· Mysuru Map</span>
          </div>
          <p className="font-dm" style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
            {mapTab === "Explore" ? `${filtered.length} places in view` : `${hazards.length} active reports`}
          </p>
        </div>
        <div className="font-dm flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
          style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 12, fontWeight: 500, pointerEvents: "auto" }}>
          📍 Mysuru, KA
        </div>
      </div>

      {/* ── My Location FAB ── */}
      <button 
        onClick={handleMyLocation}
        className="absolute z-[1000] flex items-center justify-center pressable"
        style={{
          bottom: mapTab === "Explore" && !selected ? 80 : 20,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#fff",
          border: `1px solid ${C.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          cursor: "pointer",
          pointerEvents: "auto"
        }}
      >
        <span style={{ fontSize: 22, color: "#3b82f6" }}>🧭</span>
      </button>

      {/* ── Explore / Hazards tab bar ── */}
      <div className="absolute z-[1000] flex gap-2" style={{ top: 72, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto" }}>
        {(["Explore", "Hazards"] as const).map((t) => (
          <button key={t} onClick={() => handleTabSwitch(t)} className="font-dm pressable flex items-center gap-1.5"
            style={{ padding: "8px 18px", borderRadius: 99, background: mapTab === t ? "#fff" : "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: mapTab === t ? "none" : "1px solid rgba(255,255,255,0.2)", color: mapTab === t ? "#0F3D3D" : "#fff", fontWeight: mapTab === t ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: mapTab === t ? "0 4px 16px rgba(0,0,0,0.18)" : "none" }}>
            {t === "Explore" ? "🗺️ Explore" : "⚠️ Hazards"}
          </button>
        ))}
      </div>

      {/* ── Category pills (Explore) ── */}
      {mapTab === "Explore" && (
        <div className="absolute top-[116px] left-0 right-0 z-[1000] px-4 pb-3" style={{ pointerEvents: "auto" }}>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveCategory("All")} className="font-dm shrink-0 pressable"
              style={{ padding: "7px 14px", borderRadius: 99, background: activeCategory === "All" ? "#fff" : "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: activeCategory === "All" ? "none" : "1px solid rgba(255,255,255,0.2)", color: activeCategory === "All" ? "#0F3D3D" : "#000", fontWeight: activeCategory === "All" ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: activeCategory === "All" ? "0 4px 16px rgba(0,0,0,0.18)" : "none", whiteSpace: "nowrap" }}>
              🗺️ All
            </button>
            {ALL_CATEGORIES.map((cat) => {
              const cc = catConfig[cat];
              const active = activeCategory === cat;
              return (
                <button key={cat} onClick={() => setActiveCategory(active ? "All" : cat)} className="font-dm shrink-0 pressable"
                  style={{ padding: "7px 14px", borderRadius: 99, background: active ? cc.color : "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: active ? "none" : "1px solid rgba(255,255,255,0.2)", color: active ? "#fff" : "#000", fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: active ? `0 4px 16px ${cc.color}55` : "none", whiteSpace: "nowrap" }}>
                  {cc.icon} {cc.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hazard legend ── */}
      {mapTab === "Hazards" && !selectedHazard && (
        <div className="absolute z-[1000] px-4 py-3 rounded-[16px]"
          style={{ top: 116, left: 16, background: "rgba(15,61,61,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", pointerEvents: "none" }}>
          {([["🚧","Road Issue","#f59e0b"],["⚠️","Safety","#ef4444"],["🚫","Closed","#9ca3af"]] as [string,string,string][]).map(([e,l,c]) => (
            <div key={l} className="flex items-center gap-2 mb-1 last:mb-0">
              <span style={{ fontSize: 14 }}>{e}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
              <span className="font-dm" style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hazard list panel ── */}
      {mapTab === "Hazards" && !selectedHazard && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] rounded-t-[24px] overflow-hidden" style={{ background: C.bg, maxHeight: "45vh" }}>
          <div className="px-5 pt-4 pb-2">
            <div className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, background: C.border }} />
            <h3 className="font-playfair" style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>Recent Reports</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(45vh - 64px)", scrollbarWidth: "none" }}>
            {hazards.map((h) => (
              <div key={h.id} className="tap-card flex items-start gap-3 px-5 py-3 cursor-pointer"
                style={{ borderTop: `1px solid ${C.border}` }}
                onClick={() => setSelectedHazard(h)}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{h.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-dm" style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{h.area}</p>
                    <span className="font-dm" style={{ background: `${severityColor[h.severity]}18`, color: severityColor[h.severity], fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, flexShrink: 0 }}>{h.severity}</span>
                  </div>
                  <p className="font-dm" style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{h.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-dm" style={{ color: C.muted, fontSize: 11 }}>{h.timeAgo}</p>
                  <p className="font-dm" style={{ color: "#E07B2A", fontSize: 11, fontWeight: 600 }}>▲ {h.upvotes + (upvoted.has(h.id) ? 1 : 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hazard detail card ── */}
      {mapTab === "Hazards" && selectedHazard && (
        <>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease-out" }} onClick={() => setSelectedHazard(null)}>
            <div className="rounded-[24px] overflow-hidden w-full"
              style={{ background: C.bg, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", maxHeight: "90vh", maxWidth: 600, animation: "modalSlideIn 0.3s cubic-bezier(0.22,1,0.36,1)" }}
              onClick={(e) => e.stopPropagation()}>
            <div className="relative flex items-end px-5 pb-4" style={{ height: 100, background: `linear-gradient(135deg, ${severityColor[selectedHazard.severity]}cc, ${severityColor[selectedHazard.severity]}88)`, overflow: "hidden" }}>
              <button onClick={() => setSelectedHazard(null)} className="absolute top-4 right-4 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 18 }}>×</button>
              <span style={{ fontSize: 40, position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)" }}>{selectedHazard.emoji}</span>
              <div>
                <span className="font-dm" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                  {selectedHazard.type.toUpperCase()} · {selectedHazard.severity.toUpperCase()}
                </span>
                <h2 className="font-playfair mt-1" style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{selectedHazard.area}</h2>
              </div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="font-dm" style={{ color: C.muted, fontSize: 14, lineHeight: 1.65 }}>{selectedHazard.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-dm" style={{ color: C.muted, fontSize: 12 }}>Reported {selectedHazard.timeAgo}</span>
                <button
                  onClick={() => setUpvoted((s) => { const n = new Set(s); n.has(selectedHazard.id) ? n.delete(selectedHazard.id) : n.add(selectedHazard.id); return n; })}
                  className="font-dm pressable flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]"
                  style={{ background: upvoted.has(selectedHazard.id) ? "rgba(224,123,42,0.1)" : C.cardAlt, border: `1px solid ${upvoted.has(selectedHazard.id) ? "#E07B2A" : C.border}`, color: upvoted.has(selectedHazard.id) ? "#E07B2A" : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  ▲ {selectedHazard.upvotes + (upvoted.has(selectedHazard.id) ? 1 : 0)} Confirm
                </button>
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      {/* ── Explore place info card ── */}
      {mapTab === "Explore" && selected && cfg && (
        <>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease-out" }} onClick={() => setSelected(null)}>
            <div className="rounded-[24px] overflow-hidden w-full"
              style={{ background: C.bg, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", maxHeight: "90vh", maxWidth: 600, animation: "modalSlideIn 0.3s cubic-bezier(0.22,1,0.36,1)" }}
              onClick={(e) => e.stopPropagation()}>
            <div className="relative flex items-end px-5 pb-4" style={{ height: 110, background: `linear-gradient(135deg, ${cfg.color}dd, ${cfg.color}99)`, overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -20, top: -20, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 48, position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}>{selected.emoji}</span>
              <div className="relative z-10">
                {selected.tag && (
                  <div className="font-dm inline-block mb-2 px-2.5 py-1 rounded-[8px]"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
                    {selected.tag.toUpperCase()}
                  </div>
                )}
                <h2 className="font-playfair" style={{ color: "#fff", fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>{selected.name}</h2>
                <p className="font-dm" style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>📍 {selected.subtitle}</p>
              </div>
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 18 }}>×</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(60vh - 110px)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} style={{ fontSize: 12, opacity: s <= Math.round(selected.rating) ? 1 : 0.25 }}>★</span>
                    ))}
                    <span className="font-dm ml-1" style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{selected.rating.toFixed(1)}</span>
                  </div>
                  <span className="font-dm px-2 py-0.5 rounded-[8px]" style={{ background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 700 }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                {selected.points && (
                  <div className="font-playfair flex items-center gap-1.5 px-3 py-1.5 rounded-[10px]" style={{ background: "rgba(224,123,42,0.1)", color: "#E07B2A" }}>
                    <span style={{ fontSize: 14 }}>💎</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>+{selected.points} pts</span>
                  </div>
                )}
              </div>
              
              {/* Dynamic Weather Prompt */}
              {(() => {
                let weatherPrompt: string | null = null;
                if (selected.gemId) {
                  const gemData = allGems.find(g => g.id === selected.gemId);
                  const multiplier = getGemSuitability(selected.gemId);
                  if (gemData) {
                    weatherPrompt = getWeatherChoicePrompt(currentWeather, gemData.weatherProfile, multiplier);
                  }
                }
                if (!weatherPrompt) return null;
                return (
                  <div className="font-dm mb-4 px-3 py-2 rounded-[10px]" style={{ background: "rgba(224,123,42,0.1)", color: "#E07B2A", fontSize: 13, fontWeight: 600, border: "1px solid rgba(224,123,42,0.2)" }}>
                    {weatherPrompt}
                  </div>
                );
              })()}

              <p className="font-dm mb-4" style={{ color: C.muted, fontSize: 13, lineHeight: 1.65 }}>{selected.description}</p>
              <div className="flex gap-3">
                {selected.gemId ? (
                  <button onClick={() => navigate(`/gem/${selected.gemId}`)} className="font-dm flex-1 pressable flex items-center justify-center gap-2"
                    style={{ height: 46, borderRadius: 99, background: "#E07B2A", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(224,123,42,0.35)" }}>
                    <span>💎</span> View Gem Details
                  </button>
                ) : (
                  <button className="font-dm flex-1 pressable flex items-center justify-center gap-2"
                    style={{ height: 46, borderRadius: 99, background: cfg.color, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: `0 4px 16px ${cfg.color}44` }}>
                    <span>🗺️</span> Explore Place
                  </button>
                )}
                <button
                  className="pressable flex items-center justify-center"
                  style={{ width: 46, height: 46, borderRadius: "50%", background: C.card, border: `1.5px solid ${C.border}`, cursor: "pointer", fontSize: 20, flexShrink: 0 }}
                  onClick={() => window.open(`https://maps.google.com/?q=${selected.lat},${selected.lng}`, "_blank")}>
                  🧭
                </button>
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      {/* ── Legend chip (Explore, no selection) ── */}
      {mapTab === "Explore" && !selected && (
        <div className="absolute bottom-4 left-4 z-[1000] rounded-[16px] px-4 py-3"
          style={{ background: "rgba(15,61,61,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 24px rgba(0,0,0,0.2)", maxWidth: 200 }}>
          <p className="font-dm mb-2" style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tap a marker</p>
          {ALL_CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-2 mb-1 last:mb-0">
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: catConfig[cat].color, flexShrink: 0 }} />
              <span className="font-dm" style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>{catConfig[cat].icon} {catConfig[cat].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
