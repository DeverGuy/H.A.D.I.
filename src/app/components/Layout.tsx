import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { RightPanel } from "./RightPanel";
import { ToastContainer } from "./Toast";
import { useApp, useColors } from "../context/AppContext";
import { useGame } from "../store/GameStore";

export function Layout() {
  const { darkMode } = useApp();
  const C = useColors();
  const location = useLocation();
  const { currentWeather } = useGame();

  const isMapScreen = location.pathname === "/map";
  const isHexScreen = location.pathname === "/hex";
  const isFullScreen = isMapScreen || isHexScreen; // screens that want to break out of layout padding

  return (
    <div
      className={`min-h-screen font-dm${darkMode ? " dark-mode" : ""}`}
      style={{ background: C.bg, color: C.text, transition: "background 0.3s, color 0.3s", position: "relative" }}
    >
      {/* Weather Ambience Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-[3000ms]"
        style={{
          opacity: 0.8,
          background: currentWeather.condition === "Sunny" 
            ? "radial-gradient(circle at top right, rgba(234, 179, 8, 0.15), transparent 60%)"
            : currentWeather.condition === "Rain"
            ? "linear-gradient(to bottom, rgba(59, 130, 246, 0.05), rgba(30, 64, 175, 0.15))"
            : currentWeather.condition === "Cloudy"
            ? "linear-gradient(to bottom, rgba(156, 163, 175, 0.1), rgba(75, 85, 99, 0.1))"
            : "none"
        }}
      />
      
      {/* Global Toast */}
      <div className="relative z-50"><ToastContainer /></div>

      {/* Left Sidebar */}
      <Sidebar />

      {/* Main layout container */}
      <div className="flex w-full justify-center">
        {/* Sidebar spacer for desktop */}
        <div className="hidden lg:block shrink-0" style={{ width: 248 }} />

        {/* Main content */}
        <main
          className={`flex-1 min-w-0 ${isFullScreen ? "overflow-hidden" : "pb-24 lg:pb-8"}`}
          style={{ maxWidth: isFullScreen ? "100%" : 1200, paddingTop: isFullScreen ? 0 : 28, margin: isFullScreen ? 0 : "0 auto" }}
        >
          <div className={isFullScreen ? "" : "px-4 lg:px-8"}>
            {/* Key by pathname for page transition on each route change */}
            <div
              key={location.pathname}
              style={isFullScreen ? {} : { animation: "fadeUp 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
            >
              <Outlet />
            </div>
          </div>
        </main>

        {/* Right Panel — hidden on map screen to give more width */}
        {!isFullScreen && (
          <div className="hidden xl:block shrink-0" style={{ width: 320, paddingTop: 28, paddingRight: 24 }}>
            <RightPanel />
          </div>
        )}
      </div>

      {/* Bottom Navigation (mobile) */}
      <BottomNav />
    </div>
  );
}