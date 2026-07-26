import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useApp, useColors } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { useAuth } from "../../context/AuthContext";
import { LEVELS as ENGINE_LEVELS, BADGE_DEFS } from "../../engine/points";
import { SeedData } from "../dev/SeedData";

type ProfileTab = "Achievements" | "My Gems" | "Collections" | "Activity";

const LEVELS = ENGINE_LEVELS.map((l) => ({ name: l.name, icon: l.icon, min: l.minXP, max: l.maxXP }));

const BADGE_GRADIENTS: Record<string, string> = {
  first_step:      "linear-gradient(135deg, #C9921F, #d97706)",
  ten_gems:        "linear-gradient(135deg, #7c3aed, #ec4899)",
  streak_seeker:   "linear-gradient(135deg, #dc2626, #f97316)",
  zone_master:     "linear-gradient(135deg, #0F3D3D, #1a5c5c)",
  community_voice: "linear-gradient(135deg, #0F3D3D, #059669)",
  buddy_explorer:  "linear-gradient(135deg, #1d4ed8, #06b6d4)",
  gem_smith:       "linear-gradient(135deg, #92400e, #d97706)",
  local_sage:      "linear-gradient(135deg, #065f46, #059669)",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function Profile() {
  const navigate = useNavigate();
  const C = useColors();
  const { darkMode, toggleDarkMode, localMode, toggleLocalMode, savedGems, toggleSaved, savedPlaces, toggleSavedPlace, userName, setUserName, addToast } = useApp();
  const { signOut, user, sendVerificationEmail, updateUserEmail } = useAuth();
  const { stats, levelInfo, unlockedBadges, activityLog, visitedGemIds, activateLocalMode, localModeEligibility, leaderboard, allGems, allPlaces } = useGame();

  const [activeTab, setActiveTab] = useState<ProfileTab>("Achievements");
  const [displayName, setDisplayName] = useState(() => userName || "Explorer");
  const [fullName, setFullName] = useState(() => user?.displayName ?? "Explorer");
  const [email, setEmail] = useState(() => user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [homeCity, setHomeCity] = useState("Mysuru, India");
  const [role, setRole] = useState("Tourist");
  const [interests, setInterests] = useState("Heritage, Art, Food");
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem("hadi_avatar") || "🧑");
  const [profileBanner, setProfileBanner] = useState(() => localStorage.getItem("hadi_banner") || "");
  const [showEditModal, setShowEditModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Keep displayName in sync with the shared userName (e.g. first load from localStorage)
  useEffect(() => { if (userName) setDisplayName(userName); }, [userName]);

  const myGems = allGems.filter((g) => visitedGemIds.has(g.id)).slice(0, 6);
  const collectionGems = allGems.filter((g) => savedGems.has(g.id));
  const collectionPlaces = allPlaces.filter((p) => savedPlaces.has(p.id));
  const totalSaved = collectionGems.length + collectionPlaces.length;

  const { level, progress, ptsToNext, nextLevel: next } = levelInfo;
  const levelIndex = level.index;

  return (
    <div className="animate-fade-up flex flex-col gap-6">

      {/* Local Mode Banner */}
      {localMode && (
        <div className="rounded-[16px] px-4 py-3 flex items-center gap-3" style={{ background: "rgba(15,61,61,0.1)", border: "1.5px solid rgba(15,61,61,0.2)" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🛡️</span>
          <p className="font-dm flex-1" style={{ color: "#0F3D3D", fontSize: 13, fontWeight: 600 }}>
            Local Mode Active — You're helping keep Mysuru safe.
          </p>
        </div>
      )}
      
      {/* Dev Tools (Temporary for Phase 2) */}
      <SeedData />

      {/* Profile Header */}
      <div className="rounded-[28px] overflow-hidden relative" style={{ 
        background: profileBanner ? `url(${profileBanner}) center/cover no-repeat` : "linear-gradient(135deg, #0F3D3D 0%, #0A2A2A 100%)",
      }}>
        {!profileBanner && (
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px)", backgroundSize: "11px 11px" }} />
        )}
        {/* Dark overlay for text readability if banner is set */}
        {profileBanner && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />}
        
        <div className="relative flex flex-col items-center pt-10 pb-16 px-6 text-center">
          <button onClick={() => setShowEditModal(true)} className="absolute top-4 right-4 font-dm pressable"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 99, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Edit Profile
          </button>

          <div className="flex items-center justify-center rounded-full mb-4 font-dm relative"
            style={{ width: 80, height: 80, background: "linear-gradient(135deg, #E07B2A, #C9921F)", fontSize: 32, border: "3px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 20px rgba(224,123,42,0.3)", overflow: "hidden" }}>
            {profileImage.startsWith("http") || profileImage.startsWith("data:") ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profileImage
            )}
          </div>

          <h1 className="font-playfair mb-2" style={{ color: "#fff", fontSize: 24, fontWeight: 700 }}>{displayName}</h1>

          <div className="flex items-center gap-2 mt-1">
            <span className="font-dm" style={{ background: "#E07B2A", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 99 }}>
              {level.icon} {level.name}
            </span>
            {/* Mode Toggle Chip */}
            <button
              onClick={toggleLocalMode}
              className="font-dm pressable"
              style={{ background: localMode ? "rgba(22,163,74,0.2)" : "rgba(255,255,255,0.12)", border: `1px solid ${localMode ? "rgba(22,163,74,0.4)" : "rgba(255,255,255,0.2)"}`, borderRadius: 99, padding: "4px 14px", color: localMode ? "#4ade80" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.22s" }}
            >
              {localMode ? "🏠 Local Mode" : "🧭 Tourist Mode"}
            </button>
          </div>

          {/* Local mode unlocked features */}
          {localMode && (
            <div className="mt-4 flex gap-2 flex-wrap justify-center">
              {["⚠️ Report Hazard", "📖 Submit Story", "🛡️ Zone Guardian"].map((f) => (
                <span key={f} className="font-dm" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(34,197,94,0.25)" }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-3 -mt-10 relative z-10 mx-3">
        {[{ label: "Points", value: (stats.totalXP ?? 0).toLocaleString() }, { label: "Gems", value: String(stats.allTimeGems ?? 0) }, { label: "Rank", value: `#${leaderboard.find((e) => e.userId === stats.userId)?.rank ?? "—"}` }].map((stat) => (
          <div key={stat.label} className="flex-1 rounded-[20px] p-4 flex flex-col items-center gap-1" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(26,18,8,0.09)" }}>
            <span className="font-playfair" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 22 }}>{stat.value}</span>
            <span className="font-dm" style={{ color: C.muted, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ── XP Level Progress Bar ── */}
      <div className="rounded-[20px] p-4 mx-0" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>{level.icon}</span>
            <div>
              <p className="font-playfair" style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
                {level.name}
              </p>
              <p className="font-dm" style={{ color: C.muted, fontSize: 11 }}>
                Level {levelIndex + 1} of {LEVELS.length}
              </p>
            </div>
          </div>
          {next && (
            <div className="text-right">
              <p className="font-dm" style={{ color: C.muted, fontSize: 11, fontWeight: 500 }}>Next: {next.icon} {next.name}</p>
              <p className="font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 12 }}>
                {ptsToNext.toLocaleString()} pts to go
              </p>
            </div>
          )}
          {!next && (
            <span className="font-dm" style={{ background: "rgba(201,146,31,0.12)", color: "#C9921F", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
              Max Level 🌟
            </span>
          )}
        </div>
        {/* Level progress bar */}
        <div style={{ height: 6, background: C.cardAlt, borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #E07B2A, #C9921F)",
              borderRadius: 99,
              transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="font-dm" style={{ color: C.muted, fontSize: 10 }}>{level.minXP.toLocaleString()} pts</span>
          <span className="font-dm" style={{ color: "#E07B2A", fontWeight: 600, fontSize: 10 }}>{progress}%</span>
          {next && <span className="font-dm" style={{ color: C.muted, fontSize: 10 }}>{next.minXP.toLocaleString()} pts</span>}
        </div>
        {/* Level badges row */}
        <div className="flex justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {LEVELS.map((l, i) => (
            <div key={l.name} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center justify-center rounded-full"
                style={{ width: 28, height: 28, background: i <= levelIndex ? "linear-gradient(135deg, #E07B2A, #C9921F)" : C.cardAlt, border: i === levelIndex ? "2px solid #E07B2A" : `1px solid ${C.border}`, fontSize: 13, opacity: i > levelIndex ? 0.5 : 1 }}>
                {l.icon}
              </div>
              {i === levelIndex && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#E07B2A" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex rounded-[16px] overflow-x-auto no-scrollbar" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        {(["Achievements", "My Gems", "Collections", "Activity"] as ProfileTab[]).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className="font-dm flex-1 py-3 relative"
            style={{ background: "none", border: "none", color: activeTab === t ? "#E07B2A" : C.muted, fontWeight: activeTab === t ? 700 : 400, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", minWidth: "max-content", padding: "12px 16px" }}>
            {t}
            {activeTab === t && <span className="absolute bottom-0 left-1/2" style={{ transform: "translateX(-50%)", height: 2, width: 32, background: "#E07B2A", borderRadius: 99 }} />}
          </button>
        ))}
      </div>

      {/* ── ACHIEVEMENTS TAB ── */}
      {activeTab === "Achievements" && (
        <section>
          <div className="grid grid-cols-3 gap-3">
            {BADGE_DEFS.map((b) => {
              const isUnlocked = unlockedBadges.has(b.id);
              const gradient = BADGE_GRADIENTS[b.id] ?? "linear-gradient(135deg, #C9921F, #E07B2A)";
              return (
                <div key={b.id} className="flex flex-col items-center gap-2 p-3 rounded-[20px]"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 60, height: 60, background: isUnlocked ? gradient : "rgba(156,163,175,0.12)", border: `2px solid ${isUnlocked ? "transparent" : C.border}`, fontSize: 26, filter: isUnlocked ? "none" : "grayscale(1) opacity(0.4)", boxShadow: isUnlocked ? "0 4px 16px rgba(0,0,0,0.15)" : "none" }}
                  >
                    {b.emoji}
                  </div>
                  <p className="font-dm text-center" style={{ color: isUnlocked ? C.text : C.muted, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                    {b.name}
                  </p>
                  {!isUnlocked && (
                    <p className="font-dm text-center" style={{ color: C.muted, fontSize: 9, lineHeight: 1.4, opacity: 0.7 }}>
                      {b.description}
                    </p>
                  )}
                  {isUnlocked && (
                    <span className="font-dm" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>✓ Unlocked</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── MY GEMS TAB ── */}
      {activeTab === "My Gems" && (
        <section>
          <div className="grid grid-cols-3 gap-3">
            {myGems.map((gem) => (
              <div key={gem.id} className="pressable rounded-[16px] overflow-hidden cursor-pointer relative"
                style={{ aspectRatio: "1", background: gem.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}
                onClick={() => navigate(`/gem/${gem.id}`)}>
                {gem.image ? (
                  <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                ) : null}
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-2">
                  <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{gem.emoji}</span>
                  <span className="font-dm text-center" style={{ color: "rgba(255,255,255,1)", fontSize: 10, fontWeight: 700, lineHeight: 1.2, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{gem.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── COLLECTIONS TAB ── */}
      {activeTab === "Collections" && (
        <section>
          {totalSaved === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <span style={{ fontSize: 48 }}>🔖</span>
              <p className="font-playfair" style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>No saved items yet</p>
              <p className="font-dm" style={{ color: C.muted, fontSize: 13 }}>Tap the bookmark icon on any gem or place to save it here</p>
              <button onClick={() => navigate("/places")} className="font-dm pressable"
                style={{ background: "#E07B2A", color: "#fff", border: "none", borderRadius: 99, padding: "10px 24px", cursor: "pointer", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 14px rgba(224,123,42,0.3)" }}>
                Discover Places →
              </button>
            </div>
          ) : (
            <>
              <p className="font-dm mb-4" style={{ color: C.muted, fontSize: 13 }}>{totalSaved} saved item{totalSaved !== 1 ? "s" : ""}</p>
              <div className="grid grid-cols-3 gap-3">
                {collectionGems.map((gem) => (
                  <div key={gem.id} className="relative group">
                    <div className="pressable rounded-[16px] overflow-hidden cursor-pointer relative"
                      style={{ aspectRatio: "1", background: gem.gradient, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
                      onClick={() => navigate(`/gem/${gem.id}`)}>
                      {gem.image ? (
                        <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      ) : null}
                      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                      <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-2">
                        <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{gem.emoji}</span>
                        <span className="font-dm text-center" style={{ color: "rgba(255,255,255,1)", fontSize: 10, fontWeight: 700, lineHeight: 1.2, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{gem.name}</span>
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSaved(gem.id); }}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center pressable"
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(239,68,68,0.85)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {collectionPlaces.map((place) => (
                  <div key={place.id} className="relative group">
                    <div className="pressable rounded-[16px] overflow-hidden relative"
                      style={{ aspectRatio: "1", background: place.gradient || "#0F3D3D", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}>
                      {place.image ? (
                        <img src={place.image} alt={place.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      ) : null}
                      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                      <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 p-2">
                        <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{place.emoji}</span>
                        <span className="font-dm text-center" style={{ color: "rgba(255,255,255,1)", fontSize: 10, fontWeight: 700, lineHeight: 1.2, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{place.name}</span>
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSavedPlace(place.id); }}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center pressable"
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(239,68,68,0.85)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === "Activity" && (
        <section>
          <div className="rounded-[20px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(26,18,8,0.04)" }}>
            {activityLog.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="font-dm" style={{ color: C.muted, fontSize: 13 }}>No activity yet. Check in to a gem to get started!</p>
              </div>
            )}
            {activityLog.slice(0, 20).map((act, idx) => (
              <div key={act.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: idx < Math.min(activityLog.length, 20) - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{act.emoji}</span>
                <p className="font-dm flex-1 min-w-0" style={{ color: C.text, fontSize: 13 }}>{act.text}</p>
                <div className="text-right shrink-0">
                  {act.points && <p className="font-dm" style={{ color: "#E07B2A", fontWeight: 700, fontSize: 13 }}>{act.points}</p>}
                  <p className="font-dm" style={{ color: C.muted, fontSize: 11 }}>{timeAgo(act.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Settings */}
      <section className="mb-4">
        <h2 className="font-playfair mb-4" style={{ color: C.text, fontSize: 19, fontWeight: 700 }}>Settings</h2>
        <div className="rounded-[20px] overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          {/* Mode toggle */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 20 }}>{localMode ? "🏠" : "🧭"}</span>
              <div>
                <p className="font-dm" style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                  {localMode ? "Local Mode" : "Tourist Mode"}
                </p>
                <p className="font-dm" style={{ color: C.muted, fontSize: 12 }}>
                  {localMode ? "Hazard reporting & story submission unlocked" : "Switch to unlock local features"}
                </p>
              </div>
            </div>
            <button onClick={toggleLocalMode}
              style={{ width: 52, height: 28, borderRadius: 99, background: localMode ? "#22c55e" : "rgba(26,18,8,0.15)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0, padding: 0 }}>
              <span style={{ position: "absolute", top: 4, left: localMode ? 28 : 4, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.3s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </button>
          </div>

          {/* Dark mode */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 20 }}>{darkMode ? "🌙" : "☀️"}</span>
              <div>
                <p className="font-dm" style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Dark Mode</p>
                <p className="font-dm" style={{ color: C.muted, fontSize: 12 }}>{darkMode ? "On — dark theme active" : "Off — light theme active"}</p>
              </div>
            </div>
            <button onClick={toggleDarkMode}
              style={{ width: 52, height: 28, borderRadius: 99, background: darkMode ? "#E07B2A" : "rgba(26,18,8,0.15)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0, padding: 0 }}>
              <span style={{ position: "absolute", top: 4, left: darkMode ? 28 : 4, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.3s cubic-bezier(0.22,1,0.36,1)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
            </button>
          </div>

          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <p className="font-dm" style={{ color: C.text, fontSize: 14 }}>Notifications</p>
          </div>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <p className="font-dm" style={{ color: C.text, fontSize: 14 }}>Privacy</p>
          </div>
          {/* Account info + sign out */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 20 }}>👤</span>
              <div>
                <p className="font-dm" style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>
                  Account {user && !user.emailVerified && <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 4 }}>Unverified</span>}
                </p>
                <p className="font-dm" style={{ color: C.muted, fontSize: 12 }}>{user?.email ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && !user.emailVerified && (
                <button 
                  onClick={async () => {
                    setAuthLoading(true);
                    const res = await sendVerificationEmail();
                    setAuthLoading(false);
                    if (res.ok) addToast("success", "Verification email sent! Check your inbox.");
                    else addToast("warning", "Failed to send verification email. Try again later.");
                  }} 
                  disabled={authLoading}
                  className="font-dm pressable"
                  style={{ background: "transparent", border: `1px solid ${C.borderStrong}`, borderRadius: 99, padding: "6px 12px", color: C.text, fontSize: 12, fontWeight: 600, cursor: authLoading ? "not-allowed" : "pointer" }}>
                  Verify
                </button>
              )}
              <button onClick={signOut} className="font-dm pressable"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 99, padding: "6px 14px", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* Edit Profile Dialog */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-[28px] w-full max-w-[400px] flex flex-col sheet-enter overflow-hidden" style={{ background: C.bg, maxHeight: "90vh", boxShadow: "0 12px 48px rgba(0,0,0,0.3)" }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 className="font-playfair" style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>Edit Profile</h2>
              <button onClick={() => setShowEditModal(false)} className="pressable" style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Profile Image */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center rounded-full font-dm relative"
                  style={{ width: 80, height: 80, background: "linear-gradient(135deg, #E07B2A, #C9921F)", fontSize: 32, border: `2px solid ${C.border}`, overflow: "hidden" }}>
                  {profileImage.startsWith("http") || profileImage.startsWith("data:") ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    profileImage
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Paste Avatar Image URL or Emoji"
                  value={profileImage}
                  onChange={(e) => setProfileImage(e.target.value)}
                  className="font-dm w-full text-center"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none" }}
                />
              </div>

              {/* Form Fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Banner Image URL</label>
                  <input value={profileBanner} onChange={(e) => setProfileBanner(e.target.value)} placeholder="Paste an image URL for your background banner" className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Full Name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Display Name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Phone Number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Location</label>
                  <input value={homeCity} onChange={(e) => setHomeCity(e.target.value)} className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="font-dm w-full" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none", appearance: "none" }}>
                    <option value="Tourist">Tourist / Explorer</option>
                    <option value="Local Shopkeeper (Art & Culture)">Local Shopkeeper (Art & Culture)</option>
                    <option value="Local Shopkeeper (Rare Gem)">Local Shopkeeper (Rare Gem)</option>
                    <option value="Heritage Guide">Heritage Guide</option>
                  </select>
                </div>
                <div>
                  <label className="font-dm block mb-1.5" style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Interests</label>
                  <textarea value={interests} onChange={(e) => setInterests(e.target.value)} rows={2} className="font-dm w-full resize-none" style={{ background: C.card, border: `1px solid ${C.borderStrong}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
              </div>
            </div>
            
            <div className="p-5" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={async () => {
                setAuthLoading(true);
                if (email.trim() && email.trim() !== user?.email) {
                  const res = await updateUserEmail(email.trim());
                  if (res.ok) {
                    addToast("success", "Verification email sent to new address! Please check it to confirm.");
                  } else if (res.error === "requires-recent-login") {
                    addToast("warning", "Security requirement: Please sign out and sign back in to change your email.");
                  } else {
                    addToast("warning", "Failed to update email.");
                  }
                }
                if (displayName.trim()) setUserName(displayName.trim());
                localStorage.setItem("hadi_avatar", profileImage);
                localStorage.setItem("hadi_banner", profileBanner);
                setAuthLoading(false);
                setShowEditModal(false);
              }} className="font-dm w-full pressable" disabled={authLoading}
                style={{ height: 48, borderRadius: 99, background: authLoading ? "rgba(15,61,61,0.5)" : "#0F3D3D", color: "#E07B2A", fontSize: 15, fontWeight: 700, border: "none", cursor: authLoading ? "not-allowed" : "pointer", boxShadow: "0 4px 14px rgba(15,61,61,0.2)" }}>
                {authLoading ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}