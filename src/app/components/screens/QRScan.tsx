import { useState, useEffect, useMemo, useRef, Component, ErrorInfo, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { useApp } from "../../context/AppContext";
import { useGame } from "../../store/GameStore";
import { generateGemQR } from "../../engine/checkin";
import QrScanner from "qr-scanner";

// ── Extreme Error Boundary to guarantee no white screens ──────────────
class QRScannerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMsg: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || String(error) };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QRScan CRITICAL CRASH:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-8 bg-black text-red-500 font-mono text-xs break-all z-50">
          <h1 className="text-xl font-bold mb-4">CRITICAL SCANNER CRASH</h1>
          <p>{this.state.errorMsg}</p>
          <button onClick={() => window.location.reload()} className="mt-8 px-4 py-2 bg-red-600 text-white rounded">
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function QRScanInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useApp();
  const { doCheckin } = useGame();

  const state = location.state as { gemId?: number; gemName?: string; gemPoints?: number } | null;
  const gemId = state?.gemId ?? 8;
  const gemName = state?.gemName ?? "Puppet Workshop Hall";
  const gemPoints = state?.gemPoints ?? 220;

  const [phase, setPhase] = useState<"scanning" | "success">("scanning");
  const [showToast, setShowToast] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState(gemPoints);
  const [errorMessage, setErrorMessage] = useState("");

  const validQRString = useMemo(() => generateGemQR(gemId, Date.now()), [gemId]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualVerify = async (code: string) => {
    if (scanCompleted) return;
    setScanCompleted(true);
    setErrorMessage("");
    const result = await doCheckin(gemId, "qr", undefined, 5, code);
    
    if (result.valid) {
      if (scannerRef.current) scannerRef.current.stop();
      const points = result.pointsAwarded || gemPoints;
      navigate("/", { state: { checkinSuccess: true, points, gemName } });
    } else {
      setErrorMessage(result.reason || "Invalid Check-in.");
      addToast("warning", result.reason || "Check-in failed.");
      setTimeout(() => setScanCompleted(false), 2000);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    if (videoRef.current && phase === "scanning") {
      try {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!isMounted) return;
            handleManualVerify(result.data);
          },
          {
            onDecodeError: (error) => {
              // Ignore standard decode errors (it happens on every frame without a QR code)
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 10,
          }
        );
        scannerRef.current = scanner;

        scanner.start().catch((e) => {
          if (!isMounted) return;
          console.error("[HADI] Camera start failed", e);
          if (e === "Camera not found.") {
            setErrorMessage("No camera found on this device.");
          } else {
            setErrorMessage("Camera access denied or unavailable. Please use the image upload fallback below.");
          }
        });
      } catch (e: any) {
        if (isMounted) {
          setErrorMessage(e.message || "Failed to initialize scanner.");
        }
      }
    }

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [gemId, phase]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage("");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      if (result && result.data) {
        handleManualVerify(result.data);
      }
    } catch (e: any) {
      setErrorMessage("No QR code found in that image. Try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center bg-[#0A1A1A]">
      <div className="w-full flex items-center gap-4 px-5 pt-12 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white flex-shrink-0 cursor-pointer"
        >
          ←
        </button>
        <h1 className="font-playfair text-white text-xl font-bold">Scan to Verify</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 w-full max-w-sm mx-auto">
        {phase === "scanning" && (
          <>
            {/* Standard Nimiq Video Container */}
            <div 
              className="relative mb-6 rounded-2xl overflow-hidden bg-black flex items-center justify-center border-2 border-[#E07B2A]/40 shadow-[0_0_25px_rgba(224,123,42,0.15)]"
              style={{ width: "100%", aspectRatio: "1/1" }}
            >
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                playsInline 
                muted 
                autoPlay 
              />
            </div>

            <p className="font-dm text-white/70 text-sm mb-6 text-center">
              Align QR Code inside the scanner
            </p>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-4 rounded-xl mb-6 text-center w-full">
                {errorMessage}
              </div>
            )}

            {/* Foolproof Image Upload Fallback */}
            <div className="w-full flex flex-col items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="font-playfair text-white/90 font-bold text-sm">
                Camera not working?
              </span>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#E07B2A] text-white px-5 py-2 rounded-full font-dm text-sm font-bold shadow-lg"
              >
                Upload QR Image
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="mt-8 flex flex-col gap-2 w-full">
              <button
                onClick={() => handleManualVerify(validQRString)}
                className="w-full bg-white/10 border border-white/20 rounded-lg text-white font-dm text-xs font-bold py-3"
              >
                [DEBUG] Auto-Verify Success
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function QRScan() {
  return (
    <QRScannerErrorBoundary>
      <QRScanInner />
    </QRScannerErrorBoundary>
  );
}
