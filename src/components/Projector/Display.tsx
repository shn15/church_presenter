import { useEffect, useState, useCallback, useRef, CSSProperties } from "react";
import { useSocket } from "../../hooks/useSocket";
import { motion, AnimatePresence } from "motion/react";
import { Monitor, Lock, Clock, QrCode, Camera, RefreshCw, X, Keyboard, Check, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppLogo } from "../Logo";
import { Html5Qrcode } from "html5-qrcode";
import { getAllMedia } from "../../lib/indexedDbMedia";
import { getPublicUrl } from "../../lib/projectorUtils";
import { getActiveAccountId } from "../../lib/accountManager";

const isVideo = (url?: string) => {
  if (!url) return false;
  const cleanUrl = url.toLowerCase();
  
  // Exclude common image formats to prevent false positives
  if (cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.bmp') || cleanUrl.endsWith('.svg')) {
    return false;
  }

  return cleanUrl.endsWith('.mp4') || 
         cleanUrl.endsWith('.webm') || 
         cleanUrl.endsWith('.ogg') ||
         cleanUrl.includes('.mp4?') ||
         cleanUrl.includes('.webm?') ||
         cleanUrl.includes('.ogg?') ||
         cleanUrl.includes('mixkit.co/videos') ||
         cleanUrl.startsWith('data:video') ||
         cleanUrl.startsWith('blob:video') ||
         cleanUrl.includes('.mp4') || 
         cleanUrl.includes('.webm') || 
         cleanUrl.includes('.ogg');
};

function AutoPlayingVideo({ src, style, className }: { src: string; style?: CSSProperties; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Force muted and try playing
    video.defaultMuted = true;
    video.muted = true;
    
    // Explicitly load and play
    video.load();
    
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn("Video play failed or was prevented:", error);
        
        // Retry playing on any document click/touch as a fallback for strict browser autoplay policies
        const handleInteraction = () => {
          video.play().catch(() => {});
          document.removeEventListener("click", handleInteraction);
          document.removeEventListener("touchstart", handleInteraction);
        };
        document.addEventListener("click", handleInteraction, { passive: true });
        document.addEventListener("touchstart", handleInteraction, { passive: true });
      });
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      autoPlay
      loop
      playsInline
      webkitPlaysInline={true}
      className={className}
      style={style}
    />
  );
}

const isLightBg = (bg: string | undefined): boolean => {
  if (!bg) return false; // Default background is black (dark)
  const cleanBg = bg.trim().toLowerCase();

  // Handle transparent
  if (cleanBg === "transparent") return false;

  // Hex color check
  if (cleanBg.startsWith("#")) {
    const hex = cleanBg.replace(/^#/, "");
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return false;
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 140; // Over 140 is clear/light
  }

  // RGB/RGBA check
  if (cleanBg.startsWith("rgb")) {
    const matches = cleanBg.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]);
      const g = parseInt(matches[1]);
      const b = parseInt(matches[2]);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 140;
    }
  }

  // Linear Gradient average contrast check
  if (cleanBg.includes("gradient")) {
    const hexMatches = cleanBg.match(/#[0-9a-f]{3,6}/gi);
    if (hexMatches && hexMatches.length > 0) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (const rawHex of hexMatches) {
        const hex = rawHex.replace(/^#/, "");
        let r = 0, g = 0, b = 0;
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16);
          g = parseInt(hex[1] + hex[1], 16);
          b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        } else {
          continue;
        }
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
      if (count > 0) {
        const brightness = ((rSum / count) * 299 + (gSum / count) * 587 + (bSum / count) * 114) / 1000;
        return brightness > 140;
      }
    }
  }

  // Common light text/color identifiers
  const lightKeywords = ["white", "yellow", "light", "bright", "cream", "ivory", "gold", "aqua", "cyan", "beige"];
  if (lightKeywords.some((kw) => cleanBg.includes(kw))) {
    return true;
  }

  return false;
};

export default function ProjectorDisplay() {
  const { currentSlide, currentShift } = useSocket();
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const loadIndexedDBMedia = async () => {
      try {
        const list = await getAllMedia();
        if (!active) return;
        const mapping: Record<string, string> = {};
        list.forEach((item) => {
          const localUrl = URL.createObjectURL(item.file);
          mapping[item.id] = localUrl;
          
          const cleanPath = item.id.startsWith("http") ? new URL(item.id).pathname : item.id;
          mapping[cleanPath] = localUrl;
          
          const filename = item.id.substring(item.id.lastIndexOf("/") + 1);
          mapping[filename] = localUrl;
        });
        setMediaUrls(mapping);
      } catch (err) {
        console.error("Failed to load IndexedDB media in ProjectorDisplay:", err);
      }
    };
    loadIndexedDBMedia();
    return () => {
      active = false;
    };
  }, []);

  const resolveMedia = useCallback((url?: string) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;

    // Handle blob: URLs (check if local mediaUrls has a match)
    if (url.startsWith("blob:")) {
      if (mediaUrls[url]) return mediaUrls[url];
      if (url.includes("/uploads/")) {
        const pathOnly = url.substring(url.indexOf("/uploads/"));
        if (mediaUrls[pathOnly]) return mediaUrls[pathOnly];
      }
      if (url.includes("/backgrounds/")) {
        const pathOnly = url.substring(url.indexOf("/backgrounds/"));
        if (mediaUrls[pathOnly]) return mediaUrls[pathOnly];
      }
      const stripped = url.replace(/^blob:/, "");
      if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
        url = stripped;
      }
    }

    let processedUrl = url;

    // First check local IndexedDB cache for matching path or filename
    const pathOnly = url.includes("/uploads/")
      ? url.substring(url.indexOf("/uploads/"))
      : url.includes("/backgrounds/")
      ? url.substring(url.indexOf("/backgrounds/"))
      : url;

    if (mediaUrls[pathOnly]) return mediaUrls[pathOnly];
    const filename = pathOnly.split("/").pop();
    if (filename && mediaUrls[filename]) return mediaUrls[filename];
    if (mediaUrls[url]) return mediaUrls[url];

    // Dynamic origin resolution for uploaded backgrounds and assets
    if (url.includes("/uploads/") || url.includes("/backgrounds/")) {
      if (url.startsWith("/")) {
        processedUrl = window.location.origin + url;
      } else {
        processedUrl = url;
      }
    } else if (url.startsWith("/") && !url.startsWith("//")) {
      processedUrl = window.location.origin + url;
    } else if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        processedUrl = url;
      } else {
        try {
          const parsed = new URL(url);
          processedUrl = window.location.origin + parsed.pathname + parsed.search;
        } catch {}
      }
    }

    // Upgrade http:// to https:// if page is loaded securely over https and url points to remote server
    if (typeof window !== "undefined" && window.location.protocol === "https:" && processedUrl.startsWith("http://")) {
      if (!processedUrl.startsWith("http://localhost") && !processedUrl.startsWith("http://127.0.0.1")) {
        processedUrl = "https://" + processedUrl.substring(7);
      }
    }

    return processedUrl;
  }, [mediaUrls]);

  // Check if this screen is opened inside a mobile share device context
  // This satisfies both query parameter scan and physical device mode check
  const isMobileShare = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("mode") === "share"
  );
  
  const [isSessionValid, setIsSessionValid] = useState(() => {
    if (typeof window === "undefined") return true;
    
    // Check if we are running in mobile share mode
    const params = new URLSearchParams(window.location.search);
    const isShare = params.get("mode") === "share";
    
    if (!isShare) return true;

    // Retrieve active shift state from localStorage synchronously
    let initialShift: any = null;
    try {
      const saved = localStorage.getItem('cp_current_shift');
      if (saved) initialShift = JSON.parse(saved);
    } catch {}

    // When shift is inactive/disabled, mobile share is running as usual without lock/authentication
    if (!initialShift || !initialShift.active) {
      return true;
    }

    // Check ending time
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [endH, endM] = (initialShift.endTime || "").split(":").map(Number);
    if (!isNaN(endH) && !isNaN(endM)) {
      const endMinutes = endH * 60 + endM;
      if (nowMinutes >= endMinutes) {
        return false;
      }
    }

    // Check if the user has scanned the static QR code for the active shift
    const hasScanned = sessionStorage.getItem("cp_scanned_qr_active") === "true" && sessionStorage.getItem("cp_scanned_shift_name") === initialShift.name;
    return hasScanned;
  });

  const [isShiftEnded, setIsShiftEnded] = useState(() => {
    if (typeof window === "undefined") return false;
    
    let initialShift: any = null;
    try {
      const saved = localStorage.getItem('cp_current_shift');
      if (saved) initialShift = JSON.parse(saved);
    } catch {}

    // When shift is inactive/disabled, the shift is not ended.
    if (!initialShift || !initialShift.active) return false;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [endH, endM] = (initialShift.endTime || "").split(":").map(Number);
    if (!isNaN(endH) && !isNaN(endM)) {
      const endMinutes = endH * 60 + endM;
      return nowMinutes >= endMinutes;
    }
    return false;
  });

  // Scanner & Token validation states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scanFeedbackMsg, setScanFeedbackMsg] = useState<string | null>(null);

  // Mobile entrance greeting screen states
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "share";
  });

  useEffect(() => {
    if (isMobileShare && showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isMobileShare, showWelcome]);

  const startCameraScan = async () => {
    setScannerLoading(true);
    setScannerError(null);
    setScanFeedbackMsg(null);
    
    // Tiny timeout to make sure the div #qr-reader-target has rendered in the DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader-target");
        setScannerInstance(html5QrCode);
        setScannerLoading(false);

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            console.log("Scanned text success:", decodedText);
            await processScannedToken(decodedText);
          },
          () => {
            // Keep scanning silently
          }
        );
      } catch (err: any) {
        console.error("Failed to start scanner:", err);
        setScannerError("Gagal mengakses kamera. Silakan pastikan izin kamera diaktifkan.");
        setScannerLoading(false);
      }
    }, 400);
  };

  const stopCameraScan = async () => {
    if (scannerInstance) {
      try {
        if (scannerInstance.isScanning) {
          await scannerInstance.stop();
        }
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
      setScannerInstance(null);
    }
  };

  const closeScanner = async () => {
    await stopCameraScan();
    setIsScannerOpen(false);
    setScannerError(null);
    setScanFeedbackMsg(null);
  };

  const openScanner = () => {
    setIsScannerOpen(true);
    startCameraScan();
  };

  const processScannedToken = async (text: string) => {
    if (!text) return;
    
    const isProjectorQR = text.toLowerCase().includes("mode=share") || text.toLowerCase().includes("/projector");
    if (!isProjectorQR) {
      setScannerError("QR Code yang di-scan bukan QR Code Church Presenter.");
      return;
    }

    try {
      setScannerLoading(true);
      // Determine target account ID from scanned text or window URL
      let targetAcc = "";
      try {
        const scannedUrl = new URL(text, window.location.origin);
        targetAcc = scannedUrl.searchParams.get("account") || "";
      } catch {}
      if (!targetAcc) {
        targetAcc = new URLSearchParams(window.location.search).get("account") || getActiveAccountId();
      }

      // Verify if there is currently an active shift on the server for this account
      const res = await fetch(`/api/current-shift?account=${encodeURIComponent(targetAcc)}`);
      let serverShift = null;
      if (res.ok) {
        serverShift = await res.json();
      }

      const activeShift = (serverShift && serverShift.active)
        ? serverShift
        : (currentShift && currentShift.active ? currentShift : null);

      if (activeShift && activeShift.active) {
        setScanFeedbackMsg("Koneksi berhasil! Menghubungkan...");
        
        sessionStorage.setItem("cp_scanned_qr_active", "true");
        sessionStorage.setItem("cp_scanned_shift_name", activeShift.name || "");
        
        // Update URL search parameters to be clean with mode=share and account
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set("mode", "share");
        if (targetAcc) urlParams.set("account", targetAcc);
        window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);

        // Re-authenticate immediately
        setIsSessionValid(true);
        setIsShiftEnded(false);
        
        // Close modal after brief delay
        setTimeout(() => {
          closeScanner();
        }, 1200);
      } else {
        setScannerError("Tidak ada shift ibadah yang sedang aktif di operator.");
      }
    } catch (err: any) {
      console.error(err);
      setScannerError(`Kesalahan koneksi: ${err.message || "Gagal memverifikasi shift aktif."}`);
    } finally {
      setScannerLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerInstance) {
        scannerInstance.stop().catch(err => console.error(err));
      }
    };
  }, [scannerInstance]);

  useEffect(() => {
    if (!isMobileShare) {
      setIsSessionValid(true);
      return;
    }

    const checkTimeAndSession = () => {
      // 1. If no shift is active at all, run normally without authentication or locking
      if (!currentShift || !currentShift.active) {
        setIsShiftEnded(false);
        setIsSessionValid(true);
        return;
      }

      // 2. Check ending time
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      
      const [endH, endM] = currentShift.endTime.split(":").map(Number);
      if (isNaN(endH) || isNaN(endM)) {
        setIsShiftEnded(false);
        setIsSessionValid(true);
        return;
      }
      const endMinutes = endH * 60 + endM;

      if (nowMinutes >= endMinutes) {
        setIsShiftEnded(true);
        setIsSessionValid(false);
        try {
          sessionStorage.removeItem("cp_scanned_qr_active");
          sessionStorage.removeItem("cp_scanned_shift_name");
          sessionStorage.removeItem("cp_scanned_token");
        } catch {}
        return;
      }

      setIsShiftEnded(false);

      // 3. QR-code scan validation: verify if the scanned shift name in sessionStorage matches the active current shift
      const hasScannedCurrent = sessionStorage.getItem("cp_scanned_qr_active") === "true" && sessionStorage.getItem("cp_scanned_shift_name") === currentShift.name;
      setIsSessionValid(hasScannedCurrent);
    };

    checkTimeAndSession();
    const interval = setInterval(checkTimeAndSession, 1000);
    return () => clearInterval(interval);
  }, [currentShift, isMobileShare]);

  const [outputResolution, setOutputResolution] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_output_resolution") || "16:9";
    } catch {
      return "16:9";
    }
  });

  const [transitionDuration, setTransitionDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cp_settings_transition_duration");
      return saved ? parseFloat(saved) : 0.3;
    } catch {
      return 0.3;
    }
  });

  const [globalFontFamily, setGlobalFontFamily] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_font_family") || "Default";
    } catch {
      return "Default";
    }
  });

  const [globalTextTransform, setGlobalTextTransform] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_text_transform") || "Default";
    } catch {
      return "Default";
    }
  });

  const [lowerThirdMode, setLowerThirdMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("cp_settings_lower_third_mode") === "true";
    } catch {
      return false;
    }
  });

  const [globalFontSizeScale, setGlobalFontSizeScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cp_settings_font_size_scale");
      return saved ? parseInt(saved, 10) : 100;
    } catch {
      return 100;
    }
  });

  const [globalTextShadowStyle, setGlobalTextShadowStyle] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_text_shadow_style") || "Default";
    } catch {
      return "Default";
    }
  });

  const [chromaKeyColor, setChromaKeyColor] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_chroma_key_color") || "transparent";
    } catch {
      return "transparent";
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setOutputResolution(localStorage.getItem("cp_settings_output_resolution") || "16:9");
        const savedTrans = localStorage.getItem("cp_settings_transition_duration");
        setTransitionDuration(savedTrans ? parseFloat(savedTrans) : 0.3);
        setGlobalFontFamily(localStorage.getItem("cp_settings_font_family") || "Default");
        setGlobalTextTransform(localStorage.getItem("cp_settings_text_transform") || "Default");
        setLowerThirdMode(localStorage.getItem("cp_settings_lower_third_mode") === "true");
        const savedScale = localStorage.getItem("cp_settings_font_size_scale");
        setGlobalFontSizeScale(savedScale ? parseInt(savedScale, 10) : 100);
        setGlobalTextShadowStyle(localStorage.getItem("cp_settings_text_shadow_style") || "Default");
        setChromaKeyColor(localStorage.getItem("cp_settings_chroma_key_color") || "transparent");
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (currentSlide) {
      console.log("Projector received slide:", currentSlide.type, currentSlide.title);
    }
  }, [currentSlide]);

  const renderScannerModal = () => {
    return (
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex flex-col justify-between p-6 overflow-y-auto font-sans text-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2 rounded bg-blue-500/10 text-blue-400 text-[9px] font-mono font-black uppercase tracking-widest">
                  Security Portal
                </span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Otentikasi Perangkat</h3>
              </div>
              <button
                onClick={closeScanner}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Main Content */}
            <div className="my-auto py-6 flex flex-col items-center">
              <div className="flex flex-col items-center">
                {/* Camera Container Frame */}
                <div className="relative w-[280px] h-[280px] rounded-3xl overflow-hidden border border-white/10 bg-zinc-900 flex flex-col items-center justify-center shadow-2xl">
                  <span className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-tl-lg pointer-events-none z-10" />
                  <span className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-500 rounded-tr-lg pointer-events-none z-10" />
                  <span className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-500 rounded-bl-lg pointer-events-none z-10" />
                  <span className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-500 rounded-br-lg pointer-events-none z-10" />
                  
                  {!scannerLoading && !scanFeedbackMsg && !scannerError && (
                    <div className="absolute left-0 right-0 h-0.5 bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-[bounce_2s_infinite] pointer-events-none z-10" />
                  )}

                  <div id="qr-reader-target" className="w-[280px] h-[280px] object-cover" />
                  
                  {scannerLoading && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-blue-500 border-t-transparent animate-spin" />
                      <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400">Memuat Kamera...</p>
                    </div>
                  )}

                  {scanFeedbackMsg && (
                    <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-6 text-center z-20 font-sans">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-3">
                        <Check className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-white uppercase tracking-wider">{scanFeedbackMsg}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-4 max-w-xs text-center leading-normal font-sans">
                  Arahkan kamera belakang ponsel ke QR Code Church Presenter yang dicetak atau ditampilkan di depan.
                </p>
              </div>

              {/* Validation Error Message Box */}
              {scannerError && (
                <div className="mt-6 w-full max-w-xs p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 text-left font-sans">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-rose-500">Koneksi Gagal</h5>
                    <p className="text-[11px] leading-relaxed mt-0.5 text-gray-300">{scannerError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] text-gray-600 font-bold uppercase tracking-widest border-t border-white/5 pt-4">
              Church Presenter Cloud Sync System
            </div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  // Mobile share shift restrictions
  if (isMobileShare && isShiftEnded) {
    return (
      <div className="bg-zinc-950 w-screen h-screen flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        <div className="border border-rose-500/20 bg-rose-500/5 p-8 rounded-3xl max-w-sm flex flex-col items-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 text-rose-500">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-wider text-white mb-2">Shift Ibadah Berakhir</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-6">
            Waktu operasional shift ibadah ({currentShift?.name || "Aktif"}) telah selesai. Tampilan mobile share telah dinonaktifkan secara otomatis.
          </p>
          <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest border-t border-white/10 pt-4 w-full">
            Church Presenter Cloud Sync
          </div>
        </div>
      </div>
    );
  }

  if (isMobileShare && !isSessionValid) {
    return (
      <div className="bg-zinc-950 w-screen h-screen flex flex-col items-center justify-center text-white font-sans p-6 text-center">
        {renderScannerModal()}
        <div className="border border-blue-500/20 bg-blue-500/5 p-8 rounded-3xl max-w-sm flex flex-col items-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5 text-blue-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-wider text-white mb-2">Akses Terkunci</h2>
          <p className="text-xs text-gray-400 leading-relaxed mb-6">
            Shift ibadah ({currentShift?.name || "Aktif"}) sedang berlangsung dengan pembatasan keamanan. Silakan pindai QR Code resmi dari layar operator untuk mengakses.
          </p>
          <button
            onClick={openScanner}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Pindai QR Code Ibadah
          </button>
        </div>
      </div>
    );
  }

  if (!currentSlide) return (
    <div className="bg-black w-screen h-screen flex flex-col items-center justify-center text-white/30 font-sans p-20">
      <div className="border border-white/10 p-12 rounded-[2rem] flex flex-col items-center bg-white/[0.02]">
        <AppLogo className="w-48 h-48 mb-8" showText={false} />
        <h1 className="text-3xl font-black tracking-[0.2em] uppercase mb-3 text-white">Church Presenter</h1>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-blue-500 to-transparent mb-6 opacity-50" />
        <p className="text-sm font-mono tracking-[0.5em] opacity-40 uppercase">Waiting for Signal</p>
      </div>
    </div>
  );

  const isLight = isLightBg(currentSlide.backgroundOverride || currentSlide.background);

  const textWidth = currentSlide.textWidth !== undefined ? currentSlide.textWidth : 92;
  const textHeight = currentSlide.textHeight !== undefined ? currentSlide.textHeight : 78;
  const textLeft = currentSlide.textLeft !== undefined ? currentSlide.textLeft : (100 - textWidth) / 2;
  const textTop = currentSlide.textTop !== undefined ? currentSlide.textTop : (100 - textHeight) / 2;

  // Extract custom styling properties with defaults matching EasyWorship 7
  const baseTextColor = currentSlide.textColor || "#ffffff";
  // Dynamically invert default white text to charcoal dark if background is light
  const textColor = isLight && (baseTextColor.toLowerCase() === "#ffffff" || baseTextColor.toLowerCase() === "white") ? "#111827" : baseTextColor;
  const fontSizeMode = currentSlide.fontSizeMode || "auto";
  const fontSize = currentSlide.fontSize || 60;
  const textAlign = currentSlide.textAlign || "center";
  const textPosition = lowerThirdMode ? "bottom" : (currentSlide.textPosition || "center");
  const textBold = currentSlide.textBold !== false; // default true
  const textItalic = currentSlide.textItalic || false;
  const textShadow = currentSlide.textShadow !== false; // default true
  
  const fontFamilyValue = globalFontFamily !== "Default" ? globalFontFamily : (currentSlide.fontFamily || "Sans / Inter");
  const textTransformValue = globalTextTransform !== "Default" ? globalTextTransform : (currentSlide.textTransform || "uppercase");
  const textTrackingValue = currentSlide.textTracking || "normal";
  const textSpacingValue = currentSlide.textSpacing || "normal";
  const slideTransitionValue = currentSlide.slideTransition || "fade";
  const textOutline = currentSlide.textOutline || false;
  const textOutlineColor = currentSlide.textOutlineColor || "#000000";

  // Translate alignments
  const alignClass = textAlign === "left" ? "text-left items-start" : textAlign === "right" ? "text-right items-end" : "text-center items-center";
  const posClass = textPosition === "top" ? "items-start pt-16 md:pt-28" : textPosition === "bottom" ? (lowerThirdMode ? "items-end pb-8" : "items-end pb-16 md:pb-28") : "items-center";
  const weightClass = textBold ? "font-bold" : "font-normal";
  const italicClass = textItalic ? "italic" : "not-italic";
  const transformClass = textTransformValue === "none" ? "normal-case" : textTransformValue === "lower-case" ? "lowercase" : textTransformValue === "capitalize" ? "capitalize" : "uppercase";

  // Fonts Mapping
  const fontMapping: { [key: string]: string } = {
    "Cinzel": "font-cinzel",
    "Space Grotesk": "font-space",
    "Outfit": "font-outfit",
    "Playfair Display": "font-playfair",
    "JetBrains Mono": "font-mono",
    "Sans / Inter": "font-sans",
  };
  const fontClass = fontMapping[fontFamilyValue] || "font-sans";

  // Trackings Mapping
  const trackingMapping: { [key: string]: string } = {
    "tighter": "tracking-tighter",
    "tight": "tracking-tight",
    "normal": "tracking-normal",
    "wide": "tracking-wide",
    "widest": "tracking-widest"
  };
  const trackingClass = trackingMapping[textTrackingValue] || "tracking-normal";

  // Leading Line Spacing Mapping
  const spacingMapping: { [key: string]: string } = {
    "relaxed": "leading-relaxed",
    "snug": "leading-snug",
    "normal": "leading-normal",
    "loose": "leading-loose"
  };
  const spacingClass = spacingMapping[textSpacingValue] || "leading-normal";

  // Contrast Outlining & Soft Drop-Shadow multi-layer filter simulation
  const shadowValue = (() => {
    const list: string[] = [];
    const isShadowEnabled = globalTextShadowStyle === "None" ? false : (textShadow || globalTextShadowStyle !== "Default");
    
    if (isShadowEnabled) {
      if (globalTextShadowStyle === "Heavy") {
        list.push("0 8px 24px rgba(0,0,0,0.98)", "0 4px 12px rgba(0,0,0,0.95)", "0 1px 3px rgba(0,0,0,0.9)");
      } else if (globalTextShadowStyle === "Soft High-Contrast") {
        list.push("0 0 12px rgba(0,0,0,0.98)", "0 0 16px rgba(0,0,0,0.9)");
      } else {
        if (isLight) {
          list.push("0 1px 3px rgba(0,0,0,0.15)", "0 1px 2px rgba(0,0,0,0.1)");
        } else {
          list.push("0 4px 16px rgba(0,0,0,0.95)", "0 2px 4px rgba(0,0,0,0.95)");
        }
      }
    }
    if (textOutline) {
      list.push(
        `1.5px 1.5px 0px ${textOutlineColor}`,
        `-1.5px -1.5px 0px ${textOutlineColor}`,
        `1.5px -1.5px 0px ${textOutlineColor}`,
        `-1.5px 1.5px 0px ${textOutlineColor}`,
        `0px 1.5px 0px ${textOutlineColor}`,
        `0px -1.5px 0px ${textOutlineColor}`,
        `1.5px 0px 0px ${textOutlineColor}`,
        `-1.5px 0px 0px ${textOutlineColor}`
      );
    }
    return list.join(", ");
  })();

  const scaleMultiplier = globalFontSizeScale / 100;

  const textContent = currentSlide.content || "";
  const charCount = textContent.length;
  const lineCount = textContent.split("\n").length;

  let baseAutoCqw = 5.6; // Default starting auto cqw size (which scales nicely)

  if (currentSlide.type === 'lyrics') {
    if (charCount > 300 || lineCount > 7) {
      baseAutoCqw = 2.4;
    } else if (charCount > 180 || lineCount > 5) {
      baseAutoCqw = 3.2;
    } else if (charCount > 100 || lineCount > 4) {
      baseAutoCqw = 3.9;
    } else if (charCount > 50 || lineCount > 3) {
      baseAutoCqw = 4.6;
    }
  } else if (currentSlide.type === 'scripture') {
    if (charCount > 305 || lineCount > 7) {
      baseAutoCqw = 2.2;
    } else if (charCount > 180 || lineCount > 5) {
      baseAutoCqw = 3.0;
    } else if (charCount > 100 || lineCount > 4) {
      baseAutoCqw = 3.8;
    } else if (charCount > 50 || lineCount > 3) {
      baseAutoCqw = 4.5;
    }
  } else if (currentSlide.type === 'announcement') {
    if (charCount > 300 || lineCount > 7) {
      baseAutoCqw = 2.4;
    } else if (charCount > 180 || lineCount > 5) {
      baseAutoCqw = 3.2;
    } else if (charCount > 100 || lineCount > 4) {
      baseAutoCqw = 3.9;
    } else if (charCount > 50 || lineCount > 3) {
      baseAutoCqw = 4.6;
    }
  }

  if (lowerThirdMode) {
    if (charCount > 120 || lineCount > 3) {
      baseAutoCqw = 1.3;
    } else if (charCount > 60 || lineCount > 2) {
      baseAutoCqw = 1.7;
    } else {
      baseAutoCqw = 2.1;
    }
  }

  const customStyle = {
    color: textColor,
    textShadow: shadowValue || undefined,
    fontSize: fontSizeMode === "manual"
      ? `calc(${fontSize / 19.2}cqw * ${scaleMultiplier})`
      : `calc(${baseAutoCqw}cqw * ${scaleMultiplier})`,
    lineHeight: "1.25"
  };

  // Modern Dynamic Transitions Matching EasyWorship 7 Presenter slide changes
  const getMotionVariant = () => {
    if (slideTransitionValue === "none") {
      return {
        initial: { opacity: 1, y: 0, scale: 1 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0 }
      };
    }
    if (slideTransitionValue === "zoom") {
      return {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.05 },
        transition: { duration: transitionDuration, ease: "easeInOut" }
      };
    }
    if (slideTransitionValue === "slide") {
      return {
        initial: { opacity: 0, y: 50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -50 },
        transition: { duration: transitionDuration, ease: "easeOut" }
      };
    }
    // Default: "fade"
    return {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -12 },
      transition: { duration: transitionDuration, ease: "easeOut" }
    };
  };

  const motionProps = getMotionVariant();

  return (
    <div className={`relative w-screen h-screen overflow-hidden ${lowerThirdMode ? (chromaKeyColor === 'green' ? 'bg-[#00ff00]' : 'bg-transparent') : 'bg-black'} ${isLight ? 'text-zinc-900' : 'text-white'} ${fontClass} flex items-center justify-center`}>
      <div className={`relative overflow-hidden flex items-center justify-center @container ${outputResolution === '4:3' ? 'aspect-[4/3] h-full max-w-full' : 'w-full h-full'} ${lowerThirdMode ? (chromaKeyColor === 'green' ? 'bg-[#00ff00]' : 'bg-transparent') : ''}`} style={{ containerType: 'inline-size' }}>
        {/* Background with intelligent color / image / video rendering support */}
      {!lowerThirdMode && (() => {
        const rawBg = currentSlide.backgroundOverride || currentSlide.background || "";
        const bgKey = rawBg.includes("/uploads/")
          ? rawBg.substring(rawBg.indexOf("/uploads/"))
          : rawBg.includes("/backgrounds/")
          ? rawBg.substring(rawBg.indexOf("/backgrounds/"))
          : rawBg;

        return (
          <AnimatePresence mode="wait">
            <motion.div
              key={bgKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 z-0"
            >
              {(() => {
                const bg = rawBg;
                if (!bg) return null;

              const isColor = bg.startsWith("#") || bg.startsWith("rgb") || bg.startsWith("linear-gradient") || bg === "transparent";
              if (isColor) {
                return <div style={{ background: bg }} className="absolute inset-0 w-full h-full" />;
              }

              const bgOpacityVal = currentSlide.bgOpacity !== undefined ? currentSlide.bgOpacity / 100 : 0.85;
              const bgBrightnessVal = currentSlide.bgBrightness !== undefined ? currentSlide.bgBrightness / 100 : 0.8;
              const bgBlurVal = currentSlide.bgBlur !== undefined ? currentSlide.bgBlur : 0;
              const bgFitVal = currentSlide.bgFit || 'cover';
              const bgScaleVal = currentSlide.bgScale !== undefined ? currentSlide.bgScale / 100 : 1;
              const bgPositionXVal = currentSlide.bgPositionX !== undefined ? currentSlide.bgPositionX : 0;
              const bgPositionYVal = currentSlide.bgPositionY !== undefined ? currentSlide.bgPositionY : 0;

              return isVideo(bg) ? (
                <AutoPlayingVideo
                  src={resolveMedia(bg)}
                  className="w-full h-full"
                  style={{
                    opacity: bgOpacityVal,
                    objectFit: bgFitVal as any,
                    objectPosition: `${50 + bgPositionXVal}% ${50 + bgPositionYVal}%`,
                    filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                    transform: `scale(${bgScaleVal})`,
                  }}
                />
              ) : (
                <img
                  src={resolveMedia(bg)}
                  alt="bg"
                  className="w-full h-full"
                  style={{
                    opacity: bgOpacityVal,
                    objectFit: bgFitVal as any,
                    objectPosition: `${50 + bgPositionXVal}% ${50 + bgPositionYVal}%`,
                    filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                    transform: `scale(${bgScaleVal})`,
                  }}
                  referrerPolicy="no-referrer"
                />
              );
            })()}
            <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-white/10 via-transparent to-white/5' : 'from-black/85 via-transparent to-black/45'}`} />
          </motion.div>
        </AnimatePresence>
        );
      })()}

      {/* Shape Decorations Overlay */}
      {currentSlide.shapeDecoration === 'bottom-bar' && (
        <div className="absolute bottom-6 left-6 right-6 bg-black/80 backdrop-blur-md border border-zinc-800 rounded-xl h-24 z-[5] pointer-events-none" />
      )}
      {currentSlide.shapeDecoration === 'left-accent' && (
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-cyan-500 z-[5] pointer-events-none" />
      )}
      {currentSlide.shapeDecoration === 'brackets' && (
        <>
          <div className="absolute left-6 top-6 bottom-6 w-8 border-t-2 border-b-2 border-l-2 border-cyan-400 z-[5] pointer-events-none opacity-80" />
          <div className="absolute right-6 top-6 bottom-6 w-8 border-t-2 border-b-2 border-r-2 border-cyan-400 z-[5] pointer-events-none opacity-80" />
        </>
      )}
      {currentSlide.shapeDecoration === 'thin-frame' && (
        <div className="absolute inset-6 border border-zinc-500/40 z-[5] pointer-events-none" />
      )}
      {currentSlide.shapeDecoration === 'glow-rect' && (
        <div className="absolute inset-x-20 inset-y-12 bg-zinc-950/60 blur-2xl rounded-2xl z-[2] pointer-events-none" />
      )}

      {/* Custom Left & Right Logo overlay */}
      {currentSlide.logoLeftUrl && (
        <div className="absolute top-6 md:top-10 left-6 md:left-10 z-[15] pointer-events-none">
          <img 
            src={resolveMedia(currentSlide.logoLeftUrl)} 
            alt="Left Logo" 
            className="w-22 h-22 md:w-32 md:h-32 object-contain rounded-xl drop-shadow-md" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {currentSlide.logoRightUrl && (
        <div className="absolute top-6 md:top-10 right-6 md:right-10 z-[15] pointer-events-none">
          <img 
            src={resolveMedia(currentSlide.logoRightUrl)} 
            alt="Right Logo" 
            className="w-22 h-22 md:w-32 md:h-32 object-contain rounded-xl drop-shadow-md" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {!currentSlide.logoLeftUrl && !currentSlide.logoRightUrl && currentSlide.logoUrl && (
        <div 
          className={`absolute top-6 md:top-10 z-[15] pointer-events-none ${currentSlide.logoPosition === 'left' ? 'left-6 md:left-10' : 'right-6 md:right-10'}`}
        >
          <img 
            src={resolveMedia(currentSlide.logoUrl)} 
            alt="Slide Logo" 
            className="w-22 h-22 md:w-32 md:h-32 object-contain rounded-xl drop-shadow-md" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Content flex wrapper to position top/center/bottom & left/center/right */}
      <div 
        style={lowerThirdMode ? {} : {
          width: `${textWidth}%`,
          height: `${textHeight}%`,
          left: `${textLeft}%`,
          top: `${textTop}%`,
          position: 'absolute',
        }}
        className={lowerThirdMode 
          ? `absolute inset-0 z-10 flex p-6 md:p-12 pb-6 ${posClass} ${textAlign === 'left' ? 'justify-start' : textAlign === 'right' ? 'justify-end' : 'justify-center'}` 
          : `z-10 flex flex-col justify-center ${alignClass}`
        }
      >
        <div className={lowerThirdMode ? `w-full max-w-[90%] flex flex-col ${alignClass}` : "w-full h-full flex flex-col justify-center"}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.content + currentSlide.type}
              {...motionProps}
              className="w-full"
            >
              {currentSlide.type === 'lyrics' && currentSlide.content && (
                <div className={lowerThirdMode ? "bg-black/75 backdrop-blur-md px-10 py-5 rounded-2xl shadow-xl w-full text-center border border-white/10" : "w-full"}>
                  <h1 
                    style={customStyle}
                    className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line px-4`}
                  >
                    {currentSlide.content}
                  </h1>
                </div>
              )}

              {currentSlide.type === 'scripture' && (currentSlide.content || currentSlide.title) && (
                <div className={`flex flex-col ${textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'} ${lowerThirdMode ? "bg-black/75 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/10 w-full text-center" : "w-full"}`}>
                  {currentSlide.content && !lowerThirdMode && <div className={`w-16 h-1 ${isLight ? 'bg-blue-700' : 'bg-blue-500'} mb-8 rounded-full`} />}
                  <p 
                    style={customStyle}
                    className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line ${lowerThirdMode ? 'mb-2' : 'mb-12'}`}
                  >
                    "{currentSlide.content}"
                  </p>
                  {currentSlide.title && (
                    <div className="flex items-center gap-4">
                      {!lowerThirdMode && <div className={`h-px w-8 ${isLight ? 'bg-black/15' : 'bg-white/20'}`} />}
                      <p 
                        style={{
                          color: isLight && !lowerThirdMode ? '#1e3a8a' : '#60a5fa',
                          textShadow: isLight && !lowerThirdMode ? '0 1px 2px rgba(255,255,255,0.8)' : '0 2px 8px rgba(0,0,0,0.95)',
                          ...(lowerThirdMode ? { fontSize: '14px' } : {})
                        }}
                        className={lowerThirdMode ? `text-xs font-black uppercase tracking-widest text-blue-400 ${fontClass}` : `text-xl md:text-3xl font-black uppercase tracking-widest ${fontClass}`}
                      >
                        {currentSlide.title}
                      </p>
                      {!lowerThirdMode && <div className={`h-px w-8 ${isLight ? 'bg-black/15' : 'bg-white/20'}`} />}
                    </div>
                  )}
                </div>
              )}

              {currentSlide.type === 'announcement' && (currentSlide.content || currentSlide.title) && (
                <div className={`w-full ${lowerThirdMode ? "bg-black/75 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/10 text-center" : ""}`}>
                  {currentSlide.title && <h2 className={`${lowerThirdMode ? 'text-xs md:text-sm mb-1 text-blue-400 font-bold' : 'text-2xl md:text-4xl font-light mb-4'} tracking-tighter opacity-70 uppercase ${fontClass}`}>{currentSlide.title}</h2>}
                  {currentSlide.content && (
                    <p 
                      style={customStyle}
                      className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line`}
                    >
                      {currentSlide.content}
                    </p>
                  )}
                </div>
              )}

              {currentSlide.type === 'logo' && (
                <div className="flex items-center justify-center w-full h-full max-h-[85vh] max-w-[85vw] mx-auto">
                  <AppLogo className="w-[85vw] h-[85vh] max-w-full max-h-full drop-shadow-[0_25px_60px_rgba(0,0,0,0.9)]" showText={false} />
                </div>
              )}

              {currentSlide.type === 'qr' && (() => {
                const urlAcc = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("account") || "") : "";
                const projectorQrUrl = getPublicUrl(`/projector?mode=share${urlAcc ? `&account=${urlAcc}` : ""}`);
                return (
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-10 bg-white rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)] mb-8">
                      <QRCodeSVG 
                        value={projectorQrUrl} 
                        size={400}
                        level="Q"
                        includeMargin={true}
                      />
                    </div>
                    <p className="text-2xl md:text-4xl font-bold text-white/80 tracking-tight text-center max-w-2xl px-6">
                      Scan QR code ini untuk melihat slide langsung di handphone
                    </p>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      </div>

    </div>
  );
}
