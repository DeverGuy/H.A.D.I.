import type { WeatherProfile } from "../engine/types";

export type GemRarityTier = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export type BloomStatus = "Active" | "Fading" | "Critical" | "Dormant";
export type GemCategory = "Art" | "Food" | "Stay" | "Temples" | "Crafts" | "Streets" | "Heritage" | "Nature";

export interface GemData {
  id: number;
  emoji: string;
  gradient: string;
  image?: string;
  images?: string[];
  googleMapLink?: string;
  // Legacy (kept for backward compatibility)
  rarity: string;
  rarityColor: string;
  rarityBg: string;
  // New 5-tier system
  rarityTier: GemRarityTier;
  rarityScore: number; // 1–100
  rarityBorderClass: string;
  rarityTierColor: string;
  // Bloom & Fade
  bloomStatus: BloomStatus;
  bloomCapacity: number; // 0–100
  bloomLabel: string;
  name: string;
  location: string;
  points: number;
  rating: number;
  category: GemCategory;
  weatherProfile: WeatherProfile;
  description: string;
  digipinCode: string;
  distance: string;
  safety: number;
  safetyNote: string;
  // Audio Walk
  audioArtisan: string;
  audioCraft: string;
  audioDuration: string;
  audioTranscript: string;
}

const rarityMeta: Record<GemRarityTier, { borderClass: string; color: string; bg: string }> = {
  Common:    { borderClass: "",                 color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  Uncommon:  { borderClass: "rarity-uncommon",  color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  Rare:      { borderClass: "rarity-rare",      color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  Epic:      { borderClass: "rarity-epic",      color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  Legendary: { borderClass: "rarity-legendary", color: "#C9921F", bg: "rgba(201,146,31,0.12)" },
};

const bloomMeta: Record<BloomStatus, { label: string }> = {
  Active:  { label: "Active" },
  Fading:  { label: "Fading" },
  Critical:{ label: "Critical" },
  Dormant: { label: "Dormant" },
};

function g(
  base: Omit<GemData, "rarityBorderClass" | "rarityTierColor" | "rarityBg" | "rarityColor" | "rarity" | "bloomLabel">
): GemData {
  const rm = rarityMeta[base.rarityTier];
  const bm = bloomMeta[base.bloomStatus];
  return {
    ...base,
    rarityBorderClass: rm.borderClass,
    rarityTierColor: rm.color,
    rarityBg: rm.bg,
    rarityColor: rm.color,
    rarity: base.rarityTier,
    bloomLabel: bm.label,
  };
}

import { allPlaces, type Place } from "./places";

const PROFILE_OUTDOOR_EXPOSED: WeatherProfile = {
  type: "OUTDOOR_EXPOSED",
  idealConditions: ["clear", "partly_cloudy"],
  riskConditions: ["heavy_rain", "heavy_thunderstorm"],
};

const PROFILE_OUTDOOR_SHELTERED: WeatherProfile = {
  type: "OUTDOOR_SHELTERED",
  idealConditions: ["clear", "partly_cloudy", "light_rain"],
  riskConditions: ["heavy_thunderstorm"],
};

const PROFILE_INDOOR_SAFE: WeatherProfile = {
  type: "INDOOR_SAFE",
  idealConditions: ["clear", "partly_cloudy", "light_rain", "heavy_rain", "heavy_thunderstorm"],
  riskConditions: [],
};

const detailedGems: GemData[] = [
  g({
    id: 1, emoji: "🎨",
    gradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
    rarityTier: "Epic", rarityScore: 75,
    bloomStatus: "Active", bloomCapacity: 35,
    name: "Rangoli Street Art",
    location: "Sayyaji Rao Rd", points: 120, rating: 4.8, category: "Art", weatherProfile: PROFILE_OUTDOOR_EXPOSED,
    description: "A breathtaking ephemeral art installation created fresh each dawn by local artist Gowramma. The intricate kolam patterns span the width of the lane and use only natural pigments sourced from Chamundi Hill.",
    digipinCode: "MYS-4N2K", distance: "0.4 km", safety: 5, safetyNote: "Best visited before 10 AM",
    audioArtisan: "Gowramma Devi", audioCraft: "Traditional Kolam / Rangoli",
    audioDuration: "9 min · 0.4 km walk",
    audioTranscript: "\"Every morning before the city wakes, I wake. The pigments are ground the night before — turmeric for gold, charcoal for black, sindoor for red. The lane becomes my canvas and each pattern I draw tells a story from the Puranas. This particular design, the Ashta Dala Padma, is dedicated to Chamundeshwari Devi...\"",
    image: "https://images.unsplash.com/photo-1766560359378-191334d5ecc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1766560359378-191334d5ecc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Sayyaji+Rao+Rd,Mysuru",
  }),
  g({
    id: 2, emoji: "🍛",
    gradient: "linear-gradient(135deg, #f97316, #dc2626)",
    rarityTier: "Legendary", rarityScore: 88,
    bloomStatus: "Fading", bloomCapacity: 72,
    name: "Iyer's Idli Corner",
    location: "Agrahara Lane", points: 85, rating: 4.9, category: "Food", weatherProfile: PROFILE_INDOOR_SAFE,
    description: "A 60-year-old family establishment serving just 50 plates each morning. The sambar is slow-cooked overnight and the chutney uses herbs from a private garden on Chamundi Hill. Arrive by 7 AM or miss out entirely.",
    digipinCode: "MYS-7R8P", distance: "0.7 km", safety: 5, safetyNote: "Best visited before 9 AM",
    audioArtisan: "Krishnamurthy Iyer", audioCraft: "Traditional Iyengar Cooking",
    audioDuration: "12 min · 0.7 km walk",
    audioTranscript: "\"My grandfather started this with a single wood-fired stove in 1962. We have never changed the recipe — not one gram of the sambar masala ratio. The trick is the tamarind, always from Udupi, soaked overnight in copper vessels. We grind the batter by stone, not machine. 50 plates. That is all. When it is done, we close.\"",
    image: "https://images.unsplash.com/photo-1657196118354-f25f29fe636d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1657196118354-f25f29fe636d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Agrahara+Lane,Mysuru",
  }),
  g({
    id: 3, emoji: "🛕",
    gradient: "linear-gradient(135deg, #d97706, #fbbf24)",
    rarityTier: "Epic", rarityScore: 72,
    bloomStatus: "Active", bloomCapacity: 28,
    name: "Trinesvara Temple",
    location: "Lakshmipuram", points: 200, rating: 4.7, category: "Temples", weatherProfile: PROFILE_OUTDOOR_SHELTERED,
    description: "A 300-year-old Shiva temple hidden behind residential buildings in Lakshmipuram. The intricate Hoysala stonework on the outer wall depicts scenes from the Ramayana and is rarely photographed. Local priests conduct sunrise puja at 5:30 AM.",
    digipinCode: "MYS-1F5Q", distance: "1.2 km", safety: 5, safetyNote: "Best visited before 8 AM",
    audioArtisan: "Pandit Venkatesh Shastri", audioCraft: "Agama Shastra / Temple Ritual",
    audioDuration: "14 min · 1.2 km walk",
    audioTranscript: "\"This temple has been in my family's care for eleven generations. The shivalinga here is a swayambhu — self-manifested, not carved by human hands. Each morning at 5:30 we wake the Lord with panchamrita abhisheka. The stonework around the outer wall was commissioned by the Mysore Wadiyars in 1724...\"",
    image: "https://images.unsplash.com/photo-1668948824982-37c263b8dfb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1668948824982-37c263b8dfb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Lakshmipuram,Mysuru",
  }),
  g({
    id: 4, emoji: "🧶",
    gradient: "linear-gradient(135deg, #059669, #0d9488)",
    rarityTier: "Rare", rarityScore: 62,
    bloomStatus: "Active", bloomCapacity: 40,
    name: "Channapatna Toys",
    location: "Devaraja Market", points: 150, rating: 4.6, category: "Crafts", weatherProfile: PROFILE_INDOOR_SAFE,
    description: "A third-generation family workshop tucked inside the eastern wing of Devaraja Market. The artisan uses traditional lacquer techniques passed down from his grandfather. Each toy takes 3–4 days to hand-finish.",
    digipinCode: "MYS-4N2K", distance: "1.6 km", safety: 3, safetyNote: "Best visited before 6 PM",
    audioArtisan: "Manjunath Karigar", audioCraft: "Channapatna Lacquerware",
    audioDuration: "11 min · 1.6 km walk",
    audioTranscript: "\"The wood we use is only from the Aale tree — what you call ivory wood. It absorbs the lac without cracking. My grandfather learned this from the royal court craftsmen. We were asked to supply to Hamleys London in 1998 but we refused — to mass-produce would kill the art.\"",
    image: "https://images.unsplash.com/photo-1630833835852-aa4902568d93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1630833835852-aa4902568d93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Devaraja+Market,Mysuru",
  }),
  g({
    id: 5, emoji: "🛤️",
    gradient: "linear-gradient(135deg, #64748b, #334155)",
    rarityTier: "Uncommon", rarityScore: 38,
    bloomStatus: "Dormant", bloomCapacity: 12,
    name: "Heritage Walk Lane",
    location: "Fort Area", points: 95, rating: 4.5, category: "Streets", weatherProfile: PROFILE_OUTDOOR_EXPOSED,
    description: "An untouched colonial-era street lined with 100-year-old bungalows and a surviving carriage workshop. The cobblestone path leads to a hidden courtyard with a century-old rain tree at its center.",
    digipinCode: "MYS-7R8P", distance: "2.1 km", safety: 4, safetyNote: "Best visited before 7 PM",
    audioArtisan: "Suresh Naidu", audioCraft: "Colonial Architecture & History",
    audioDuration: "18 min · 2.1 km walk",
    audioTranscript: "\"This lane was originally built for the officers of the Mysore Lancers regiment in 1892. Notice the teak-framed windows — the same carpenter family has been maintaining them for four generations. The carriage workshop at the end still has original British-era tools hanging on its walls.\"",
    image: "https://images.unsplash.com/photo-1754230048672-392f093047d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1754230048672-392f093047d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Fort+Area,Mysuru",
  }),
  g({
    id: 6, emoji: "🕌",
    gradient: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    rarityTier: "Epic", rarityScore: 68,
    bloomStatus: "Fading", bloomCapacity: 65,
    name: "Jama Masjid Backstreet",
    location: "Nazarbad", points: 180, rating: 4.6, category: "Heritage", weatherProfile: PROFILE_OUTDOOR_SHELTERED,
    description: "The narrow lane behind Jama Masjid is a living timeline of Mysuru's architectural history, from Tipu Sultan-era arched doorways to British-period wrought-iron balconies. The street hosts a weekly Sunday flea market.",
    digipinCode: "MYS-4N2K", distance: "0.3 km", safety: 4, safetyNote: "Best visited before 6 PM",
    audioArtisan: "Akbar Ali Siddiqui", audioCraft: "Indo-Saracenic Architecture",
    audioDuration: "13 min · 0.3 km walk",
    audioTranscript: "\"My family has lived on this lane for seven generations. This archway — see the pointed apex? That is pure Tipu Sultan style, built around 1790. The balcony above it is British, added in 1905. And the tile mosaic on the wall there? Portuguese craftsmen, 1840s. This one lane holds 200 years of Mysuru.\"",
    image: "https://images.unsplash.com/photo-1702966346232-2797620e1992?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1702966346232-2797620e1992?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Nazarbad,Mysuru",
  }),
  g({
    id: 7, emoji: "☕",
    gradient: "linear-gradient(135deg, #92400e, #d97706)",
    rarityTier: "Legendary", rarityScore: 82,
    bloomStatus: "Critical", bloomCapacity: 88,
    name: "Nandy's Filter Coffee",
    location: "Gandhi Square", points: 65, rating: 4.8, category: "Food", weatherProfile: PROFILE_INDOOR_SAFE,
    description: "A legendary single-room establishment running since 1962. The owner blends arabica and robusta beans roasted in a charcoal drum out back. The coffee has a distinctive chicory undertone from a family-secret ratio.",
    digipinCode: "MYS-7R8P", distance: "0.6 km", safety: 5, safetyNote: "Best visited in the morning",
    audioArtisan: "Nandish Gowda", audioCraft: "Traditional Filter Coffee Brewing",
    audioDuration: "8 min · 0.6 km walk",
    audioTranscript: "\"60% arabica, 35% robusta, 5% chicory. That is the ratio. I will not write it down — only my son knows. The chicory makes it bitter-sweet, not bitter. My grandfather brought the recipe from a plantation estate in Coorg where he worked at 16. We roast every Tuesday morning at 4 AM — you can smell it from the main road.\"",
    image: "https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Gandhi+Square,Mysuru",
  }),
  g({
    id: 8, emoji: "🎭",
    gradient: "linear-gradient(135deg, #1d4ed8, #06b6d4)",
    rarityTier: "Legendary", rarityScore: 95,
    bloomStatus: "Active", bloomCapacity: 20,
    name: "Puppet Workshop Hall",
    location: "Chamundipuram", points: 220, rating: 4.9, category: "Crafts", weatherProfile: PROFILE_INDOOR_SAFE,
    description: "The last surviving traditional puppet-making workshop in Karnataka. Master craftsman Yellappa creates Yakshagana puppets using techniques documented in 18th-century manuscripts. Guided tours available on request.",
    digipinCode: "MYS-1F5Q", distance: "1.1 km", safety: 5, safetyNote: "Best visited between 10 AM – 5 PM",
    audioArtisan: "Yellappa Nayanar", audioCraft: "Yakshagana Puppet Making",
    audioDuration: "17 min · 1.1 km walk",
    audioTranscript: "\"A single puppet takes me 21 days. The head is carved from jackfruit wood — it must be dried for two years first. The eyes are painted last, always on a full moon day. I am 71 years old and I have made 3,400 puppets. My fingers know the form before my mind does. When I die, no one in Karnataka will know how to make these exactly as I do.\"",
    image: "https://images.unsplash.com/photo-1773165139451-bb2fe8bb6ec3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1773165139451-bb2fe8bb6ec3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Chamundipuram,Mysuru",
  }),
  g({
    id: 9, emoji: "🌿",
    gradient: "linear-gradient(135deg, #065f46, #059669)",
    rarityTier: "Rare", rarityScore: 55,
    bloomStatus: "Active", bloomCapacity: 30,
    name: "Kukkarahalli Bund",
    location: "Near CFTRI", points: 95, rating: 4.5, category: "Nature", weatherProfile: PROFILE_OUTDOOR_EXPOSED,
    description: "A serene 90-acre lake bund maintained by the University of Mysore. Home to 200+ bird species including painted storks and kingfishers. The eastern rim has a hidden bird-watching platform known only to birding communities.",
    digipinCode: "MYS-7R8P", distance: "1.4 km", safety: 5, safetyNote: "Best visited at sunrise",
    audioArtisan: "Dr. Meera Subramanya", audioCraft: "Ornithology & Wetland Ecology",
    audioDuration: "15 min · 1.4 km walk",
    audioTranscript: "\"This bund was built in 1864 by the Mysore Maharaja. The 200+ species here include 28 that are critically endangered elsewhere. The purple moorhen at 7 o'clock — see it? It's building a nest right now. In 2019 we documented a Siberian crane here, thousands of kilometers from its migration route. The lake remembered something even the bird forgot.\"",
    image: "https://images.unsplash.com/photo-1709351379398-cbc7995354b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1709351379398-cbc7995354b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Near+CFTRI,Mysuru",
  }),
  g({
    id: 10, emoji: "🧵",
    gradient: "linear-gradient(135deg, #be185d, #9333ea)",
    rarityTier: "Epic", rarityScore: 78,
    bloomStatus: "Fading", bloomCapacity: 60,
    name: "Mysore Silk Weaver",
    location: "Ashoka Road", points: 250, rating: 4.7, category: "Crafts", weatherProfile: PROFILE_INDOOR_SAFE,
    description: "A family-run silk weaving studio that has supplied sarees to the Mysore royal family for four generations. The hand-operated jacquard looms take 3–4 days to produce a single saree. Visitors can try their hand at weaving.",
    digipinCode: "MYS-4N2K", distance: "2.0 km", safety: 5, safetyNote: "Best visited on weekdays",
    audioArtisan: "Savithri Devaraju", audioCraft: "Mysore Silk Zari Weaving",
    audioDuration: "16 min · 2.0 km walk",
    audioTranscript: "\"The silk thread comes from Ramanagara — nowhere else. Our family has had the same supplier for four generations. One saree needs 5,600 individual threads to be set up on the loom before a single weft can be thrown. My mother could do this in three hours. I still take four. The sound of the loom — thak-thak-thak — that is the heartbeat of this house.\"",
    image: "https://images.unsplash.com/photo-1712485975136-b63cf7d6b60e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    images: ["https://images.unsplash.com/photo-1712485975136-b63cf7d6b60e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"],
    googleMapLink: "https://maps.google.com/?q=Ashoka+Road,Mysuru",
  }),
];

function getCategoryWeather(category: string): WeatherProfile {
  if (category === "Nature" || category === "Streets") return PROFILE_OUTDOOR_EXPOSED;
  if (category === "Attractions" || category === "Heritage" || category === "Temples" || category === "Churches") return PROFILE_OUTDOOR_SHELTERED;
  return PROFILE_INDOOR_SAFE;
}

function placeToGem(p: Place): GemData {
  let gemCategory: GemCategory = "Heritage";
  if (p.category === "Food") gemCategory = "Food";
  else if (p.category === "Stay") gemCategory = "Stay";
  else if (p.category === "Temples") gemCategory = "Temples";
  else if (p.category === "Nature") gemCategory = "Nature";
  else if (p.category === "Attractions") gemCategory = "Heritage";
  else if (p.category === "Hidden Gems") gemCategory = "Streets";
  else if (p.category === "Churches") gemCategory = "Heritage";

  return g({
    id: p.id,
    emoji: p.emoji,
    gradient: p.gradient,
    rarityTier: "Common",
    rarityScore: 20,
    bloomStatus: "Dormant",
    bloomCapacity: 10,
    name: p.name,
    location: p.location,
    points: 25,
    rating: 4.0,
    category: gemCategory,
    weatherProfile: getCategoryWeather(p.category),
    description: p.description ?? "A beautiful location to visit.",
    digipinCode: "MYS-GENERIC",
    distance: "Varies",
    safety: 5,
    safetyNote: "Standard public access.",
    audioArtisan: "Local Guide",
    audioCraft: "General Tour",
    audioDuration: "5 min",
    audioTranscript: "Enjoy the beautiful sights of " + p.name,
    image: p.image,
    images: p.images ?? [p.image],
  });
}

const detailedIds = new Set(detailedGems.map((g) => g.id));
const generatedGems = allPlaces.filter((p) => !detailedIds.has(p.id)).map(placeToGem);

export const allGems: GemData[] = [...detailedGems, ...generatedGems];

export function getBloomColor(status: BloomStatus): string {
  if (status === "Active")   return "#22c55e";
  if (status === "Fading")   return "#f59e0b";
  if (status === "Critical") return "#ef4444";
  return "#9ca3af";
}

export function getRarityTierLabel(tier: GemRarityTier): string {
  const labels: Record<GemRarityTier, string> = {
    Common: "Common", Uncommon: "Uncommon", Rare: "Rare", Epic: "Epic", Legendary: "Legendary",
  };
  return labels[tier];
}
