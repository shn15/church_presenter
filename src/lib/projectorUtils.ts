/**
 * Utility functions for managing Projector displays and EasyWorship-like
 * Dual Monitor Extended Display Mode.
 */

import { getActiveAccountId } from "./accountManager";

export const getPublicUrl = (pathOrUrl: string): string => {
  if (!pathOrUrl) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let fullUrl = "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    fullUrl = pathOrUrl;
  } else {
    const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl;
    fullUrl = origin + cleanPath;
  }

  // If path is for mobile share, automatically attach configured server parameter if present
  if (fullUrl.includes("mode=share") && !fullUrl.includes("&server=") && typeof window !== "undefined") {
    try {
      const serverUrl = localStorage.getItem("cp_socket_server_url") || ((import.meta as any).env?.VITE_SOCKET_URL as string);
      if (serverUrl) {
        const sep = fullUrl.includes("?") ? "&" : "?";
        fullUrl += `${sep}server=${encodeURIComponent(serverUrl)}`;
      }
    } catch {}
  }

  return fullUrl;
};

/**
 * Opens the Projector window directly on the extended secondary monitor (InFocus/Projector)
 * similar to EasyWorship multi-screen presenter mode, scoped to the current account.
 */
export const openProjectorExtendWindow = async (accountId?: string): Promise<Window | null> => {
  const targetAcc = accountId || getActiveAccountId();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const projectorUrl = `${origin}/projector?account=${targetAcc}`;

  // 1. Check for W3C Window Management API (Supported in modern Chrome/Edge)
  if ("getScreenDetails" in window && typeof (window as any).getScreenDetails === "function") {
    try {
      const screenDetails = await (window as any).getScreenDetails();
      const secondaryScreen =
        screenDetails.screens.find((s: any) => !s.isPrimary) || screenDetails.screens[1];

      if (secondaryScreen) {
        const left = secondaryScreen.availLeft ?? secondaryScreen.left ?? window.screen.availWidth;
        const top = secondaryScreen.availTop ?? secondaryScreen.top ?? 0;
        const width = secondaryScreen.availWidth ?? secondaryScreen.width ?? 1920;
        const height = secondaryScreen.availHeight ?? secondaryScreen.height ?? 1080;

        const win = window.open(
          projectorUrl,
          "ChurchPresenterProjector",
          `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
        );
        if (win) {
          win.focus();
          return win;
        }
      }
    } catch (err) {
      console.warn("Screen Details permission or API call failed, using fallback screen calculation:", err);
    }
  }

  // 2. Fallback: Position window to the right of the primary screen (Standard Dual Monitor Extend mode)
  const targetLeft = window.screen.availWidth || window.innerWidth || 1920;
  const targetWidth = window.screen.width || 1920;
  const targetHeight = window.screen.height || 1080;

  const win = window.open(
    projectorUrl,
    "ChurchPresenterProjector",
    `left=${targetLeft},top=0,width=${targetWidth},height=${targetHeight},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
  );

  if (win) {
    win.focus();
  }
  return win;
};
