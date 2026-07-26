import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { getBloomColor } from "../../data/gems";
import { useGame } from "../../store/GameStore";
import { fetchLiveWeather, getWeatherMatchReason } from "../../engine/weather";
import type { WeatherCondition } from "../../engine/types";

type Tab = "About" | "Audio Walk" | "Reviews";

const reviews = [
  { id: 1, avatar: "👩", avatarBg: "linear-gradient(135deg, #C9921F, #E07B2A)", name: "Priya Nair", rating: 5, text: "Absolutely magical find! The atmosphere here is unlike anything else in Mysuru. Go early in the morning for the best experience." },
  { id: 2, avatar: "🧔", avatarBg: "linear-gradient(135deg, #065f46, #059669)", name: "Arjun M.", rating: 4, text: "Hidden gem in the truest sense. Most locals don't even know about this place. Earned my best points haul here!" },
];

const wvClasses = ["wv1","wv2","wv3","wv4","wv5","wv6","wv7","wv4","wv3","wv2","wv1","wv5","wv6","wv3","wv7","wv2","wv4","wv1","wv5","wv3","wv7","wv2","wv6","wv4","wv1","wv5","wv3","wv2","wv7","wv4"];
const wvHeights = [6,10,14,8,18,6,12,16,8,22,10,14,6,20,12,8,18,10,16,6,14,22,8,12,18,6,10,20,14,8];

function Waveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end justify-center gap-0.5" style={{ height: 44, padding: "0 4px" }}>
      {wvClasses.map((cls, i) => (
        <div
          key={i}
          className={playing ? cls : ""}
          style={{
            width: 3,
            borderRadius: 99,
            background: playing ? "#E07B2A" : "rgba(26,18,8,0.15)",
            height: playing ? undefined : `${wvHeights[i]}px`,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export function GemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast, toggleSaved, isSaved } = useApp();
  const C = useColors();
  const { doCheckin, gemStates, visitedGemIds, allGems } = useGame();

  const gem = allGems.find((g) => g.id === Number(id));
  const isVisited = gem ? visitedGemIds.has(gem.id) : false;
  const saved = gem ? isSaved(gem.id) : false;

  const [tab, setTab] = useState<Tab>("About");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);          // 0–100
  const [speed, setSpeed] = useState<"1×" | "1.5×" | "2×">("1×");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Live Weather
  useEffect(() => {
    fetchLiveWeather().then(w => {
      if (w) setWeatherCondition(w.condition);
    });
  }, []);

  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkinStage, setCheckinStage] = useState<"idle" | "gps_fetching" | "distance_checking" | "minting" | "success" | "dormant_error" | "drift_error">("idle");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [realDistance, setRealDistance] = useState<number | null>(null);
  const [mintedPoints, setMintedPoints] = useState(0);

  // Simulate playback progress
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) { setPlaying(false); return 0; }
          return p + 0.5;
        });
      }, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const liveGemState = gem ? gemStates.get(gem.id) : null;
  const liveBloomStatus = liveGemState
    ? (liveGemState.bloomCapacity >= 91 ? "Dormant" : liveGemState.bloomCapacity >= 71 ? "Critical" : liveGemState.bloomCapacity >= 41 ? "Fading" : "Active")
    : gem?.bloomStatus ?? "Active";

  const handleTapCheckin = () => {
    setCheckinModalOpen(true);
    setCheckinStage("idle");
    setGpsError(null);
    setRealDistance(null);
  };

  const startVerification = () => {
    if (!gem) return;
    setCheckinStage("gps_fetching");
    setGpsError(null);

    // 1. Get REAL user GPS coordinates via browser API
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setCheckinStage("drift_error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const accuracy = position.coords.accuracy; // metres

        setCheckinStage("distance_checking");

        // 2. Perform check-in with REAL coordinates after a brief animation
        setTimeout(() => {
          // Check bloom first for better UX
          if (liveBloomStatus === "Dormant") {
            setCheckinStage("dormant_error");
            return;
          }

          // 3. Call the real check-in engine with real user coordinates
          setCheckinStage("minting");
          setTimeout(async () => {
            const res = await doCheckin(gem.id, "gps", userCoords, accuracy);
            if (res.valid) {
              setMintedPoints(res.pointsAwarded ?? gem.points);
              setRealDistance(null);
              setCheckinStage("success");
              import("canvas-confetti").then((confetti) => {
                confetti.default({
                  particleCount: 150,
                  spread: 80,
                  origin: { y: 0.6 },
                  colors: ['#E07B2A', '#D9C1A0', '#4A6B62']
                });
              });
            } else {
              // If rejected due to distance, show the distance in drift_error
              const distMatch = res.reason?.match(/\((\d+)m\)/);
              if (distMatch) {
                setRealDistance(parseInt(distMatch[1], 10));
              }
              if (res.reason?.includes("Too far")) {
                setCheckinStage("drift_error");
              } else {
                addToast("warning", res.reason ?? "Verification failed.");
                setCheckinStage("idle");
              }
            }
          }, 1200);
        }, 1000);
      },
      (err) => {
        // GPS error — permission denied, unavailable, or timeout
        const messages: Record<number, string> = {
          1: "Location permission denied. Please enable location access in your browser settings.",
          2: "Location unavailable. Please check your GPS signal.",
          3: "Location request timed out. Please try again.",
        };
        setGpsError(messages[err.code] || "Could not get your location.");
        setCheckinStage("drift_error");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  if (!gem) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span style={{ fontSize: 48 }}>🔍</span>
        <p className="font-playfair" style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>Gem not found</p>
        <button onClick={() => navigate(-1)} className="font-dm pressable"
          style={{ background: "#E07B2A", color: "#fff", border: "none", borderRadius: 99, padding: "10px 24px", cursor: "pointer", fontWeight: 600 }}>
          ← Go Back
        </button>
      </div>
    );
  }

  const safetyColor = gem.safety >= 4 ? "#16a34a" : gem.safety >= 3 ? "#d97706" : "#dc2626";
  const safetyBg = gem.safety >= 4 ? "rgba(22,163,74,0.08)" : gem.safety >= 3 ? "rgba(217,119,6,0.08)" : "rgba(220,38,38,0.08)";
  const bloomColor = getBloomColor(gem.bloomStatus);
  const totalSeconds = parseInt(gem.audioDuration) * 60;
  const elapsed = Math.floor((progress / 100) * totalSeconds);
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;
  const durationMin = parseInt(gem.audioDuration);

  return (
    <div className="animate-fade-up flex flex-col gap-0 -mx-4 lg:-mx-8 -mt-7" style={{ background: C.bg, minHeight: "100%" }}>
      {/* Hero */}
      <div className="relative" style={{ height: 240, background: gem.gradient, overflow: "hidden" }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} className="absolute top-5 left-4 z-10 flex items-center justify-center pressable"
          style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", color: "#fff", fontSize: 18 }}>
          ←
        </button>

        {/* Bookmark */}
        <button
          onClick={() => { toggleSaved(gem.id); addToast("success", saved ? `Removed from collections` : `💾 Saved to Collections`); }}
          className="absolute top-5 right-4 z-10 flex items-center justify-center pressable"
          style={{ width: 38, height: 38, borderRadius: "50%", background: saved ? "rgba(224,123,42,0.8)" : "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", color: "#fff", fontSize: 18 }}
        >
          {saved ? "🔖" : "🏷️"}
        </button>

        {/* Rarity tier badge */}
        <div className="font-dm absolute top-5 z-10" style={{ left: 58 }}>
          <div style={{ background: gem.rarityBg, backdropFilter: "blur(8px)", color: gem.rarityTierColor, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: `1px solid ${gem.rarityTierColor}33`, display: "inline-block" }}>
            {gem.rarityTier === "Legendary" ? "⭐ " : gem.rarityTier === "Epic" ? "💜 " : gem.rarityTier === "Rare" ? "💎 " : gem.rarityTier === "Uncommon" ? "🟢 " : ""}
            {gem.rarityTier} · {gem.rarityScore}/100
          </div>
        </div>

        {/* Bloom status */}
        {isVisited && (
          <div className="font-dm absolute top-14 z-10" style={{ left: 58 }}>
            <div style={{ background: `${bloomColor}22`, backdropFilter: "blur(8px)", color: bloomColor, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, border: `1px solid ${bloomColor}44`, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className={gem.bloomStatus === "Fading" ? "bloom-fading" : gem.bloomStatus === "Critical" ? "bloom-critical" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: bloomColor, display: "inline-block" }} />
              {gem.bloomStatus}
            </div>
          </div>
        )}

        {/* Image / Emoji */}
        {gem.image ? (
          <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 64 }}>
            {gem.emoji}
          </div>
        )}
        
        {/* Gradient Overlay for Text Visibility */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.8) 100%)" }} />

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-10">
          <h1 className="font-playfair" style={{ color: "#fff", fontSize: 26, fontWeight: 700, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{gem.name}</h1>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex rounded-none" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex-1 flex flex-col items-center py-4" style={{ borderRight: `1px solid ${C.border}`, background: C.card }}>
          <span className="font-playfair" style={{ color: "#E07B2A", fontSize: 26, fontWeight: 700 }}>+{gem.points}</span>
          <span className="font-dm" style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Points</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-4" style={{ borderRight: `1px solid ${C.border}`, background: C.card }}>
          <span className="font-playfair" style={{ color: "#C9921F", fontSize: 26, fontWeight: 700 }}>⭐ {gem.rating}</span>
          <span className="font-dm" style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Rating</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-4" style={{ background: C.card }}>
          <span className="font-playfair" style={{ color: gem.rarityTierColor, fontSize: 22, fontWeight: 700 }}>{gem.rarityScore}</span>
          <span className="font-dm" style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>Rarity</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex" style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        {(["About", "Audio Walk", "Reviews"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="font-dm flex-1 py-3 relative"
            style={{ background: "none", border: "none", color: tab === t ? "#E07B2A" : C.muted, fontWeight: tab === t ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
            {t === "Audio Walk" ? "🎧 " : t === "Reviews" ? "💬 " : "📖 "}{t}
            {tab === t && <span className="absolute bottom-0 left-1/2" style={{ transform: "translateX(-50%)", height: 2, width: 40, background: "#E07B2A", borderRadius: 99 }} />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-5 pt-5 pb-8 flex flex-col gap-5">

        {/* ── ABOUT TAB ── */}
        {tab === "About" && (
          <>
            {/* Info grid */}
            <div className="rounded-[20px] p-5 flex flex-col gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <InfoRow icon="📍" label={gem.location} />
              <InfoRow icon="🏷️" label={gem.category} pill />
              <InfoRow icon="📡" label={gem.digipinCode} mono />
              <InfoRow icon="🚶" label={`${gem.distance} from you`} />
              {weatherCondition && gem.weatherProfile && (
                <InfoRow 
                  icon={getWeatherMatchReason(gem.weatherProfile.type, weatherCondition).match ? "✅" : "⚠️"} 
                  label={getWeatherMatchReason(gem.weatherProfile.type, weatherCondition).reason} 
                  highlight={getWeatherMatchReason(gem.weatherProfile.type, weatherCondition).match}
                />
              )}
              {/* Bloom */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 16, flexShrink: 0 }}>🔥</span>
                <div className="flex items-center gap-2">
                  <span className={gem.bloomStatus === "Fading" ? "bloom-fading" : gem.bloomStatus === "Critical" ? "bloom-critical" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: bloomColor, display: "inline-block" }} />
                  <span className="font-dm" style={{ color: C.text, fontSize: 14 }}>
                    {gem.bloomStatus} — {gem.bloomCapacity}% capacity
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-[20px] p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <h3 className="font-playfair mb-2" style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>About this place</h3>
              <p className="font-dm mb-4" style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{gem.description}</p>
              {gem.googleMapLink && (
                <button
                  onClick={() => window.open(gem.googleMapLink, "_blank")}
                  className="font-dm pressable flex items-center justify-center gap-2 w-full"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    background: "transparent",
                    color: "#3b82f6",
                    fontWeight: 700,
                    fontSize: 14,
                    border: `1px solid #3b82f6`,
                    cursor: "pointer",
                  }}
                >
                  <span>🗺️</span> Open in Google Maps
                </button>
              )}
            </div>

            {/* Safety */}
            <div className="rounded-[16px] px-4 py-3 flex items-center gap-3" style={{ background: safetyBg, border: `1px solid ${safetyColor}22` }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🛡️</span>
              <div className="flex-1">
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map((s) => (
                    <div key={s} style={{ width: "18%", height: 4, borderRadius: 99, background: s <= gem.safety ? safetyColor : "rgba(0,0,0,0.1)" }} />
                  ))}
                </div>
                <p className="font-dm" style={{ color: safetyColor, fontSize: 12, fontWeight: 600 }}>{gem.safetyNote}</p>
              </div>
            </div>

            {/* CTA */}
            <button
              className="font-dm pressable w-full flex items-center justify-center gap-3"
              style={{ height: 54, borderRadius: 99, background: isVisited ? "rgba(22,163,74,0.12)" : "#E07B2A", color: isVisited ? "#16a34a" : "#fff", fontWeight: 700, fontSize: 16, border: isVisited ? "1.5px solid rgba(22,163,74,0.3)" : "none", cursor: "pointer", boxShadow: isVisited ? "none" : "0 6px 20px rgba(224,123,42,0.3)" }}
              onClick={handleTapCheckin}
            >
              <span style={{ fontSize: 20 }}>{isVisited ? "✅" : "📍"}</span>
              {isVisited ? "Already Visited · Tap to Check In Again" : "Tap to Check In"}
            </button>
          </>
        )}

        {/* ── AUDIO WALK TAB ── */}
        {tab === "Audio Walk" && (
          !isVisited ? (
            <div className="rounded-[24px] p-6 flex flex-col items-center justify-center text-center gap-6"
              style={{
                background: "linear-gradient(to bottom, #071A1A, #0E2929)",
                border: "1.5px dashed rgba(201, 146, 31, 0.4)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                position: "relative",
                overflow: "hidden",
                paddingTop: 40,
                paddingBottom: 40,
              }}
            >
              {/* Decorative radial glow */}
              <div style={{
                position: "absolute",
                top: "-20%",
                width: "60%",
                height: "60%",
                background: "radial-gradient(circle, rgba(224, 123, 42, 0.15) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              {/* Pulsing Lock Icon */}
              <div className="animate-pulse flex items-center justify-center rounded-full"
                style={{
                  width: 80,
                  height: 80,
                  background: "rgba(224, 123, 42, 0.08)",
                  border: "2px solid #C9921F",
                  boxShadow: "0 0 20px rgba(201, 146, 31, 0.2)",
                  fontSize: 36,
                }}
              >
                🔒
              </div>

              {/* Text Context */}
              <div className="flex flex-col gap-2 max-w-[340px]">
                <h3 className="font-playfair" style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: "0.02em" }}>
                  Heritage Walk Story Locked
                </h3>
                <p className="font-dm" style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 13, lineHeight: 1.6 }}>
                  To protect the economic authenticity of local artisan backstories, the storytelling of <strong style={{ color: "#E07B2A" }}>{gem.audioArtisan}</strong> is exclusive to physical visitors.
                </p>
              </div>

              {/* Exclusive perks list */}
              <div className="w-full flex flex-col gap-3.5 my-2 p-4 rounded-[16px]" style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)", textAlign: "left" }}>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 16 }}>🗣️</span>
                  <div>
                    <h4 className="font-dm" style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Artisan Audio Backstory</h4>
                    <p className="font-dm" style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Listen to the master craftsmen's own raw narration of their heritage.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 16 }}>📍</span>
                  <div>
                    <h4 className="font-dm" style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Curation & Walking Route</h4>
                    <p className="font-dm" style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Follow direct GPS-cued pathways through historical local lanes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 16 }}>🪙</span>
                  <div>
                    <h4 className="font-dm" style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Mint Points & XP Rewards</h4>
                    <p className="font-dm" style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Verify presence to claim high-value points for real vouchers.</p>
                  </div>
                </div>
              </div>

              {/* Action button */}
              <button
                className="font-dm pressable w-full flex items-center justify-center gap-2"
                style={{
                  height: 50,
                  borderRadius: 99,
                  background: "linear-gradient(135deg, #E07B2A, #C9921F)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(224,123,42,0.3)"
                }}
                onClick={handleTapCheckin}
              >
                <span>📍</span> Check In to Unlock Backstory
              </button>
            </div>
          ) : (
            <>
              {/* Artisan card */}
              <div className="rounded-[24px] p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, #0F3D3D, #1a5252)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 60, height: 60, background: gem.gradient, fontSize: 26, border: "2.5px solid rgba(255,255,255,0.2)" }}>
                  {gem.emoji}
                </div>
                <div>
                  <p className="font-dm" style={{ color: "#E07B2A", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your Narrator</p>
                  <p className="font-playfair" style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>{gem.audioArtisan}</p>
                  <p className="font-dm" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{gem.audioCraft}</p>
                </div>
              </div>

              {/* Walk info pills */}
              <div className="flex gap-2 flex-wrap">
                <span className="font-dm" style={{ background: "rgba(224,123,42,0.1)", color: "#E07B2A", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(224,123,42,0.2)" }}>
                  🎧 {gem.audioDuration}
                </span>
                <span className="font-dm" style={{ background: "rgba(15,61,61,0.08)", color: "#0F3D3D", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 99 }}>
                  🗣️ Artisan Narrated
                </span>
                <span className="font-dm" style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 99 }}>
                  🚶 Walking Route
                </span>
              </div>

              {/* Player card */}
              <div className="rounded-[24px] p-5 flex flex-col gap-4" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(26,18,8,0.06)" }}>
                {/* Waveform */}
                <Waveform playing={playing} />

                {/* Progress bar */}
                <div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: C.cardAlt }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "#E07B2A", borderRadius: 99, transition: "width 0.15s linear" }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="font-dm" style={{ color: C.muted, fontSize: 11 }}>
                      {String(elapsedMin).padStart(2,"0")}:{String(elapsedSec).padStart(2,"0")}
                    </span>
                    <span className="font-dm" style={{ color: C.muted, fontSize: 11 }}>
                      {String(durationMin).padStart(2,"0")}:00
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  {/* Speed toggle */}
                  <button
                    onClick={() => setSpeed(s => s === "1×" ? "1.5×" : s === "1.5×" ? "2×" : "1×")}
                    className="font-dm pressable"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 99, padding: "6px 12px", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {speed}
                  </button>

                  {/* 15s back */}
                  <button
                    onClick={() => setProgress(p => Math.max(0, p - (15 / (totalSeconds / 100))))}
                    className="pressable flex items-center justify-center"
                    style={{ width: 42, height: 42, borderRadius: "50%", background: C.cardAlt, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 16 }}
                  >
                    ⏮
                  </button>

                  {/* Play/Pause */}
                  <button
                    onClick={() => setPlaying(p => !p)}
                    className="pressable flex items-center justify-center"
                    style={{ width: 60, height: 60, borderRadius: "50%", background: "#E07B2A", border: "none", cursor: "pointer", fontSize: 24, boxShadow: "0 6px 20px rgba(224,123,42,0.35)", color: "#fff" }}
                  >
                    {playing ? "⏸" : "▶"}
                  </button>

                  {/* 15s forward */}
                  <button
                    onClick={() => setProgress(p => Math.min(100, p + (15 / (totalSeconds / 100))))}
                    className="pressable flex items-center justify-center"
                    style={{ width: 42, height: 42, borderRadius: "50%", background: C.cardAlt, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 16 }}
                  >
                    ⏭
                  </button>

                  {/* Share stub */}
                  <button
                    className="pressable flex items-center justify-center"
                    style={{ width: 42, height: 42, borderRadius: "50%", background: C.cardAlt, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 16 }}
                  >
                    ↗
                  </button>
                </div>
              </div>

              {/* Transcript */}
              <div className="rounded-[20px] overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <button
                  onClick={() => setTranscriptOpen(o => !o)}
                  className="font-dm w-full flex items-center justify-between px-5 py-4"
                  style={{ background: C.card, border: "none", cursor: "pointer", color: C.text, fontWeight: 600, fontSize: 14 }}
                >
                  <span>📜 Transcript</span>
                  <span style={{ fontSize: 18, transition: "transform 0.22s", display: "inline-block", transform: transcriptOpen ? "rotate(180deg)" : "none" }}>⌄</span>
                </button>
                {transcriptOpen && (
                  <div className="px-5 pb-5" style={{ background: C.card }}>
                    <p className="font-dm" style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, fontStyle: "italic" }}>
                      {gem.audioTranscript}
                    </p>
                  </div>
                )}
              </div>

              {/* Walking route card */}
              <div className="rounded-[20px] p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <h3 className="font-playfair mb-2" style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>🗺️ Walking Route</h3>
                <p className="font-dm mb-3" style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                  This audio walk guides you through {gem.distance} of {gem.location}, ending at the main gem location. Follow the audio cues to navigate.
                </p>
                <button
                  className="font-dm pressable"
                  style={{ background: "#0F3D3D", color: "#E07B2A", border: "none", borderRadius: 99, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 14px rgba(15,61,61,0.2)" }}
                  onClick={() => window.open(`https://maps.google.com/?q=${gem.location}+Mysuru`, "_blank")}
                >
                  Open in Maps →
                </button>
              </div>
            </>
          )
        )}

        {/* ── REVIEWS TAB ── */}
        {tab === "Reviews" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-playfair" style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Community Reviews</h2>
              <span className="font-playfair" style={{ color: "#C9921F", fontWeight: 700, fontSize: 22 }}>⭐ {gem.rating}</span>
            </div>
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="gem-card rounded-[20px] p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 38, height: 38, background: r.avatarBg, fontSize: 18 }}>
                      {r.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-dm" style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{r.name}</p>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map((s) => <span key={s} style={{ fontSize: 11 }}>{s <= r.rating ? "⭐" : "☆"}</span>)}</div>
                    </div>
                  </div>
                  <p className="font-dm" style={{ color: C.muted, fontSize: 13, lineHeight: 1.6 }}>{r.text}</p>
                </div>
              ))}
            </div>

            {/* Scan CTA */}
            <button
              className="font-dm pressable w-full flex items-center justify-center gap-3"
              style={{ height: 54, borderRadius: 99, background: isVisited ? "rgba(22,163,74,0.12)" : "#E07B2A", color: isVisited ? "#16a34a" : "#fff", fontWeight: 700, fontSize: 16, border: isVisited ? "1.5px solid rgba(22,163,74,0.3)" : "none", cursor: "pointer", boxShadow: isVisited ? "none" : "0 6px 20px rgba(224,123,42,0.3)" }}
              onClick={handleTapCheckin}
            >
              <span style={{ fontSize: 20 }}>{isVisited ? "✅" : "📍"}</span>
              {isVisited ? "Already Visited · Tap to Check In Again" : "Tap to Check In"}
            </button>
          </>
        )}
      </div>

      {/* ── CHECK-IN VALIDATION MODAL ── */}
      {checkinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{
            background: "rgba(10, 26, 26, 0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            className="w-full max-w-[420px] rounded-[28px] overflow-hidden flex flex-col gap-0 border animate-scale-up"
            style={{
              background: "#0E2929",
              borderColor: "rgba(224, 123, 42, 0.15)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
              <span className="font-playfair text-[18px] font-bold text-white flex items-center gap-2">
                🧭 Check-In Engine
              </span>
              <button
                onClick={() => setCheckinModalOpen(false)}
                className="pressable flex items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 flex flex-col items-center gap-5">

              {/* 1. IDLE STAGE */}
              {checkinStage === "idle" && (
                <div className="w-full flex flex-col items-center gap-5">
                  <div
                    className="flex items-center justify-center rounded-full animate-bounce"
                    style={{
                      width: 72,
                      height: 72,
                      background: "rgba(224, 123, 42, 0.08)",
                      border: "1.5px solid rgba(224, 123, 42, 0.3)",
                      fontSize: 32,
                    }}
                  >
                    📍
                  </div>
                  
                  <div className="text-center flex flex-col gap-1.5">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      Verify Your Presence
                    </h4>
                    <p className="font-dm text-[12px]" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                      HADI will use your device GPS to verify you're near this gem. You must be within <strong style={{ color: "#E07B2A" }}>250 meters</strong> of the location.
                    </p>
                  </div>

                  {/* Location info */}
                  <div className="w-full flex flex-col gap-2.5 p-4 rounded-[20px]" style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <p className="font-dm text-[11px] font-bold uppercase tracking-wider" style={{ color: "#E07B2A" }}>
                      📍 Gem Location
                    </p>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 22 }}>{gem.emoji}</span>
                      <div>
                        <p className="font-dm text-[13px] font-bold text-white">{gem.name}</p>
                        <p className="font-dm text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{gem.location}, Mysuru</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full flex flex-col gap-2">
                    <button
                      className="font-dm w-full flex items-center justify-center gap-2 pressable font-bold"
                      style={{
                        height: 48,
                        borderRadius: 14,
                        background: "linear-gradient(135deg, #E07B2A, #C9921F)",
                        color: "#fff",
                        border: "none",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                      onClick={startVerification}
                    >
                      <span>🛰️</span> Start GPS Verification
                    </button>
                    <button
                      className="font-dm w-full flex items-center justify-center gap-2 pressable font-semibold"
                      style={{
                        height: 48,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.8)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setCheckinModalOpen(false);
                        navigate("/qrscan", { state: { gemId: gem.id, gemName: gem.name, gemPoints: gem.points } });
                      }}
                    >
                      <span>📷</span> Scan QR Code Instead
                    </button>
                  </div>
                </div>
              )}

              {/* 2. GPS FETCHING STAGE */}
              {checkinStage === "gps_fetching" && (
                <div className="w-full flex flex-col items-center py-6 gap-6">
                  {/* Glowing spinning radar animation */}
                  <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#E07B2A] animate-spin" style={{ animationDuration: "10s" }} />
                    <div className="absolute inset-2 rounded-full border border-dashed border-[#C9921F] animate-spin" style={{ animationDuration: "6s", animationDirection: "reverse" }} />
                    <div className="absolute inset-4 rounded-full bg-[rgba(224,123,42,0.08)] flex items-center justify-center" style={{ width: 68, height: 68, boxShadow: "0 0 20px rgba(224,123,42,0.2)" }}>
                      <span className="animate-pulse" style={{ fontSize: 24 }}>🛰️</span>
                    </div>
                  </div>

                  <div className="text-center flex flex-col gap-1.5">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      Locking GPS Coordinates...
                    </h4>
                    <p className="font-dm text-[12px]" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                      Acquiring raw satellite signals to verify local heritage proximity. Please hold still...
                    </p>
                  </div>
                </div>
              )}

              {/* 3. DISTANCE CHECKING STAGE */}
              {checkinStage === "distance_checking" && (
                <div className="w-full flex flex-col items-center py-6 gap-6">
                  <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                    <div className="absolute inset-0 rounded-full border border-[#C9921F] opacity-25 animate-ping" />
                    <div className="absolute inset-4 rounded-full bg-[rgba(201,146,31,0.08)] border border-[#C9921F] flex items-center justify-center" style={{ width: 68, height: 68 }}>
                      <span style={{ fontSize: 24 }}>📐</span>
                    </div>
                  </div>

                  <div className="text-center flex flex-col gap-1.5">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      Haversine Curvature Check
                    </h4>
                    <p className="font-dm text-[12px]" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                      Computing exact geodesic distance between live device coordinates and the Gem node...
                    </p>
                  </div>
                </div>
              )}

              {/* 4. MINTING STAGE */}
              {checkinStage === "minting" && (
                <div className="w-full flex flex-col items-center py-6 gap-6">
                  <div className="relative flex items-center justify-center animate-bounce" style={{ width: 100, height: 100 }}>
                    <div className="absolute inset-0 rounded-full bg-[rgba(224,123,42,0.12)] border border-[#E07B2A] flex items-center justify-center">
                      <span style={{ fontSize: 40 }}>🪙</span>
                    </div>
                  </div>

                  <div className="text-center flex flex-col gap-1.5">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      Minting Points & XP...
                    </h4>
                    <p className="font-dm text-[12px]" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                      Proximity verified! Generating secure transaction records and applying game multipliers...
                    </p>
                  </div>
                </div>
              )}

              {/* 5. SUCCESS STAGE */}
              {checkinStage === "success" && (
                <div className="w-full flex flex-col items-center gap-5 text-center">
                  <div
                    className="flex items-center justify-center rounded-full bg-[rgba(34,197,94,0.1)] border-2 border-[#22c55e]"
                    style={{
                      width: 80,
                      height: 80,
                      boxShadow: "0 0 24px rgba(34,197,94,0.25)",
                      fontSize: 40,
                    }}
                  >
                    🎉
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h4 className="font-playfair text-[20px] font-bold text-white">
                      Check-In Verified!
                    </h4>
                    <p className="font-dm text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Successfully minted <strong style={{ color: "#E07B2A" }}>+{mintedPoints} pts</strong> &amp; XP!
                    </p>
                  </div>

                  {/* Multiplier breakdown feedback */}
                  <div className="w-full p-4 rounded-2xl flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex justify-between font-dm text-[12px]">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Base Score:</span>
                      <span style={{ color: "#fff", fontWeight: 600 }}>{gem.points} pts</span>
                    </div>
                    <div className="flex justify-between font-dm text-[12px]">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Bloom Multiplier:</span>
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>Active (1.0×)</span>
                    </div>
                    <div className="flex justify-between font-dm text-[12px]">
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Proximity Bonus:</span>
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>
                        GPS Verified ✓
                      </span>
                    </div>
                  </div>

                  <button
                    className="font-dm w-full flex items-center justify-center gap-2 pressable font-bold"
                    style={{
                      height: 48,
                      borderRadius: 14,
                      background: "#22c55e",
                      color: "#fff",
                      border: "none",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setCheckinModalOpen(false);
                      setTab("Audio Walk");
                    }}
                  >
                    <span>🎧</span> Listen to Audio Story
                  </button>
                </div>
              )}

              {/* 6. DORMANT / OVERCROWDING ERROR STAGE */}
              {checkinStage === "dormant_error" && (
                <div className="w-full flex flex-col items-center gap-5 text-center">
                  <div
                    className="flex items-center justify-center rounded-full bg-[rgba(220,38,38,0.1)] border-2 border-[#dc2626]"
                    style={{
                      width: 80,
                      height: 80,
                      boxShadow: "0 0 24px rgba(220,38,38,0.25)",
                      fontSize: 40,
                    }}
                  >
                    ⚫
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      Location Overcrowded
                    </h4>
                    <p className="font-dm text-[13px] font-bold uppercase tracking-wider" style={{ color: "#dc2626" }}>
                      Bloom Overcapacity (⚫ Dormant)
                    </p>
                    <p className="font-dm text-[13px]" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                      To protect Mysuru’s delicate heritage and prevent overcrowding, check-ins at this location are temporarily dormant. Points will bloom again soon!
                    </p>
                  </div>

                  <button
                    className="font-dm w-full flex items-center justify-center gap-2 pressable font-bold"
                    style={{
                      height: 48,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                    onClick={() => setCheckinStage("idle")}
                  >
                    ← Back to Simulator
                  </button>
                </div>
              )}

              {/* 7. GPS DRIFT ERROR STAGE (FAILSAFE TRIGGER) */}
              {checkinStage === "drift_error" && (
                <div className="w-full flex flex-col items-center gap-5 text-center">
                  <div
                    className="flex items-center justify-center rounded-full bg-[rgba(217,119,6,0.1)] border-2 border-[#d97706]"
                    style={{
                      width: 80,
                      height: 80,
                      boxShadow: "0 0 24px rgba(217,119,6,0.25)",
                      fontSize: 40,
                    }}
                  >
                    {gpsError ? "📡" : "📐"}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="font-playfair text-[18px] font-bold text-white">
                      {gpsError ? "GPS Error" : "Too Far From Gem"}
                    </h4>
                    <p className="font-dm text-[13px]" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                      {gpsError 
                        ? gpsError 
                        : <>You are <strong style={{ color: "#d97706" }}>{realDistance ? `${realDistance} meters` : "more than 250m"}</strong> away from this gem. Move closer or use the QR code option below.</>
                      }
                    </p>
                  </div>

                  <div className="w-full p-4 rounded-2xl flex flex-col gap-1.5" style={{ background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.15)", textTransform: "none", textAlign: "left" }}>
                    <p className="font-dm text-[12px] font-bold text-white">
                      🛡️ Alternative Verification:
                    </p>
                    <p className="font-dm text-[11px]" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                      Scan the HADI QR sticker placed at the venue to verify your check-in without GPS.
                    </p>
                  </div>

                  <div className="w-full flex flex-col gap-2">
                    <button
                      className="font-dm w-full flex items-center justify-center gap-2 pressable font-bold"
                      style={{
                        height: 48,
                        borderRadius: 14,
                        background: "linear-gradient(135deg, #E07B2A, #C9921F)",
                        color: "#fff",
                        border: "none",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setCheckinModalOpen(false);
                        navigate("/qrscan", { state: { gemId: gem.id, gemName: gem.name, gemPoints: gem.points } });
                      }}
                    >
                      📷 Scan QR Code Instead
                    </button>
                    <button
                      className="font-dm w-full flex items-center justify-center gap-2 pressable"
                      style={{
                        height: 48,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                      onClick={() => setCheckinStage("idle")}
                    >
                      🛰️ Try GPS Again
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, pill, mono, highlight }: { icon: string; label: string; pill?: boolean; mono?: boolean; highlight?: boolean }) {
  const C = useColors();
  return (
    <div className="flex items-center gap-3">
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span className={mono ? "font-mono" : "font-dm"}
        style={{
          color: highlight ? "#4ade80" : C.text,
          fontSize: 14,
          fontWeight: highlight ? 700 : (pill || mono ? 600 : 400),
          background: pill ? C.cardAlt : (mono ? "rgba(224,123,42,0.1)" : "transparent"),
          padding: pill || mono ? "3px 10px" : 0,
          borderRadius: 99,
          border: pill ? `1px solid ${C.borderStrong}` : (mono ? "1px solid rgba(224,123,42,0.3)" : "none")
        }}>
        {label}
      </span>
    </div>
  );
}