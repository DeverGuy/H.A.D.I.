import { useState, useEffect, useRef } from "react";
import { useColors } from "../../context/AppContext";

export function AudioGuide({ transcript }: { transcript: string }) {
  const C = useColors();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (synth.speaking) {
        synth.cancel();
      }
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      synth.pause();
      setIsPlaying(false);
    } else {
      if (synth.paused) {
        synth.resume();
        setIsPlaying(true);
      } else {
        // Start fresh
        if (synth.speaking) synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(transcript);
        
        // Try to pick a decent voice (English, preferably male/deep or female/narrator if available)
        const voices = synth.getVoices();
        const enVoices = voices.filter(v => v.lang.startsWith('en'));
        if (enVoices.length > 0) {
          utterance.voice = enVoices.find(v => v.name.includes("Google") || v.name.includes("Natural")) || enVoices[0];
        }
        
        utterance.rate = 0.95; // slightly slower for storytelling
        
        utterance.onend = () => {
          setIsPlaying(false);
          setProgress(0);
        };
        
        utterance.onboundary = (e) => {
          // Approximate progress based on character count
          if (e.name === "word") {
            const pct = (e.charIndex / transcript.length) * 100;
            setProgress(pct);
          }
        };

        utteranceRef.current = utterance;
        synth.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-up"
      style={{
        background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
        pointerEvents: "none" // Let clicks pass through the gradient area
      }}
    >
      <div 
        className="max-w-md mx-auto rounded-[16px] p-3 flex items-center gap-4 overflow-hidden relative"
        style={{ 
          background: C.card, 
          border: `1px solid ${C.border}`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          pointerEvents: "auto",
          backdropFilter: "blur(12px)"
        }}
      >
        {/* Progress Bar Background */}
        <div 
          className="absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-300"
          style={{ width: `${progress}%`, background: "#E07B2A" }}
        />

        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay}
          className="w-12 h-12 shrink-0 rounded-[12px] flex items-center justify-center pressable relative z-10"
          style={{ background: "#E07B2A", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(224,123,42,0.3)" }}
        >
          {isPlaying ? (
            // Pause icon
            <div className="w-3 h-4 flex gap-1">
              <div className="w-[4px] h-full bg-white rounded-sm" />
              <div className="w-[4px] h-full bg-white rounded-sm" />
            </div>
          ) : (
            // Play icon
            <div 
              style={{
                width: 0,
                height: 0,
                borderTop: "7px solid transparent",
                borderBottom: "7px solid transparent",
                borderLeft: "10px solid white",
                marginLeft: 3
              }}
            />
          )}
        </button>

        {/* Waveform / Info */}
        <div className="flex-1 flex flex-col justify-center min-w-0 relative z-10">
          <span className="font-dm text-[11px] font-bold mb-1 opacity-70 uppercase tracking-widest" style={{ color: C.text }}>
            Audio Guide
          </span>
          <div className="flex items-center gap-[3px] h-6 overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-all ${isPlaying ? 'animate-waveform' : ''}`}
                style={{
                  background: isPlaying ? "#E07B2A" : C.muted,
                  height: isPlaying ? `${30 + Math.random() * 70}%` : "20%",
                  opacity: isPlaying ? 1 : 0.4,
                  animationDelay: `${Math.random() * 1.5}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
