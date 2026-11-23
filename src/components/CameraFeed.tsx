import { useEffect, useRef, useState, CSSProperties } from "react";

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
}

interface CachedStreamEntry {
  stream: MediaStream;
  refCount: number;
}

const activeStreamCache = new Map<string, CachedStreamEntry>();

function buildCacheKey(deviceId?: string, deviceLabel?: string): string {
  return `${deviceId || "auto"}::${deviceLabel || ""}`;
}

export async function detectCameraDevices(
  requestPermission = false
): Promise<{ devices: CameraDeviceInfo[]; permissionError?: string }> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.enumerateDevices
  ) {
    return {
      devices: [],
      permissionError:
        "Browser atau environment ini tidak mendukung akses perangkat kamera.",
    };
  }

  let permissionError: string | undefined;
  try {
    const initial = await navigator.mediaDevices.enumerateDevices();
    const initialVideos = initial.filter((d) => d.kind === "videoinput");
    const needsLabels =
      initialVideos.length === 0 || initialVideos.some((d) => !d.label);

    if (
      (requestPermission || needsLabels) &&
      navigator.mediaDevices.getUserMedia &&
      activeStreamCache.size === 0
    ) {
      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        probeStream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        permissionError =
          err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
            ? "Izin kamera ditolak. Izinkan akses kamera di browser atau OBS."
            : err?.name === "NotFoundError"
              ? "Tidak ada perangkat kamera yang ditemukan."
              : err?.message || "Gagal mengakses perangkat kamera.";
      }
    }

    const updated = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = updated
      .filter((d) => d.kind === "videoinput")
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Kamera ${idx + 1}`,
        groupId: d.groupId || "",
      }));

    return { devices: videoDevices, permissionError };
  } catch (err: any) {
    return {
      devices: [],
      permissionError: err?.message || "Gagal memindai perangkat kamera.",
    };
  }
}

async function openPreferredCameraStream(
  deviceId?: string,
  deviceLabel?: string
): Promise<MediaStream> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new Error("Akses kamera tidak tersedia di browser ini.");
  }

  const attempts: MediaStreamConstraints[] = [];

  if (deviceId) {
    attempts.push({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  }

  if (deviceLabel && navigator.mediaDevices.enumerateDevices) {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const targetLower = deviceLabel.trim().toLowerCase();
      const matched =
        list.find(
          (d) =>
            d.kind === "videoinput" &&
            d.label.trim().toLowerCase() === targetLower
        ) ||
        list.find(
          (d) =>
            d.kind === "videoinput" &&
            d.label &&
            (d.label.toLowerCase().includes(targetLower) ||
              targetLower.includes(d.label.toLowerCase()))
        );
      if (matched && matched.deviceId !== deviceId) {
        attempts.push({
          video: {
            deviceId: { exact: matched.deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      }
    } catch {}
  }

  attempts.push({
    video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  attempts.push({ video: true, audio: false });

  let lastErr: any;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Kamera tidak dapat dibuka.");
}

interface CameraFeedProps {
  deviceId?: string;
  deviceLabel?: string;
  mirror?: boolean;
  fit?: "cover" | "contain";
  brightness?: number;
  opacity?: number;
  blur?: number;
  className?: string;
  style?: CSSProperties;
  showErrorFallback?: boolean;
}

export function CameraFeed({
  deviceId,
  deviceLabel,
  mirror = false,
  fit = "cover",
  brightness = 85,
  opacity = 100,
  blur = 0,
  className = "w-full h-full",
  style,
  showErrorFallback = false,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const key = buildCacheKey(deviceId, deviceLabel);
    let acquiredKey: string | null = null;

    const attach = async () => {
      setErrorMsg(null);
      try {
        let entry = activeStreamCache.get(key);
        if (entry) {
          const hasLiveTrack = entry.stream
            .getVideoTracks()
            .some((t) => t.readyState === "live");
          if (!hasLiveTrack) {
            entry.stream.getTracks().forEach((t) => t.stop());
            activeStreamCache.delete(key);
            entry = undefined;
          }
        }

        if (!entry) {
          const stream = await openPreferredCameraStream(deviceId, deviceLabel);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          entry = { stream, refCount: 0 };
          activeStreamCache.set(key, entry);
        }

        if (cancelled) return;
        entry.refCount += 1;
        acquiredKey = key;

        const video = videoRef.current;
        if (video) {
          video.srcObject = entry.stream;
          video.muted = true;
          video.defaultMuted = true;
          video.setAttribute("playsinline", "");
          video.setAttribute("webkit-playsinline", "");
          video.play().catch(() => {});
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(
            err?.name === "NotAllowedError"
              ? "Izin kamera ditolak"
              : err?.name === "NotFoundError"
                ? "Kamera tidak terdeteksi"
                : err?.message || "Kamera gagal dimuat"
          );
        }
      }
    };

    void attach();

    const handleDeviceChange = () => {
      if (!cancelled) {
        setRetryNonce((n) => n + 1);
      }
    };

    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.addEventListener
    ) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }

    return () => {
      cancelled = true;
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices?.removeEventListener
      ) {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (acquiredKey) {
        const entry = activeStreamCache.get(acquiredKey);
        if (entry) {
          entry.refCount -= 1;
          if (entry.refCount <= 0) {
            entry.stream.getTracks().forEach((t) => t.stop());
            activeStreamCache.delete(acquiredKey);
          }
        }
      }
    };
  }, [deviceId, deviceLabel, retryNonce]);

  const filterParts = [
    `brightness(${Math.max(0.2, Math.min(1.5, brightness / 100))})`,
    blur > 0 ? `blur(${blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className={className}
        style={{
          objectFit: fit,
          opacity: Math.max(0.1, Math.min(1, opacity / 100)),
          filter: filterParts || undefined,
          transform: mirror ? "scaleX(-1)" : undefined,
          ...style,
        }}
      />
      {showErrorFallback && errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-slate-300 text-xs font-sans p-4 text-center pointer-events-none">
          <span>{errorMsg}</span>
        </div>
      )}
    </>
  );
}
