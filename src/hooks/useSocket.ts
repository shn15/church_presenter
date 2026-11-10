import { useEffect, useState, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { Slide, Shift } from "../types";
import { getActiveAccountId, getItemAccount, setItemAccount } from "../lib/accountManager";

function cleanUrlForBroadcast(url?: string): string | undefined {
  if (!url) return url;
  if (url.startsWith("blob:")) {
    if (url.includes("/uploads/")) {
      return url.substring(url.indexOf("/uploads/"));
    }
    if (url.includes("/backgrounds/")) {
      return url.substring(url.indexOf("/backgrounds/"));
    }
    const stripped = url.replace(/^blob:/, "");
    if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
      return stripped;
    }
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

  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientCount, setClientCount] = useState(0);

  const [currentSlide, setCurrentSlide] = useState<Slide | null>(() => {
    const saved = getItemAccount("cp_current_slide", targetAccountId);
    return saved ? cleanSlideForBroadcast(JSON.parse(saved)) : null;
  });

  const [currentShift, setCurrentShift] = useState<Shift>(() => {
    try {
      const saved = getItemAccount("cp_current_shift", targetAccountId);
      return saved ? JSON.parse(saved) : { active: false, name: "", endTime: "" };
    } catch {
      return { active: false, name: "", endTime: "" };
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

  useEffect(() => {
    const newSocket = io(targetServerUrl || undefined, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      timeout: 10000,
      autoConnect: true,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("join:account", { accountId: targetAccountId });
    });

    newSocket.on("connect_error", (err) => {
      // Graceful fallback warning
      console.warn("Socket connect_error (falling back to local/cloud sync):", err.message);
    });

    // Listen for socket updates
    newSocket.on("slide:update", (slide: Slide) => {
      const cleaned = cleanSlideForBroadcast(slide);
      setCurrentSlide((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(cleaned)) {
          return prev;
        }
        return cleaned;
      });
      setItemAccount("cp_current_slide", JSON.stringify(cleaned), targetAccountId);
    });

    newSocket.on("shift:update", (shift: Shift) => {
      setCurrentShift((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(shift)) {
          return prev;
        }
        return shift;
      });
      setItemAccount("cp_current_shift", JSON.stringify(shift), targetAccountId);
    });

    newSocket.on("clients:count", (count: number) => {
      setClientCount(count);
    });

    // Cross-tab / Cross-window storage event fallback synchronization
    const handleStorage = (e: StorageEvent) => {
      if (!e.newValue) return;
      if (
        e.key === `cp_current_slide_${targetAccountId}` ||
        (targetAccountId === "acc_default" && e.key === "cp_current_slide")
      ) {
        try {
          const parsed = cleanSlideForBroadcast(JSON.parse(e.newValue));
          setCurrentSlide(parsed);
        } catch {}
      } else if (
        e.key === `cp_current_shift_${targetAccountId}` ||
        (targetAccountId === "acc_default" && e.key === "cp_current_shift")
      ) {
        try {
          const parsed = JSON.parse(e.newValue);
          setCurrentShift(parsed);
        } catch {}
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    // Create a broadcast channel specific to this account
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined") {
      channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);

      const handleBroadcast = (event: MessageEvent) => {
        if (event.data?.type === "slide:update") {
          const cleaned = cleanSlideForBroadcast(event.data.slide);
          setCurrentSlide((prev) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(cleaned)) {
              return prev;
            }
            return cleaned;
          });
          setItemAccount("cp_current_slide", JSON.stringify(cleaned), targetAccountId);
        } else if (event.data?.type === "shift:update") {
          setCurrentShift((prev) => {
            if (prev && JSON.stringify(prev) === JSON.stringify(event.data.shift)) {
              return prev;
            }
            return event.data.shift;
          });
          setItemAccount("cp_current_shift", JSON.stringify(event.data.shift), targetAccountId);
        }
      };

      channel.addEventListener("message", handleBroadcast);

      return () => {
        newSocket.disconnect();
        window.removeEventListener("storage", handleStorage);
        channel?.removeEventListener("message", handleBroadcast);
        channel?.close();
      };
    }

    return () => {
      newSocket.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, [targetAccountId, targetServerUrl]);

  const changeSlide = useCallback((slide: Slide) => {
    const cleaned = cleanSlideForBroadcast(slide);
    // 1. Update local state & storage for this account
    setCurrentSlide(cleaned);
    setItemAccount("cp_current_slide", JSON.stringify(cleaned), targetAccountId);

    // 2. Broadcast to other tabs on same account
    if (typeof window !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "slide:update", slide: cleaned });
      channel.close();
    }

    // 3. Send to server for remote clients on this account room
    if (socket) {
      socket.emit("slide:change", { accountId: targetAccountId, slide: cleaned });
    }
  }, [socket, targetAccountId]);

  const updateShift = useCallback((shift: Shift) => {
    // 1. Update local state & storage for this account
    setCurrentShift(shift);
    setItemAccount("cp_current_shift", JSON.stringify(shift), targetAccountId);

    // 2. Broadcast to other tabs on same account
    if (typeof window !== "undefined") {
      const channel = new BroadcastChannel(`church_presenter_sync_${targetAccountId}`);
      channel.postMessage({ type: "shift:update", shift });
      channel.close();
    }

    // 3. Send to server for remote clients
    if (socket) {
      socket.emit("shift:change", { accountId: targetAccountId, shift });
    }
  }, [socket, targetAccountId]);

  return useMemo(
    () => ({ socket, currentSlide, changeSlide, clientCount, currentShift, updateShift, accountId: targetAccountId }),
    [socket, currentSlide, changeSlide, clientCount, currentShift, updateShift, targetAccountId]
  );
};

