import { useEffect, useState, useCallback, useRef, CSSProperties } from "react";
import { useSocket } from "../../hooks/useSocket";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Clock, QrCode, RefreshCw, X, Check, AlertTriangle, PowerOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppLogo } from "../Logo";
import { Html5Qrcode } from "html5-qrcode";
import { extractMediaPath, getAllMedia } from "../../lib/indexedDbMedia";
import { getPublicUrl } from "../../lib/projectorUtils";
import { getActiveAccountId } from "../../lib/accountManager";
import { isLocalOrUploadMedia } from "../../lib/cloudSync";
import {
  getSlideTransitionMotion,
  getTextLineMotionVariant,
} from "../../lib/slideAnimations";
import { CameraFeed } from "../CameraFeed";

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
         cleanUrl.endsWith('.mov') ||
         cleanUrl.endsWith('.m4v') ||
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

function AutoPlayingVideo({
  src,
  style,
  className,
  onMediaError,
}: {
  src: string;
  style?: CSSProperties;
  className?: string;
  onMediaError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    const video = videoRef.current;
    if (!video || !src) return;

    // Force muted and iOS inline attributes cleanly
    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

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

  if (!src || hasError) return null;

  return (
    <video
      key={src}
      ref={videoRef}
      src={src}
      muted
      autoPlay
      loop
      playsInline
      onError={() => {
        setHasError(true);
        onMediaError?.();
      }}
      className={className}
      style={style}
    />
  );
}

function SafeBackgroundImage({
  src,
  style,
  className,
  onMediaError,
}: {
  src: string;
  style?: CSSProperties;
  className?: string;
  onMediaError?: () => void;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) return null;

  return (
    <img
      key={src}
      src={src}
      alt="bg"
      className={className}
      onError={() => {
        setHasError(true);
        onMediaError?.();
      }}
      style={style}
      referrerPolicy="no-referrer"
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
  const { currentSlide, currentShift, syncedSettings, mediaUpdateTick, requestCloudMedia, operatorStatus, pingOperator } = useSocket();
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const prevBlobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    const loadIndexedDBMedia = async () => {
      try {
        const list = await getAllMedia();
        if (!active) return;
        const mapping: Record<string, string> = {};
        const createdUrls: string[] = [];
        list.forEach((item) => {
          try {
            let localUrl = "";
            if (item.file instanceof Blob && item.file.size > 0) {
              localUrl = URL.createObjectURL(item.file);
              createdUrls.push(localUrl);
            }
            if (!localUrl) return;

            mapping[item.id] = localUrl;
            const cleanPath = extractMediaPath(item.id);
            if (cleanPath) {
              mapping[cleanPath] = localUrl;
              const filename = cleanPath.substring(cleanPath.lastIndexOf("/") + 1);
              if (filename) mapping[filename] = localUrl;
            }
          } catch (itemErr) {
            console.warn("Skipped malformed IndexedDB media item:", item?.id, itemErr);
          }
        });
        const oldUrls = prevBlobUrlsRef.current;
        prevBlobUrlsRef.current = createdUrls;
        setMediaUrls(mapping);
        if (oldUrls.length > 0) {
          window.setTimeout(() => {
            oldUrls.forEach((u) => URL.revokeObjectURL(u));
          }, 500);
        }
      } catch (err) {
        console.error("Failed to load IndexedDB media in ProjectorDisplay:", err);
      }
    };
    loadIndexedDBMedia();
    return () => {
      active = false;
    };
  }, [mediaUpdateTick]);

  useEffect(() => {
    return () => {
      prevBlobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      prevBlobUrlsRef.current = [];
    };
  }, []);

  // Automatically request any missing local/uploaded background or logo media over cloud sync
  useEffect(() => {
    if (!currentSlide) return;
    const candidates = [
      currentSlide.backgroundOverride,
      currentSlide.background,
      currentSlide.logoUrl,
      currentSlide.logoLeftUrl,
      currentSlide.logoRightUrl,
    ].filter((u): u is string => Boolean(u && isLocalOrUploadMedia(u)));

    for (const url of candidates) {
      const cleanPath = extractMediaPath(url);
      const filename = cleanPath.split("/").pop() || "";
      if (!mediaUrls[url] && !mediaUrls[cleanPath] && !(filename && mediaUrls[filename])) {
        requestCloudMedia(cleanPath || url);
      }
    }
  }, [currentSlide, mediaUrls, requestCloudMedia]);

  const resolveMedia = useCallback((url?: string) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;

    // Normalize path first so IndexedDB cache matches regardless of origin or blob prefix
    const cleanPath = extractMediaPath(url);
    if (mediaUrls[url]) return mediaUrls[url];
    if (cleanPath && mediaUrls[cleanPath]) return mediaUrls[cleanPath];
    const filename = cleanPath.split("/").pop();
    if (filename && mediaUrls[filename]) return mediaUrls[filename];

    // Handle blob: URLs that weren't in mediaUrls
    if (url.startsWith("blob:")) {
      const stripped = url.replace(/^blob:/, "");
      if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
        url = stripped;
      }
    }

    let processedUrl = url;

    // Dynamic origin resolution for uploaded backgrounds and assets
    if (url.includes("/local-media/")) {
      return cleanPath;
    } else if (url.includes("/uploads/") || url.includes("/backgrounds/")) {
      if (cleanPath.startsWith("/")) {
        processedUrl = window.location.origin + cleanPath;
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

  // Distinguish dedicated OBS Live Output mode vs Mobile Share mode vs Fullscreen Projector
  const urlMode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mode") : null;
  const isObsMode = typeof window !== "undefined" && (
    urlMode === "obs" || new URLSearchParams(window.location.search).get("obs") === "1"
  );
  const isMobileShare = !isObsMode && urlMode === "share";
  
  const [isSessionValid, setIsSessionValid] = useState(() => {
    if (typeof window === "undefined") return true;
    
    // OBS & Projector modes connect directly to Live Output without Mobile Share session locks
    const params = new URLSearchParams(window.location.search);
    const isShare = params.get("mode") === "share" && params.get("obs") !== "1";
    
    if (!isShare) return true;

    // The user opened this screen through the official shared link or QR code
    sessionStorage.setItem("cp_scanned_qr_active", "true");

    // Retrieve active shift state from localStorage synchronously
    let initialShift: any = null;
    try {
      const saved = localStorage.getItem('cp_current_shift');
      if (saved) initialShift = JSON.parse(saved);
    } catch {}

    if (initialShift?.name) {
      sessionStorage.setItem("cp_scanned_shift_name", initialShift.name);
    }

    // When shift is inactive/disabled, mobile share is running as usual without lock
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

    return true;
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
      let serverShift = null;
      try {
        const res = await fetch(`/api/current-shift?account=${encodeURIComponent(targetAcc)}`);
        const ct = res.headers.get("content-type");
        if (res.ok && ct && ct.includes("application/json")) {
          serverShift = await res.json();
        }
      } catch (err) {
        console.warn("Could not fetch server shift, using local/socket shift fallback:", err);
      }

      const activeShift = (serverShift && serverShift.active)
        ? serverShift
        : (currentShift && currentShift.active ? currentShift : null);

      setScanFeedbackMsg("Koneksi berhasil! Menghubungkan...");
      
      sessionStorage.setItem("cp_scanned_qr_active", "true");
      if (activeShift?.name) {
        sessionStorage.setItem("cp_scanned_shift_name", activeShift.name);
      }
      
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
      }, 1000);
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
      // 1. If no shift is active at all, run normally without locking
      if (!currentShift || !currentShift.active) {
        setIsShiftEnded(false);
        setIsSessionValid(true);
        return;
      }

      // Auto-set session for this shift if user opened via mobile share link
      if (!sessionStorage.getItem("cp_scanned_shift_name") && currentShift.name) {
        sessionStorage.setItem("cp_scanned_qr_active", "true");
        sessionStorage.setItem("cp_scanned_shift_name", currentShift.name);
      }

      // 2. Check ending time
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      
      const [endH, endM] = (currentShift.endTime || "").split(":").map(Number);
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
      setIsSessionValid(true);
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

  const [cameraBgEnabled, setCameraBgEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("cp_settings_camera_bg_enabled") === "true";
    } catch {
      return false;
    }
  });

  const [cameraBgDeviceId, setCameraBgDeviceId] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_camera_bg_device_id") || "";
    } catch {
      return "";
    }
  });

  const [cameraBgLabel, setCameraBgLabel] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_settings_camera_bg_label") || "";
    } catch {
      return "";
    }
  });

  const [cameraBgMirror, setCameraBgMirror] = useState<boolean>(() => {
    try {
      return localStorage.getItem("cp_settings_camera_bg_mirror") === "true";
    } catch {
      return false;
    }
  });

  const [cameraBgBrightness, setCameraBgBrightness] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cp_settings_camera_bg_brightness");
      return saved ? parseInt(saved, 10) : 85;
    } catch {
      return 85;
    }
  });

  const [cameraBgOpacity, setCameraBgOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cp_settings_camera_bg_opacity");
      return saved ? parseInt(saved, 10) : 100;
    } catch {
      return 100;
    }
  });

  const [cameraBgBlur, setCameraBgBlur] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cp_settings_camera_bg_blur");
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [cameraBgFit, setCameraBgFit] = useState<"cover" | "contain">(() => {
    try {
      return localStorage.getItem("cp_settings_camera_bg_fit") === "contain"
        ? "contain"
        : "cover";
    } catch {
      return "cover";
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
        setCameraBgEnabled(localStorage.getItem("cp_settings_camera_bg_enabled") === "true");
        setCameraBgDeviceId(localStorage.getItem("cp_settings_camera_bg_device_id") || "");
        setCameraBgLabel(localStorage.getItem("cp_settings_camera_bg_label") || "");
        setCameraBgMirror(localStorage.getItem("cp_settings_camera_bg_mirror") === "true");
        const savedCamBright = localStorage.getItem("cp_settings_camera_bg_brightness");
        setCameraBgBrightness(savedCamBright ? parseInt(savedCamBright, 10) : 85);
        const savedCamOp = localStorage.getItem("cp_settings_camera_bg_opacity");
        setCameraBgOpacity(savedCamOp ? parseInt(savedCamOp, 10) : 100);
        const savedCamBlur = localStorage.getItem("cp_settings_camera_bg_blur");
        setCameraBgBlur(savedCamBlur ? parseInt(savedCamBlur, 10) : 0);
        setCameraBgFit(localStorage.getItem("cp_settings_camera_bg_fit") === "contain" ? "contain" : "cover");
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!syncedSettings) return;
    if (syncedSettings.outputResolution) setOutputResolution(syncedSettings.outputResolution);
    if (syncedSettings.transitionDuration !== undefined) setTransitionDuration(syncedSettings.transitionDuration);
    if (syncedSettings.globalFontFamily) setGlobalFontFamily(syncedSettings.globalFontFamily);
    if (syncedSettings.globalTextTransform) setGlobalTextTransform(syncedSettings.globalTextTransform);
    if (syncedSettings.lowerThirdMode !== undefined) setLowerThirdMode(syncedSettings.lowerThirdMode);
    if (syncedSettings.globalFontSizeScale !== undefined) setGlobalFontSizeScale(syncedSettings.globalFontSizeScale);
    if (syncedSettings.globalTextShadowStyle) setGlobalTextShadowStyle(syncedSettings.globalTextShadowStyle);
    if (syncedSettings.chromaKeyColor) setChromaKeyColor(syncedSettings.chromaKeyColor);
    if (syncedSettings.cameraBgEnabled !== undefined) setCameraBgEnabled(syncedSettings.cameraBgEnabled);
    if (syncedSettings.cameraBgDeviceId !== undefined) setCameraBgDeviceId(syncedSettings.cameraBgDeviceId);
    if (syncedSettings.cameraBgLabel !== undefined) setCameraBgLabel(syncedSettings.cameraBgLabel);
    if (syncedSettings.cameraBgMirror !== undefined) setCameraBgMirror(syncedSettings.cameraBgMirror);
    if (syncedSettings.cameraBgBrightness !== undefined) setCameraBgBrightness(syncedSettings.cameraBgBrightness);
    if (syncedSettings.cameraBgOpacity !== undefined) setCameraBgOpacity(syncedSettings.cameraBgOpacity);
    if (syncedSettings.cameraBgBlur !== undefined) setCameraBgBlur(syncedSettings.cameraBgBlur);
    if (syncedSettings.cameraBgFit !== undefined) setCameraBgFit(syncedSettings.cameraBgFit);
  }, [syncedSettings]);

  // Keep root html/body transparent ONLY in OBS Mode (never in Mobile Share or normal Projector)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obsCanvasTransparent =
      isObsMode && !isMobileShare && chromaKeyColor !== "green" && !cameraBgEnabled;
    document.documentElement.classList.toggle("obs-transparent-root", obsCanvasTransparent);
    return () => {
      document.documentElement.classList.remove("obs-transparent-root");
    };
  }, [isObsMode, isMobileShare, chromaKeyColor, cameraBgEnabled]);

  useEffect(() => {
    if (currentSlide) {
      console.log("Projector received slide:", currentSlide.type, currentSlide.title);
    }
  }, [currentSlide]);

  const renderScannerModal = () => {
    return (
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 bg-[#000000]/95 backdrop-blur-xl z-50 flex flex-col justify-between p-6 overflow-y-auto font-sans text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between py-2 border-b border-[#27272a]/80">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2 rounded-md bg-[#141417] border border-[#cca000]/45 text-[#f5cc00] text-[9px] font-mono font-bold uppercase tracking-widest">
                  Security Portal
                </span>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Otentikasi Perangkat</h3>
              </div>
              <button
                onClick={closeScanner}
                className="p-1.5 rounded-lg bg-[#09090b] hover:bg-[#141417] border border-[#27272a] text-slate-300 hover:text-[#f5cc00] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Main Content */}
            <div className="my-auto py-6 flex flex-col items-center">
              <div className="flex flex-col items-center">
                {/* Camera Container Frame */}
                <div className="relative w-[280px] h-[280px] rounded-3xl overflow-hidden border border-[#27272a] bg-[#09090b] flex flex-col items-center justify-center shadow-2xl">
                  <span className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#f5cc00] rounded-tl-lg pointer-events-none z-10" />
                  <span className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#f5cc00] rounded-tr-lg pointer-events-none z-10" />
                  <span className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#f5cc00] rounded-bl-lg pointer-events-none z-10" />
                  <span className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#f5cc00] rounded-br-lg pointer-events-none z-10" />
                  
                  {!scannerLoading && !scanFeedbackMsg && !scannerError && (
                    <div className="absolute left-0 right-0 h-0.5 bg-[#f5cc00]/80 shadow-[0_0_8px_rgba(245,204,0,0.55)] animate-[bounce_2s_infinite] pointer-events-none z-10" />
                  )}

                  <div id="qr-reader-target" className="w-[280px] h-[280px] object-cover" />
                  
                  {scannerLoading && (
                    <div className="absolute inset-0 bg-[#000000]/85 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-[#f5cc00] border-t-transparent animate-spin" />
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[#f5cc00]">Memuat Kamera...</p>
                    </div>
                  )}

                  {scanFeedbackMsg && (
                    <div className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center p-6 text-center z-20 font-sans">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mb-3">
                        <Check className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-100 uppercase tracking-wider">{scanFeedbackMsg}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-4 max-w-xs text-center leading-normal font-sans">
                  Arahkan kamera belakang ponsel ke QR Code Church Presenter yang dicetak atau ditampilkan di depan.
                </p>
              </div>

              {/* Validation Error Message Box */}
              {scannerError && (
                <div className="mt-6 w-full max-w-xs p-3.5 bg-rose-500/[0.08] border border-rose-500/25 rounded-2xl flex items-start gap-3 text-rose-300 text-left font-sans">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Koneksi Gagal</h5>
                    <p className="text-[11px] leading-relaxed mt-0.5 text-slate-300">{scannerError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-[8px] text-slate-400 font-bold uppercase tracking-widest border-t border-[#27272a]/80 pt-4">
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
      <div className="bg-[#000000] w-screen h-screen flex flex-col items-center justify-center text-slate-100 font-sans p-6 text-center">
        <div className="border border-[#27272a] bg-[#09090b]/95 p-8 rounded-3xl max-w-sm flex flex-col items-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-5 text-rose-400">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100 mb-2">Shift Ibadah Berakhir</h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            Waktu operasional shift ibadah ({currentShift?.name || "Aktif"}) telah selesai. Tampilan mobile share telah dinonaktifkan secara otomatis.
          </p>
          <div className="text-[10px] text-[#cca000] font-mono uppercase tracking-widest border-t border-[#27272a] pt-4 w-full">
            Church Presenter Cloud Sync
          </div>
        </div>
      </div>
    );
  }

  if (isMobileShare && !isSessionValid) {
    return (
      <div className="bg-[#000000] w-screen h-screen flex flex-col items-center justify-center text-slate-100 font-sans p-6 text-center">
        {renderScannerModal()}
        <div className="border border-[#27272a] bg-[#09090b]/95 p-8 rounded-3xl max-w-sm flex flex-col items-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#141417] border border-[#cca000]/45 flex items-center justify-center mb-5 text-[#f5cc00]">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100 mb-2">Akses Terkunci</h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            Shift ibadah ({currentShift?.name || "Aktif"}) sedang berlangsung dengan pembatasan keamanan. Silakan pindai QR Code resmi dari layar operator untuk mengakses.
          </p>
          <button
            onClick={openScanner}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#f5cc00] hover:bg-[#ffd60a] text-[#000000] font-black text-xs uppercase tracking-widest transition-all shadow-[0_8px_24px_rgba(245,204,0,0.22)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Pindai QR Code Ibadah
          </button>
        </div>
      </div>
    );
  }

  const isExplicitOfflineSlide =
    currentSlide?.content === "System Offline" && currentSlide?.isLive === false;

  const isSystemChecking =
    isMobileShare &&
    operatorStatus === null &&
    !isExplicitOfflineSlide;

  const isSystemInactive =
    isMobileShare &&
    (operatorStatus !== null
      ? !operatorStatus.active || !operatorStatus.isLive
      : isExplicitOfflineSlide);

  if (isSystemChecking) {
    return (
      <div className="bg-[#000000] w-screen h-screen flex flex-col items-center justify-center text-slate-100 font-sans p-6 text-center">
        <div className="border border-[#27272a] bg-[#09090b]/95 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#141417] border border-[#cca000]/45 flex items-center justify-center mb-5 text-[#f5cc00]">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100 mb-2">
            Menghubungkan...
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Memeriksa status layanan ibadah aktif.
          </p>
        </div>
      </div>
    );
  }

  if (isSystemInactive) {
    return (
      <div className="bg-[#000000] w-screen h-screen flex flex-col items-center justify-center text-slate-100 font-sans p-6 text-center">
        <div className="border border-[#27272a] bg-[#09090b]/95 p-8 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#141417] border border-[#cca000]/35 flex items-center justify-center mb-5 text-[#cca000]">
            <PowerOff className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100 mb-2">
            System Nonaktif
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            System nonaktif, tidak ada ibadah terdeteksi.
          </p>
          <button
            type="button"
            onClick={() => pingOperator()}
            className="w-full py-3 px-5 rounded-xl bg-[#141417] hover:bg-[#202024] border border-[#cca000]/45 text-[#f5cc00] font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer mb-4"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#f5cc00]" />
            Periksa Ulang
          </button>
          <div className="text-[10px] text-[#cca000] font-mono uppercase tracking-widest border-t border-[#27272a] pt-4 w-full">
            Church Presenter Cloud Sync
          </div>
        </div>
      </div>
    );
  }

  const isExplicitlyOffline =
    Boolean(currentSlide) &&
    (currentSlide?.isLive === false ||
      (currentSlide?.content === "System Offline" && currentSlide?.isLive === false));

  const isObsStandby =
    isObsMode &&
    (isExplicitlyOffline || (!currentSlide && !(cameraBgEnabled && chromaKeyColor !== "green")));

  if (isObsStandby) {
    return (
      <div
        className={`w-screen h-screen overflow-hidden ${
          chromaKeyColor === "green" ? "bg-[#00ff00]" : "bg-transparent"
        }`}
      />
    );
  }

  if (!currentSlide || (isMobileShare && isExplicitOfflineSlide && operatorStatus?.active && operatorStatus?.isLive)) {
    if (!isMobileShare && cameraBgEnabled && chromaKeyColor !== "green") {
      return (
        <div className="relative w-screen h-screen overflow-hidden bg-black">
          <CameraFeed
            deviceId={cameraBgDeviceId}
            deviceLabel={cameraBgLabel}
            mirror={cameraBgMirror}
            fit={cameraBgFit}
            brightness={cameraBgBrightness}
            opacity={cameraBgOpacity}
            blur={cameraBgBlur}
            className="absolute inset-0 w-full h-full"
            showErrorFallback={!isObsMode}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25 pointer-events-none" />
        </div>
      );
    }

    return (
      <div className="bg-[#000000] w-screen h-screen flex flex-col items-center justify-center text-white/30 font-sans p-10 md:p-20">
        <div className="border border-[#27272a] p-12 rounded-3xl flex flex-col items-center bg-[#09090b]/70 backdrop-blur-md">
          <AppLogo className="w-40 h-40 mb-8" showText={false} />
          <h1 className="text-2xl md:text-3xl font-black tracking-[0.2em] uppercase mb-3 text-slate-100">Church Presenter</h1>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#f5cc00]/75 to-transparent mb-6" />
          <p className="text-xs md:text-sm font-mono tracking-[0.45em] text-[#cca000] uppercase">Waiting for Signal</p>
        </div>
      </div>
    );
  }

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
  const textAnimationValue = currentSlide.textAnimation || "none";
  const animationSpeedValue = currentSlide.animationSpeed || "normal";
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

  const motionProps = getSlideTransitionMotion(
    slideTransitionValue,
    transitionDuration,
    animationSpeedValue,
  );

  const slideRenderKey = `${lowerThirdMode ? "lt" : "fs"}-${currentSlide.parentId || ""}-${currentSlide.slideIdx ?? ""}-${currentSlide.title || ""}-${currentSlide.content || ""}-${currentSlide.type}-${slideTransitionValue}-${textAnimationValue}-${animationSpeedValue}`;

  const renderAnimatedLines = (rawText: string, wrapQuotes = false) => {
    const formatted = wrapQuotes ? `"${rawText}"` : rawText;
    if (!textAnimationValue || textAnimationValue === "none") {
      return formatted;
    }
    const lines = formatted.split("\n");
    return lines.map((line, idx) => {
      const lineMotion = getTextLineMotionVariant(
        textAnimationValue,
        idx,
        lowerThirdMode ? Math.min(0.65, Math.max(0.35, transitionDuration)) : Math.max(0.6, transitionDuration),
        animationSpeedValue,
      );
      if (!lineMotion) {
        return (
          <span key={idx} className="block">
            {line || "\u00A0"}
          </span>
        );
      }
      return (
        <motion.span
          key={`${slideRenderKey}-${idx}`}
          initial={lineMotion.initial}
          animate={lineMotion.animate}
          transition={lineMotion.transition}
          style={{ display: "block", transformOrigin: "center bottom" }}
        >
          {line || "\u00A0"}
        </motion.span>
      );
    });
  };

  const rawSlideBg = (currentSlide.backgroundOverride || currentSlide.background || "").trim();
  const isEmptyOrBlackBg =
    !rawSlideBg ||
    rawSlideBg.toLowerCase() === "#000000" ||
    rawSlideBg.toLowerCase() === "#000" ||
    rawSlideBg.toLowerCase() === "transparent";
  const isObsChromaActive = isObsMode && !isMobileShare;
  const shouldUseCameraBackground =
    !isMobileShare && cameraBgEnabled && (!isObsChromaActive || chromaKeyColor !== "green");
  const shouldShowObsDirectTransparent =
    !shouldUseCameraBackground &&
    isObsChromaActive &&
    ((lowerThirdMode && chromaKeyColor !== "green") ||
      (chromaKeyColor === "transparent" && isEmptyOrBlackBg));
  const shouldShowObsGreenKey =
    !shouldUseCameraBackground &&
    isObsChromaActive &&
    chromaKeyColor === "green" &&
    (lowerThirdMode || isEmptyOrBlackBg);
  const outerCanvasBgClass = shouldShowObsGreenKey
    ? "bg-[#00ff00]"
    : shouldShowObsDirectTransparent
      ? "bg-transparent"
      : "bg-black";

  return (
    <div className={`slide-canvas-preserve relative w-screen h-screen overflow-hidden ${outerCanvasBgClass} ${isLight && !shouldUseCameraBackground && !shouldShowObsDirectTransparent && !shouldShowObsGreenKey ? 'text-zinc-900' : 'text-white'} ${fontClass} flex items-center justify-center`}>
      <div className={`relative overflow-hidden flex items-center justify-center @container ${outputResolution === '4:3' ? 'aspect-[4/3] h-full max-w-full' : 'w-full h-full'} ${shouldShowObsGreenKey ? 'bg-[#00ff00]' : shouldShowObsDirectTransparent ? 'bg-transparent' : 'bg-black'}`} style={{ containerType: 'inline-size' }}>
        {/* Live Camera Device Background (when enabled for OBS or Live Output) */}
        {shouldUseCameraBackground && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <CameraFeed
              deviceId={cameraBgDeviceId}
              deviceLabel={cameraBgLabel}
              mirror={cameraBgMirror}
              fit={cameraBgFit}
              brightness={cameraBgBrightness}
              opacity={cameraBgOpacity}
              blur={cameraBgBlur}
              className="w-full h-full"
              showErrorFallback={!isObsMode}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/35 pointer-events-none" />
          </div>
        )}

        {/* Standard Image / Video / Color Background */}
      {!shouldUseCameraBackground && !shouldShowObsDirectTransparent && !shouldShowObsGreenKey && (() => {
        const rawBg = currentSlide.backgroundOverride || currentSlide.background || "";
        const bgKey = extractMediaPath(rawBg) || rawBg;
        const resolvedBgSrc = resolveMedia(rawBg);

        const bgContent = (
          <>
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
                  src={resolvedBgSrc}
                  onMediaError={() => {
                    if (isLocalOrUploadMedia(bg) || bg.includes("/backgrounds/")) {
                      requestCloudMedia(bg);
                    }
                  }}
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
                <SafeBackgroundImage
                  src={resolvedBgSrc}
                  onMediaError={() => {
                    if (isLocalOrUploadMedia(bg) || bg.includes("/backgrounds/")) {
                      requestCloudMedia(bg);
                    }
                  }}
                  className="w-full h-full"
                  style={{
                    opacity: bgOpacityVal,
                    objectFit: bgFitVal as any,
                    objectPosition: `${50 + bgPositionXVal}% ${50 + bgPositionYVal}%`,
                    filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                    transform: `scale(${bgScaleVal})`,
                  }}
                />
              );
            })()}
            <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-white/10 via-transparent to-white/5' : 'from-black/85 via-transparent to-black/45'}`} />
          </>
        );

        if (isObsMode) {
          return (
            <motion.div
              key={bgKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 z-0"
            >
              {bgContent}
            </motion.div>
          );
        }

        return (
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={bgKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-0"
            >
              {bgContent}
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
        <div className={lowerThirdMode ? `w-full max-w-[90%] flex flex-col ${alignClass}` : "relative w-full h-full flex flex-col justify-center"}>
          {(() => {
            const lowerThirdBoxClass =
              "bg-[#09090b]/92 px-8 md:px-10 py-4 md:py-5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.88)] border border-white/15 w-full";
            const slideContentBody = (
              <div style={slideTransitionValue === "flip" ? { perspective: 1000 } : undefined} className="w-full">
              {currentSlide.type === 'lyrics' && currentSlide.content && (
                <div className={lowerThirdMode ? `${lowerThirdBoxClass} text-center` : "w-full"}>
                  <h1 
                    style={customStyle}
                    className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line px-4`}
                  >
                    {renderAnimatedLines(currentSlide.content)}
                  </h1>
                </div>
              )}

              {currentSlide.type === 'scripture' && (currentSlide.content || currentSlide.title) && (
                <div className={`flex flex-col ${textAlign === 'left' ? 'items-start' : textAlign === 'right' ? 'items-end' : 'items-center'} ${lowerThirdMode ? `${lowerThirdBoxClass} text-center` : "w-full"}`}>
                  {currentSlide.content && !lowerThirdMode && <div className={`w-16 h-1 ${isLight && !shouldUseCameraBackground ? 'bg-blue-700' : 'bg-blue-500'} mb-8 rounded-full`} />}
                  <p 
                    style={customStyle}
                    className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line ${lowerThirdMode ? 'mb-2' : 'mb-12'}`}
                  >
                    {renderAnimatedLines(currentSlide.content, true)}
                  </p>
                  {currentSlide.title && (
                    <div className="flex items-center gap-4">
                      {!lowerThirdMode && <div className={`h-px w-8 ${isLight && !shouldUseCameraBackground ? 'bg-black/15' : 'bg-white/20'}`} />}
                      <p 
                        style={{
                          color: isLight && !lowerThirdMode && !shouldUseCameraBackground ? '#1e3a8a' : '#60a5fa',
                          textShadow: isLight && !lowerThirdMode && !shouldUseCameraBackground ? '0 1px 2px rgba(255,255,255,0.8)' : '0 2px 8px rgba(0,0,0,0.95)',
                          ...(lowerThirdMode ? { fontSize: '14px' } : {})
                        }}
                        className={lowerThirdMode ? `text-xs font-black uppercase tracking-widest text-blue-400 ${fontClass}` : `text-xl md:text-3xl font-black uppercase tracking-widest ${fontClass}`}
                      >
                        {currentSlide.title}
                      </p>
                      {!lowerThirdMode && <div className={`h-px w-8 ${isLight && !shouldUseCameraBackground ? 'bg-black/15' : 'bg-white/20'}`} />}
                    </div>
                  )}
                </div>
              )}

              {currentSlide.type === 'announcement' && (currentSlide.content || currentSlide.title) && (
                <div className={`w-full ${lowerThirdMode ? `${lowerThirdBoxClass} text-center` : ""}`}>
                  {currentSlide.title && <h2 className={`${lowerThirdMode ? 'text-xs md:text-sm mb-1 text-blue-400 font-bold' : 'text-2xl md:text-4xl font-light mb-4'} tracking-tighter opacity-70 uppercase ${fontClass}`}>{currentSlide.title}</h2>}
                  {currentSlide.content && (
                    <p 
                      style={customStyle}
                      className={`${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass} ${fontClass} whitespace-pre-line`}
                    >
                      {renderAnimatedLines(currentSlide.content)}
                    </p>
                  )}
                </div>
              )}

              {currentSlide.type === 'logo' && (
                <div className="flex items-center justify-center w-full h-full mx-auto">
                  <AppLogo className="w-[55vmin] h-[55vmin] max-w-[85vw] max-h-[75vh] drop-shadow-[0_25px_60px_rgba(0,0,0,0.9)]" showText={false} />
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
              </div>
            );

            if (isObsMode || lowerThirdMode) {
              return (
                <motion.div
                  key={slideRenderKey}
                  initial={motionProps.initial}
                  animate={motionProps.animate}
                  transition={
                    lowerThirdMode
                      ? { duration: Math.min(0.45, motionProps.transition?.duration ?? 0.3), ease: [0.16, 1, 0.3, 1] }
                      : motionProps.transition
                  }
                  style={slideTransitionValue === "flip" ? { perspective: 1200 } : undefined}
                  className={lowerThirdMode ? "w-full flex flex-col justify-center" : "w-full h-full flex flex-col justify-center"}
                >
                  {slideContentBody}
                </motion.div>
              );
            }

            return (
              <AnimatePresence mode="sync" initial={false}>
                <motion.div
                  key={slideRenderKey}
                  initial={motionProps.initial}
                  animate={motionProps.animate}
                  exit={
                    slideTransitionValue === "none"
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, transition: { duration: 0.16 } }
                  }
                  transition={motionProps.transition}
                  style={slideTransitionValue === "flip" ? { perspective: 1200 } : undefined}
                  className="absolute inset-0 w-full h-full flex flex-col justify-center"
                >
                  {slideContentBody}
                </motion.div>
              </AnimatePresence>
            );
          })()}
        </div>
      </div>

      </div>

    </div>
  );
}
