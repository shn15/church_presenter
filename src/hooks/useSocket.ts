import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Slide, Shift } from "../types";
import { getActiveAccountId, getItemAccount, setItemAccount } from "../lib/accountManager";
import {
  CloudSyncClient,
  OperatorStatus,
  SyncedSettings,
  getSyncRoomId,
} from "../lib/cloudSync";

export function cleanUrlForBroadcast(url?: string): string | undefined {
  if (!url) return url;
  if (url.startsWith("blob:")) {
    if (url.includes("/local-media/")) {
      return url.substring(url.indexOf("/local-media/"));
    }
    if (url.includes("/uploads/")) {
      return url.substring(url.indexOf("/uploads/"));
    }
    if (url.includes("/backgrounds/")) {
      return url.substring(url.indexOf("/backgrounds/"));
    }
    const stripped = url.replace(/^blob:/, "");
    if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
      url = stripped;
    } else {
      return url;
    }
  }
  if (url.includes("/local-media/")) {
    return url.substring(url.indexOf("/local-media/"));
  }
  if (url.includes("/uploads/")) {
    return url.substring(url.indexOf("/uploads/"));
  }
  if (url.includes("/backgrounds/")) {
    return url.substring(url.indexOf("/backgrounds/"));
  }
  return url;
}

function cleanSlideForBroadcast(slide: Slide): Slide {
  if (!slide) return slide;
  return {
    ...slide,
    background: cleanUrlForBroadcast(slide.background),
    backgroundOverride: cleanUrlForBroadcast(slide.backgroundOverride),
    logoUrl: cleanUrlForBroadcast(slide.logoUrl),
    logoLeftUrl: cleanUrlForBroadcast(slide.logoLeftUrl),
    logoRightUrl: cleanUrlForBroadcast(slide.logoRightUrl),
  };
}

export const useSocket = (explicitAccountId?: string) => {
  // Target account ID either passed explicitly, read from URL param, or active account in storage
  const targetAccountId = useMemo(() => {
    if (explicitAccountId) return explicitAccountId;
    if (typeof window !== "undefined") {
      const urlAccount = new URLSearchParams(window.location.search).get("account");
      if (urlAccount) return urlAccount;
    }
    return getActiveAccountId();
  }, [explicitAccountId]);

  const initialSyncRoomId = useMemo(() => getSyncRoomId(targetAccountId), [targetAccountId]);
  const [discoveredSyncRoomId, setDiscoveredSyncRoomId] = useState<string | null>(null);
  const syncRoomId = discoveredSyncRoomId || initialSyncRoomId;
  const isOperatorContext = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.includes("/operator");
  }, []);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [mediaUpdateTick, setMediaUpdateTick] = useState(0);
  const cloudRef = useRef<CloudSyncClient | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const refreshViewerConnectionRef = useRef<(() => void) | null>(null);
  const lastHeartbeatAtRef = useRef<number>(0);
  const lastCloudLiveAtRef = useRef<number>(0);
  const latestOperatorStatusRef = useRef<{ active: boolean; isLive: boolean }>({
    active: true,
    isLive: true,
  });
  const currentOperatorStatusRef = useRef<{ active: boolean; isLive: boolean } | null>(
    isOperatorContext ? { active: true, isLive: true } : null
  );
  const latestSlideRef = useRef<Slide | null>(null);
  const latestSettingsRef = useRef<SyncedSettings | null>(null);
  const hasReceivedLiveSlideRef = useRef<boolean>(false);

  const [operatorStatus, setOperatorStatus] = useState<{
    active: boolean;
    isLive: boolean;
  } | null>(() => (isOperatorContext ? { active: true, isLive: true } : null));

  const [currentSlide, setCurrentSlide] = useState<Slide | null>(() => {
    try {
      const saved = getItemAccount("cp_current_slide", targetAccountId);
      return saved ? cleanSlideForBroadcast(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  const [currentShift, setCurrentShift] = useState<Shift>(() => {
    try {
      const saved = getItemAccount("cp_current_shift", targetAccountId);
      return saved ? JSON.parse(saved) : { active: false, name: "", endTime: "" };
    } catch {
      return { active: false, name: "", endTime: "" };
    }
  });

  const [syncedSettings, setSyncedSettings] = useState<SyncedSettings | null>(() => {
    try {
      const saved = getItemAccount("cp_synced_settings", targetAccountId);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Target server URL resolution (query param -> env var -> local storage -> undefined)
  const targetServerUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const urlParams = new URLSearchParams(window.location.search);
    const queryServer = urlParams.get("server");
    if (queryServer) {
      try {
        localStorage.setItem("cp_socket_server_url", queryServer);
      } catch {}
      return queryServer;
    }
    const envServer = (import.meta as any).env?.VITE_SOCKET_URL;
    if (envServer) return envServer;
    const storedServer = localStorage.getItem("cp_socket_server_url");
    if (storedServer) return storedServer;
    return undefined;
  }, []);

  const operatorSessionId = useMemo(
    () => `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );
  const lastSentSlideTsRef = useRef<number>(0);
  const lastSentSettingsTsRef = useRef<number>(0);
  const lastAppliedSlideMetaRef = useRef<{ ts: number; session?: string }>({ ts: 0 });
  const lastAppliedSettingsMetaRef = useRef<{ ts: number; session?: string }>({ ts: 0 });
  const lastLiveSlideAtRef = useRef<number>(0);
  const lastLiveSettingsAtRef = useRef<number>(0);

  const shouldAcceptMeta = useCallback(
    (
      metaRef: { current: { ts: number; session?: string } },
      lastLiveAtRef: { current: number },
      incomingTs: number | undefined,
      incomingSession: string | undefined,
      isPoll: boolean
    ) => {
      const ts = typeof incomingTs === "number" ? incomingTs : 0;
      const prev = metaRef.current;
      if (ts > 0 && prev.ts > 0) {
        if (incomingSession && prev.session && incomingSession === prev.session) {
          if (isPoll ? ts <= prev.ts : ts < prev.ts) {
            return false;
          }
        } else {
          if (isPoll && Date.now() - lastLiveAtRef.current < 2000 && ts <= prev.ts) {
            return false;
          }
          if (ts < prev.ts - 15000) {
            return false;
          }
        }
      }
      if (ts > 0) {
        metaRef.current = {
          ts:
            incomingSession && prev.session && incomingSession !== prev.session
              ? ts
              : Math.max(prev.ts, ts),
          session: incomingSession || prev.session,
        };
      }
      return true;
    },
    []
  );

  const applyIncomingSlide = useCallback((slide: Slide, options?: { fromPoll?: boolean; source?: "cloud" | "server" | "local" }) => {
    if (!slide) return;
    const isPoll = Boolean(options?.fromPoll);
    if (
      !shouldAcceptMeta(
        lastAppliedSlideMetaRef,
        lastLiveSlideAtRef,
        slide._syncTs,
        slide._syncSession,
        isPoll
      )
    ) {
      return;
    }
    if (!isPoll) {
      lastLiveSlideAtRef.current = Date.now();
      if (slide.isLive !== false) {
        lastHeartbeatAtRef.current = Date.now();
        if (options?.source === "cloud") {
          lastCloudLiveAtRef.current = Date.now();
        }
      }
    }
    hasReceivedLiveSlideRef.current = true;
    const cleaned = cleanSlideForBroadcast(slide);
    latestSlideRef.current = cleaned;
    setCurrentSlide((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(cleaned)) {
        return prev;
      }
      return cleaned;
    });
    try {
      setItemAccount("cp_current_slide", JSON.stringify(cleaned), targetAccountId);
    } catch {}
  }, [targetAccountId, shouldAcceptMeta]);

  const applyIncomingShift = useCallback((shift: Shift) => {
    setCurrentShift((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(shift)) {
        return prev;
      }
      return shift;
    });
    try {
      setItemAccount("cp_current_shift", JSON.stringify(shift), targetAccountId);
    } catch {}
  }, [targetAccountId]);

  const applyIncomingSettings = useCallback((settings: SyncedSettings, options?: { fromPoll?: boolean }) => {
    if (!settings) return;
    const isPoll = Boolean(options?.fromPoll);
    if (
      !shouldAcceptMeta(
        lastAppliedSettingsMetaRef,
        lastLiveSettingsAtRef,
        settings._syncTs,
        settings._syncSession,
        isPoll
      )
    ) {
      return;
    }
    if (!isPoll) {
      lastLiveSettingsAtRef.current = Date.now();
    }
    latestSettingsRef.current = settings;
    setSyncedSettings((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(settings)) {
        return prev;
      }
      return settings;
    });
    try {
      setItemAccount("cp_synced_settings", JSON.stringify(settings), targetAccountId);
      if (settings.outputResolution) localStorage.setItem("cp_settings_output_resolution", settings.outputResolution);
      if (settings.transitionDuration !== undefined) localStorage.setItem("cp_settings_transition_duration", String(settings.transitionDuration));
      if (settings.globalFontFamily) localStorage.setItem("cp_settings_font_family", settings.globalFontFamily);
      if (settings.globalTextTransform) localStorage.setItem("cp_settings_text_transform", settings.globalTextTransform);
      if (settings.lowerThirdMode !== undefined) localStorage.setItem("cp_settings_lower_third_mode", String(settings.lowerThirdMode));
      if (settings.globalFontSizeScale !== undefined) localStorage.setItem("cp_settings_font_size_scale", String(settings.globalFontSizeScale));
      if (settings.globalTextShadowStyle) localStorage.setItem("cp_settings_text_shadow_style", settings.globalTextShadowStyle);
      if (settings.chromaKeyColor) localStorage.setItem("cp_settings_chroma_key_color", settings.chromaKeyColor);
      if (settings.cameraBgEnabled !== undefined) localStorage.setItem("cp_settings_camera_bg_enabled", String(settings.cameraBgEnabled));
      if (settings.cameraBgDeviceId !== undefined) localStorage.setItem("cp_settings_camera_bg_device_id", settings.cameraBgDeviceId);
      if (settings.cameraBgLabel !== undefined) localStorage.setItem("cp_settings_camera_bg_label", settings.cameraBgLabel);
      if (settings.cameraBgMirror !== undefined) localStorage.setItem("cp_settings_camera_bg_mirror", String(settings.cameraBgMirror));
      if (settings.cameraBgBrightness !== undefined) localStorage.setItem("cp_settings_camera_bg_brightness", String(settings.cameraBgBrightness));
      if (settings.cameraBgOpacity !== undefined) localStorage.setItem("cp_settings_camera_bg_opacity", String(settings.cameraBgOpacity));
      if (settings.cameraBgBlur !== undefined) localStorage.setItem("cp_settings_camera_bg_blur", String(settings.cameraBgBlur));
      if (settings.cameraBgFit !== undefined) localStorage.setItem("cp_settings_camera_bg_fit", settings.cameraBgFit);
    } catch {}
  }, [targetAccountId, shouldAcceptMeta]);

  const applyIncomingOperatorStatus = useCallback((status: { active: boolean; isLive: boolean }, source: "cloud" | "server" | "local" = "server") => {
    if (source === "cloud" && status.active) {
      lastCloudLiveAtRef.current = Date.now();
    }
    if (
      source === "server" &&
      !status.active &&
      lastCloudLiveAtRef.current > 0 &&
      Date.now() - lastCloudLiveAtRef.current < 25000
    ) {
      return;
    }
    if (status.active) {
      lastHeartbeatAtRef.current = Date.now();
    }
    const normalized = {
      active: Boolean(status.active),
      isLive: status.active ? status.isLive !== false : false,
    };
    currentOperatorStatusRef.current = normalized;
    setOperatorStatus((prev) => {
      if (prev && prev.active === normalized.active && prev.isLive === normalized.isLive) {
        return prev;
      }
      return normalized;
    });
  }, []);

  useEffect(() => {
    latestSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    latestSettingsRef.current = syncedSettings;
  }, [syncedSettings]);

  useEffect(() => {
    currentOperatorStatusRef.current = operatorStatus;
  }, [operatorStatus]);

  useEffect(() => {
    // 1. Serverless Cloud Sync (MQTT over WSS + WebRTC Media Transfer) — works everywhere including Vercel & Mobile Share
    const cloud = new CloudSyncClient(syncRoomId, isOperatorContext, {
      onSlide: (slide) => applyIncomingSlide(slide, { source: "cloud" }),
      onShift: (shift) => applyIncomingShift(shift),
      onSettings: (settings) => applyIncomingSettings(settings),
      onOperatorStatus: (status: OperatorStatus) => applyIncomingOperatorStatus(status, "cloud"),
      onMediaReceived: () => {
        setMediaUpdateTick((t) => t + 1);
      },
    });
    cloudRef.current = cloud;

    // 2. Socket.io (active when Express backend exists locally or on custom server URL)
    const shouldTrySocketIo =
      Boolean(targetServerUrl) ||
      (typeof window !== "undefined" &&
        !window.location.hostname.endsWith(".vercel.app") &&
        !window.location.hostname.endsWith(".github.io"));

    let newSocket: Socket | null = null;
    if (shouldTrySocketIo) {
      newSocket = io(targetServerUrl || undefined, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 8000,
        autoConnect: true,
      });
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on("connect", () => {
        newSocket?.emit("join:account", { accountId: targetAccountId });
        if (isOperatorContext) {
          newSocket?.emit("register:operator", {
            accountId: targetAccountId,
            isLive: latestOperatorStatusRef.current.isLive,
          });
          if (latestSlideRef.current) {
            const nextTs = Math.max(Date.now(), lastSentSlideTsRef.current + 1);
            lastSentSlideTsRef.current = nextTs;
            const slideToSync = {
              ...latestSlideRef.current,
              isLive:
                latestSlideRef.current.content === "System Offline" && !latestOperatorStatusRef.current.isLive
                  ? false
                  : latestOperatorStatusRef.current.isLive,
              _syncTs: nextTs,
              _syncSession: operatorSessionId,
            };
            latestSlideRef.current = slideToSync;
            newSocket?.emit("slide:change", {
              accountId: targetAccountId,
              slide: slideToSync,
            });
          }
          if (latestSettingsRef.current) {
            newSocket?.emit("settings:change", {
              accountId: targetAccountId,
              settings: latestSettingsRef.current,
            });
          }
        }
      });

      newSocket.on("connect_error", () => {
        // Silent graceful fallback to CloudSync & BroadcastChannel
      });

      newSocket.on("slide:update", (slide: Slide) => {
        applyIncomingSlide(slide, { source: "server" });
      });

      newSocket.on("settings:update", (settings: SyncedSettings) => {
        applyIncomingSettings(settings);
      });

      newSocket.on("shift:update", (shift: Shift) => {
        applyIncomingShift(shift);
      });

      newSocket.on("operator:status", (status: { active: boolean; isLive: boolean }) => {
        applyIncomingOperatorStatus(status, "server");
      });

      newSocket.on("clients:count", (count: number) => {
        setClientCount(count);
      });
    } else {
      socketRef.current = null;
      setSocket(null);
    }

    // 3. Cross-tab / Cross-window storage event fallback synchronization
    const handleStorage = (e: StorageEvent) => {
      if (!e.newValue) return;
      if (
        e.key === `cp_current_slide_${targetAccountId}` ||
        (targetAccountId === "acc_default" && e.key === "cp_current_slide")
      ) {
        try {
          applyIncomingSlide(JSON.parse(e.newValue));
        } catch {}
      } else if (
        e.key === `cp_current_shift_${targetAccountId}` ||
        (targetAccountId === "acc_default" && e.key === "cp_current_shift")
      ) {
        try {
          applyIncomingShift(JSON.parse(e.newValue));
        } catch {}
      } else if (e.key === `cp_synced_settings_${targetAccountId}`) {
        try {
          applyIncomingSettings(JSON.parse(e.newValue));
        } catch {}
      } else if (e.key === `cp_operator_status_${targetAccountId}`) {
        try {
          applyIncomingOperatorStatus(JSON.parse(e.newValue));
        } catch {}
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    // 4. BroadcastChannel same-origin cross-window sync (Extended Display / Projector tab)
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);

      const handleBroadcast = (event: MessageEvent) => {
        if (event.data?.type === "slide:update") {
          applyIncomingSlide(event.data.slide);
        } else if (event.data?.type === "shift:update") {
          applyIncomingShift(event.data.shift);
        } else if (event.data?.type === "settings:update") {
          applyIncomingSettings(event.data.settings);
        } else if (event.data?.type === "operator:status" && event.data.status) {
          applyIncomingOperatorStatus(event.data.status);
        } else if (event.data?.type === "operator:ping" && isOperatorContext) {
          channel?.postMessage({
            type: "operator:status",
            status: latestOperatorStatusRef.current,
          });
          if (latestSettingsRef.current) {
            channel?.postMessage({
              type: "settings:update",
              settings: latestSettingsRef.current,
            });
          }
          if (latestOperatorStatusRef.current.active && latestSlideRef.current) {
            channel?.postMessage({
              type: "slide:update",
              slide: latestSlideRef.current,
            });
          }
        } else if (event.data?.type === "media:updated") {
          setMediaUpdateTick((t) => t + 1);
        }
      };

      channel.addEventListener("message", handleBroadcast);

      if (!isOperatorContext) {
        channel.postMessage({ type: "operator:ping" });
      }
    }

    // 5. Viewer-side resilient HTTP live-output snapshot + periodic fallback polling & liveness detection
    let initialTimeout: number | undefined;
    let livenessInterval: number | undefined;
    let retryPingInterval: number | undefined;
    let pollTimeout: number | undefined;
    let pollStopped = false;
    let isFetchingSnapshot = false;
    let handleVisibilityOrFocus: (() => void) | null = null;

    if (!isOperatorContext && typeof window !== "undefined") {
      const apiBase = targetServerUrl ? targetServerUrl.replace(/\/$/, "") : "";
      const params = new URLSearchParams(window.location.search);
      const hasExplicitRoom = Boolean(params.get("room")?.trim());
      const isObsView = params.get("mode") === "obs" || params.get("obs") === "1";

      const fetchLiveSnapshot = async (isInitial: boolean) => {
        if (pollStopped || isFetchingSnapshot) return;
        isFetchingSnapshot = true;
        try {
          const res = await fetch(
            `${apiBase}/api/live-output?account=${encodeURIComponent(targetAccountId)}`,
            { cache: "no-store" }
          );
          if (pollStopped || !res.ok) return;
          const data = await res.json();
          if (pollStopped || !data) return;
          if (!hasExplicitRoom && typeof data.syncRoomId === "string" && data.syncRoomId.trim() && data.syncRoomId !== syncRoomId) {
            try {
              const safeAcc = (targetAccountId || "acc_default").replace(/[^a-zA-Z0-9_-]/g, "");
              localStorage.setItem(`cp_sync_room_${safeAcc}`, data.syncRoomId.trim());
            } catch {}
            setDiscoveredSyncRoomId(data.syncRoomId.trim());
          }
          if (data.settings) {
            applyIncomingSettings(data.settings, { fromPoll: !isInitial });
          }
          if (data.slide) {
            applyIncomingSlide(data.slide, { fromPoll: !isInitial, source: "server" });
          }
          if (data.operatorStatus) {
            applyIncomingOperatorStatus(data.operatorStatus, "server");
          }
        } catch {
          // Silent fallback retry on next tick
        } finally {
          isFetchingSnapshot = false;
          if (!pollStopped) {
            const nextDelay = !socketRef.current?.connected
              ? 450
              : isObsView
                ? 1100
                : 2500;
            pollTimeout = window.setTimeout(() => {
              void fetchLiveSnapshot(false);
            }, nextDelay);
          }
        }
      };

      void fetchLiveSnapshot(true);

      handleVisibilityOrFocus = () => {
        if (pollStopped) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        if (socketRef.current) {
          if (!socketRef.current.connected) {
            socketRef.current.connect();
          } else {
            socketRef.current.emit("join:account", { accountId: targetAccountId });
          }
        }
        cloudRef.current?.pingOperator();
        void fetchLiveSnapshot(false);
      };
      refreshViewerConnectionRef.current = handleVisibilityOrFocus;
      window.addEventListener("focus", handleVisibilityOrFocus);
      window.addEventListener("online", handleVisibilityOrFocus);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibilityOrFocus);
      }

      initialTimeout = window.setTimeout(() => {
        setOperatorStatus((prev) => {
          if (prev === null) {
            const offline = { active: false, isLive: false };
            currentOperatorStatusRef.current = offline;
            return offline;
          }
          return prev;
        });
      }, 7500);

      retryPingInterval = window.setInterval(() => {
        const cur = currentOperatorStatusRef.current;
        if (cur === null || !cur.active) {
          cloudRef.current?.pingOperator();
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }
      }, 5000);

      livenessInterval = window.setInterval(() => {
        if (lastHeartbeatAtRef.current > 0 && Date.now() - lastHeartbeatAtRef.current > 35000) {
          const offline = { active: false, isLive: false };
          currentOperatorStatusRef.current = offline;
          setOperatorStatus(offline);
        }
      }, 4000);
    }

    return () => {
      pollStopped = true;
      refreshViewerConnectionRef.current = null;
      if (pollTimeout) window.clearTimeout(pollTimeout);
      if (initialTimeout) window.clearTimeout(initialTimeout);
      if (retryPingInterval) window.clearInterval(retryPingInterval);
      if (livenessInterval) window.clearInterval(livenessInterval);
      if (handleVisibilityOrFocus && typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
        window.removeEventListener("online", handleVisibilityOrFocus);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
        }
      }
      cloud.destroy();
      cloudRef.current = null;
      newSocket?.disconnect();
      socketRef.current = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
      if (channel) {
        channel.close();
      }
    };
  }, [targetAccountId, targetServerUrl, syncRoomId, isOperatorContext, operatorSessionId, applyIncomingSlide, applyIncomingShift, applyIncomingSettings, applyIncomingOperatorStatus]);

  const changeSlide = useCallback((slide: Slide) => {
    const syncTs = Math.max(Date.now(), lastSentSlideTsRef.current + 1);
    lastSentSlideTsRef.current = syncTs;
    const cleaned = cleanSlideForBroadcast({
      ...slide,
      _syncTs: syncTs,
      _syncSession: operatorSessionId,
    });
    lastAppliedSlideMetaRef.current = { ts: syncTs, session: operatorSessionId };
    latestSlideRef.current = cleaned;
    setCurrentSlide(cleaned);
    try {
      setItemAccount("cp_current_slide", JSON.stringify(cleaned), targetAccountId);
    } catch {}

    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "slide:update", slide: cleaned });
      channel.close();
    }

    const activeSocket = socketRef.current || socket;
    if (activeSocket?.connected) {
      activeSocket.emit("slide:change", { accountId: targetAccountId, slide: cleaned });
    }

    cloudRef.current?.publishSlide(cleaned);

    if (isOperatorContext && typeof window !== "undefined") {
      const apiBase = targetServerUrl ? targetServerUrl.replace(/\/$/, "") : "";
      fetch(`${apiBase}/api/live-output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: targetAccountId, slide: cleaned }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [socket, targetAccountId, isOperatorContext, targetServerUrl, operatorSessionId]);

  const updateShift = useCallback((shift: Shift) => {
    setCurrentShift(shift);
    try {
      setItemAccount("cp_current_shift", JSON.stringify(shift), targetAccountId);
    } catch {}

    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "shift:update", shift });
      channel.close();
    }

    const activeSocket = socketRef.current || socket;
    if (activeSocket?.connected) {
      activeSocket.emit("shift:change", { accountId: targetAccountId, shift });
    }

    cloudRef.current?.publishShift(shift);
  }, [socket, targetAccountId]);

  const syncSettings = useCallback((settings: SyncedSettings) => {
    const syncTs = Math.max(Date.now(), lastSentSettingsTsRef.current + 1);
    lastSentSettingsTsRef.current = syncTs;
    const stampedSettings: SyncedSettings = {
      ...settings,
      _syncTs: syncTs,
      _syncSession: operatorSessionId,
    };
    latestSettingsRef.current = stampedSettings;
    applyIncomingSettings(stampedSettings);
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "settings:update", settings: stampedSettings });
      channel.close();
    }
    const activeSocket = socketRef.current || socket;
    if (activeSocket?.connected) {
      activeSocket.emit("settings:change", { accountId: targetAccountId, settings: stampedSettings });
    }
    cloudRef.current?.publishSettings(stampedSettings);
    if (isOperatorContext && typeof window !== "undefined") {
      const apiBase = targetServerUrl ? targetServerUrl.replace(/\/$/, "") : "";
      fetch(`${apiBase}/api/live-output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: targetAccountId, settings: stampedSettings }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [targetAccountId, applyIncomingSettings, socket, isOperatorContext, targetServerUrl, operatorSessionId]);

  const requestCloudMedia = useCallback((url: string) => {
    cloudRef.current?.requestMediaTransfer(url);
  }, []);

  const notifyMediaUpdated = useCallback(() => {
    setMediaUpdateTick((t) => t + 1);
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "media:updated" });
      channel.close();
    }
  }, [targetAccountId]);

  const publishOperatorStatus = useCallback(
    (active: boolean, liveState: boolean) => {
      const payload = { active, isLive: active ? liveState : false };
      latestOperatorStatusRef.current = payload;
      currentOperatorStatusRef.current = payload;
      setOperatorStatus(payload);
      try {
        localStorage.setItem(
          `cp_operator_status_${targetAccountId}`,
          JSON.stringify({ ...payload, ts: Date.now() })
        );
      } catch {}

      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
        channel.postMessage({ type: "operator:status", status: payload });
        channel.close();
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit("operator:status", {
          accountId: targetAccountId,
          active: payload.active,
          isLive: payload.isLive,
        });
      }

      cloudRef.current?.publishOperatorStatus(payload);

      if (isOperatorContext && typeof window !== "undefined") {
        const apiBase = targetServerUrl ? targetServerUrl.replace(/\/$/, "") : "";
        const body = JSON.stringify({
          accountId: targetAccountId,
          operatorStatus: payload,
          syncRoomId,
        });
        if (!active && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            const blob = new Blob([body], { type: "application/json" });
            navigator.sendBeacon(`${apiBase}/api/live-output`, blob);
            return;
          } catch {}
        }
        fetch(`${apiBase}/api/live-output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [targetAccountId, isOperatorContext, targetServerUrl, syncRoomId]
  );

  const pingOperator = useCallback(() => {
    currentOperatorStatusRef.current = null;
    setOperatorStatus(null);
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "operator:ping" });
      channel.close();
    }
    refreshViewerConnectionRef.current?.();
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setOperatorStatus((prev) => {
          if (prev === null) {
            const offline = { active: false, isLive: false };
            currentOperatorStatusRef.current = offline;
            return offline;
          }
          return prev;
        });
      }, 6500);
    }
  }, [targetAccountId]);

  return useMemo(
    () => ({
      socket,
      currentSlide,
      changeSlide,
      clientCount,
      currentShift,
      updateShift,
      accountId: targetAccountId,
      syncedSettings,
      syncSettings,
      mediaUpdateTick,
      requestCloudMedia,
      notifyMediaUpdated,
      operatorStatus,
      publishOperatorStatus,
      pingOperator,
    }),
    [
      socket,
      currentSlide,
      changeSlide,
      clientCount,
      currentShift,
      updateShift,
      targetAccountId,
      syncedSettings,
      syncSettings,
      mediaUpdateTick,
      requestCloudMedia,
      notifyMediaUpdated,
      operatorStatus,
      publishOperatorStatus,
      pingOperator,
    ]
  );
};
