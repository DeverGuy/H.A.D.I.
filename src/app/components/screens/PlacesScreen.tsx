import { useState, useEffect } from "react";
import { useColors, useApp } from "../../context/AppContext";
import { categories, type PlaceCategory, type Place } from "../../data/places";
import { useGame } from "../../store/GameStore";
import { ImageWithFallback } from "../figma/ImageWithFallback";

function ImageCarousel({ place }: { place: Place }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = place.images || [place.image];

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="relative h-56 md:h-60 overflow-hidden group">
      {/* Images container with scale-up on card hover */}
      <div
        className="flex h-full w-full transition-transform duration-700 ease-in-out group-hover:scale-105"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((img, idx) => (
          <div key={idx} className="h-full w-full shrink-0">
            <ImageWithFallback
              src={img}
              alt={`${place.name} - ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Elegant Gradient overlay for modern legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Image indicators */}
      {images.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 flex gap-1.5 z-10"
          style={{ transform: "translateX(-50%)" }}
        >
          {images.map((_, idx) => (
            <div
              key={idx}
              className="transition-all duration-300"
              style={{
                width: currentIndex === idx ? 16 : 6,
                height: 6,
                borderRadius: 99,
                background: currentIndex === idx ? "#E07B2A" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlacesScreen() {
  const C = useColors();
  const { savedPlaces, toggleSavedPlace } = useApp();
  const { allPlaces } = useGame();
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | "All">("All");

  const displayPlaces = selectedCategory === "All"
    ? allPlaces
    : allPlaces.filter(p => p.category === selectedCategory);

  return (
    <div className="animate-fade-up flex flex-col gap-6 pb-12">
      {/* Sticky Frosted-Glass Header */}
      <div 
        className="sticky top-0 z-20 -mx-4 px-4 py-4 backdrop-blur-lg"
        style={{ 
          background: `${C.bg}E0`, // Dynamic transparency matching app theme background
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <h1 className="font-playfair mb-1 tracking-tight" style={{ color: C.text, fontSize: 28, fontWeight: 700 }}>
          Explore Mysuru
        </h1>
        <p className="font-dm mb-4 opacity-85" style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.5 }}>
          Discover the historical gems, pristine stays, and rich nature within the Mysuru golden circle
        </p>

        {/* Curated Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("All")}
            className="font-dm whitespace-nowrap shrink-0 pressable px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200"
            style={{
              background: selectedCategory === "All" ? "#E07B2A" : "rgba(255,255,255,0.06)",
              border: selectedCategory === "All" ? "1px solid #E07B2A" : `1px solid ${C.borderStrong}`,
              color: selectedCategory === "All" ? "#fff" : C.text,
              boxShadow: selectedCategory === "All" ? "0 4px 12px rgba(224,123,42,0.3)" : "none",
              cursor: "pointer",
            }}
          >
            All Places
          </button>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="font-dm whitespace-nowrap shrink-0 pressable px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 hover:bg-white/10"
                style={{
                  background: active ? "#E07B2A" : "rgba(255,255,255,0.06)",
                  border: active ? "1px solid #E07B2A" : `1px solid ${C.borderStrong}`,
                  color: active ? "#fff" : C.text,
                  boxShadow: active ? "0 4px 12px rgba(224,123,42,0.3)" : "none",
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Places Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
        {displayPlaces.map((place) => (
          <div
            key={place.id}
            className="group rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 flex flex-col"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              boxShadow: "var(--premium-shadow-md)",
            }}
          >
            {/* Image & Indicators Container */}
            <div className="relative overflow-hidden">
              <ImageCarousel place={place} />

              {/* Frosted Emoji Badge */}
              <div
                className="absolute top-4 left-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: place.gradient,
                  fontSize: 22,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                }}
              >
                {place.emoji}
              </div>

              {/* Curated Category Tag Overlay */}
              <div
                className="absolute top-4 right-14 font-dm text-[10px] tracking-widest uppercase font-bold"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: 99,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {place.category}
              </div>

              {/* Save / Bookmark Button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSavedPlace(place.id); }}
                className="absolute top-4 right-4 flex items-center justify-center transition-transform hover:scale-110 pressable"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: savedPlaces.has(place.id) ? "#E07B2A" : "#fff",
                  cursor: "pointer",
                }}
              >
                {savedPlaces.has(place.id) ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21L12 17.5L5 21V5Z"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 21L12 17.5L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Immersive Description & Information */}
            <div className="p-5 flex flex-col gap-2.5 flex-1 justify-between">
              <div>
                <h3
                  className="font-playfair text-[18px] font-bold tracking-tight mb-1.5 transition-colors duration-300 group-hover:text-[#E07B2A]"
                  style={{ color: C.text, lineHeight: 1.3 }}
                >
                  {place.name}
                </h3>
                
                <div className="flex items-center gap-1.5 text-xs mb-3">
                  <span className="opacity-70 text-xs">📍</span>
                  <p className="font-dm font-semibold uppercase tracking-wider text-[10px]" style={{ color: C.muted }}>
                    {place.location}
                  </p>
                </div>

                {place.description && (
                  <p
                    className="font-dm text-xs opacity-90 leading-relaxed"
                    style={{
                      color: C.text,
                    }}
                  >
                    {place.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Empty State */}
      {displayPlaces.length === 0 && (
        <div className="text-center py-20 flex flex-col items-center justify-center gap-3">
          <span style={{ fontSize: 48 }}>🗺️</span>
          <p className="font-playfair font-bold text-lg" style={{ color: C.text }}>
            No landmarks discovered here
          </p>
          <p className="font-dm text-sm" style={{ color: C.muted }}>
            Try checking another category inside the Mysuru catalog
          </p>
        </div>
      )}
    </div>
  );
}
