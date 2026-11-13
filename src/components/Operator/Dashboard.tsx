import { AppLogo } from "../Logo";
// @ts-ignore
import logoUrl from "../../assets/images/Logo_2.jpeg";
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useSocket } from "../../hooks/useSocket";
import { Slide, Song, ScheduleItem, CustomBible } from "../../types";
import { useNavigate } from "react-router-dom";
import { getPublicUrl, openProjectorExtendWindow } from "../../lib/projectorUtils";
import { getActiveAccount, getItemAccount, setItemAccount } from "../../lib/accountManager";
import {
  Search,
  Play,
  Monitor,
  Layers,
  ListMusic,
  Settings,
  Mic2,
  BookOpen,
  Presentation,
  Image as ImageIcon,
  XCircle,
  Square,
  Eye,
  Share2,
  Smartphone,
  QrCode,
  Book,
  Plus,
  Trash,
  GripVertical,
  Edit2,
  Save,
  FolderOpen,
  Scissors,
  Video,
  ChevronRight,
  Music,
  FileText,
  Sliders,
  User,
  LogOut,
  Shield,
  KeyRound,
  Clock,
  Lock,
  Calendar,
  Database,
  Copy,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowUpDown,
  Hash,
  CaseSensitive,
  FileCode,
  Sun,
  Moon,
  ChevronDown,
  ExternalLink,
  Globe,
} from "lucide-react";
import { BIBLE_BOOKS, BIBLE_BOOKS_BATAK } from "../../constants/bible";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  saveMedia,
  getAllMedia,
  deleteMedia,
  extractMediaPath,
  toPersistentBlob,
} from "../../lib/indexedDbMedia";
import { fetchFolderBackgrounds } from "../../lib/backgroundFolder";
import {
  savePersistentBibles,
  getPersistentBibles,
  savePersistentSongs,
  getPersistentSongs,
  savePersistentSchedule,
  getPersistentSchedule,
  savePersistentPresentations,
  getPersistentPresentations,
  savePersistentBackgrounds,
  getPersistentBackgrounds,
} from "../../lib/appStorage";

const isLightBg = (bg: string | undefined): boolean => {
  if (!bg) return false; // Default background is black (dark)
  const cleanBg = bg.trim().toLowerCase();

  // Handle transparent
  if (cleanBg === "transparent") return false;

  // Hex color check
  if (cleanBg.startsWith("#")) {
    const hex = cleanBg.replace(/^#/, "");
    let r = 0,
      g = 0,
      b = 0;
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
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        count = 0;
      for (const rawHex of hexMatches) {
        const hex = rawHex.replace(/^#/, "");
        let r = 0,
          g = 0,
          b = 0;
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
        const brightness =
          ((rSum / count) * 299 + (gSum / count) * 587 + (bSum / count) * 114) /
          1000;
        return brightness > 140;
      }
    }
  }

  // Common light text/color identifiers
  const lightKeywords = [
    "white",
    "yellow",
    "light",
    "bright",
    "cream",
    "ivory",
    "gold",
    "aqua",
    "cyan",
    "beige",
  ];
  if (lightKeywords.some((kw) => cleanBg.includes(kw))) {
    return true;
  }

  return false;
};

const MOCK_SONGS: Song[] = [
  {
    id: "1",
    title: "Satu Hal yang Kurindu",
    artist: "True Worshippers",
    verses: [
      "Satu hal yang kurindu\nBerdiam di dalam rumah-Mu",
      "Satu hal yang kupinta\nMenikmati bait-Mu",
      "Tuk memandang wajah-Mu\nDan memuji nama-Mu",
      "Bait-Mu tempat kediaman-Mu\nTempat kesukaan-Mu",
      "Satu hal yang kurindu\nBerdiam di dalam rumah-Mu",
    ],
  },
  {
    id: "2",
    title: "Nyanyi Bagi Dia",
    artist: "Hillsong",
    verses: [
      "Angkatlah suaramu\nNyanyi bagi Dia",
      "Tepuklah tanganmu\nMulia kan Raja",
      "S'bab Dia yang layak\nT'rima pujian",
      "Yesus Tuhan... Raja segala raja",
    ],
  },
  {
    id: "3",
    title: "1 Yohanes 4:8",
    artist: "Alkitab",
    verses: [
      "Barangsiapa tidak mengasihi, ia tidak mengenal Allah, sebab Allah adalah kasih.",
    ],
  },
];

const BACKGROUNDS: string[] = [];

const MASTER_THEMES = [
  {
    name: "Classic Midnight (Default)",
    desc: "Latar hitam polos dengan teks putih terpusat",
    background: "#000000",
    fontFamily: "Sans / Inter",
    textAlign: "center" as const,
    textPosition: "center" as const,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOutline: false,
    textOutlineColor: "#000000",
    textColor: "#ffffff",
    bgOpacity: 85,
    bgBrightness: 75,
    bgBlur: 0,
    bgScale: 100,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Midnight Cosmic Nebula",
    desc: "Tema premium dengan latar nebula biru-ungu solid",
    background: "linear-gradient(135deg, #090314 0%, #150d30 100%)",
    fontFamily: "Space Grotesk",
    textAlign: "center" as const,
    textPosition: "center" as const,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOutline: true,
    textOutlineColor: "#0a0118",
    textColor: "#ffffff",
    bgOpacity: 80,
    bgBrightness: 45,
    bgBlur: 3,
    bgScale: 105,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Sunset Glory Overhills",
    desc: "Latar senja hangat, teks berbayang di bagian bawah",
    background: "linear-gradient(135deg, #240c03 0%, #100501 100%)",
    fontFamily: "Outfit",
    textAlign: "center" as const,
    textPosition: "bottom" as const,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOutline: true,
    textOutlineColor: "#150802",
    textColor: "#ffffff",
    bgOpacity: 75,
    bgBrightness: 50,
    bgBlur: 1,
    bgScale: 110,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Emerald Forest Sanctuary",
    desc: "Tema alami rimbun hijau santai, font serif klasik",
    background: "linear-gradient(135deg, #021a08 0%, #000802 100%)",
    fontFamily: "Cinzel",
    textAlign: "center" as const,
    textPosition: "center" as const,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOutline: true,
    textOutlineColor: "#041508",
    textColor: "#f0fdf4",
    bgOpacity: 70,
    bgBrightness: 40,
    bgBlur: 4,
    bgScale: 115,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Clean Charcoal Slate",
    desc: "Latar solid abu gelap, ideal untuk khotbah / pengumuman",
    background: "#1e1e24",
    fontFamily: "Playfair Display",
    textAlign: "center" as const,
    textPosition: "center" as const,
    textBold: false,
    textItalic: true,
    textShadow: false,
    textOutline: false,
    textOutlineColor: "#000000",
    textColor: "#f4f4f6",
    bgOpacity: 100,
    bgBrightness: 100,
    bgBlur: 0,
    bgScale: 100,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Broadcast Lower Third",
    desc: "Latar transparan, format teks kiri-bawah untuk live streaming",
    background: "transparent",
    fontFamily: "Sans / Inter",
    textAlign: "left" as const,
    textPosition: "bottom" as const,
    textBold: true,
    textItalic: false,
    textShadow: true,
    textOutline: true,
    textOutlineColor: "#000000",
    textColor: "#ffffff",
    bgOpacity: 90,
    bgBrightness: 80,
    bgBlur: 0,
    bgScale: 100,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
  {
    name: "Minimal Light Mode",
    desc: "Tema cerah kontras tinggi (cream), teks hitam modern",
    background: "#F5F5F0",
    fontFamily: "Space Grotesk",
    textAlign: "center" as const,
    textPosition: "center" as const,
    textBold: true,
    textItalic: false,
    textShadow: false,
    textOutline: false,
    textOutlineColor: "#ffffff",
    textColor: "#121212",
    bgOpacity: 100,
    bgBrightness: 100,
    bgBlur: 0,
    bgScale: 100,
    bgFit: "cover" as const,
    bgPositionX: 0,
    bgPositionY: 0,
  },
];

export default function OperatorDashboard() {
  const [isLive, setIsLive] = useState(true);
  const navigate = useNavigate();

  // Helper to regenerate slide labels cleanly without generic Slide names
  const regenerateSlideLabels = (
    verses: string[],
    currentLabels: string[],
    isBible: boolean,
  ): string[] => {
    let verseCount = 0;
    let bioCount = 0;

    return verses.map((verseText, idx) => {
      const existingLabel = currentLabels?.[idx];

      // If the existing label is empty, it is a split/continuation slide, so keep it empty
      if (existingLabel === "") {
        return "";
      }

      if (isBible) {
        bioCount++;
        return `Ayat ${bioCount}`;
      } else {
        // It's a song
        // Check if it should be a Chorus
        const isChorus =
          /reff|chorus|reffrain|paduan\s*suara/i.test(verseText) ||
          (existingLabel &&
            /reff|chorus|reffrain|paduan\s*suara|reff/i.test(existingLabel));

        if (isChorus) {
          return "Chorus";
        } else {
          verseCount++;
          return `Verse ${verseCount}`;
        }
      }
    });
  };

  // Helper to extract the actual Bible verse number from labels list (handling empty labels for split/continuation slides)
  const getBibleVerseLabel = (labels: string[], idx: number): string => {
    for (let k = idx; k >= 0; k--) {
      const lbl = labels[k];
      if (lbl) {
        return lbl.replace("Ayat ", "");
      }
    }
    return `${idx + 1}`;
  };

  // Account / Profil States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [username, setUsername] = useState(
    () => localStorage.getItem("cp_user_username") || "Operator Utama",
  );
  const [userRole, setUserRole] = useState(
    () => localStorage.getItem("cp_user_role") || "Administrator",
  );
  const [userAvatarColor, setUserAvatarColor] = useState(
    () => localStorage.getItem("cp_user_avatar_color") || "blue",
  );
  const [operatorPin, setOperatorPin] = useState(
    () => localStorage.getItem("operator_pin") || "1234",
  );
  const [sessionStartTime] = useState(() =>
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  const getAvatarColors = (color: string) => {
    switch (color) {
      case "red":
      case "rose":
        return {
          bg: "bg-red-600/20",
          border: "border-red-500/30",
          text: "text-red-400",
        };
      case "green":
      case "emerald":
        return {
          bg: "bg-emerald-600/20",
          border: "border-emerald-500/30",
          text: "text-emerald-400",
        };
      case "blue":
      default:
        return {
          bg: "bg-blue-600/20",
          border: "border-blue-500/30",
          text: "text-blue-400",
        };
    }
  };
  const [previewSlide, setPreviewSlide] = useState<Slide | null>(null);
  // Active Account reference
  const currentAccount = getActiveAccount();
  const currentAccountId = currentAccount.id;

  const {
    socket,
    currentSlide,
    changeSlide: origChangeSlide,
    clientCount,
    currentShift,
    updateShift,
    syncSettings,
    mediaUpdateTick,
    notifyMediaUpdated,
  } = useSocket();
  const changeSlide = useCallback(
    (slide: Slide) => {
      const hasLive = "isLive" in slide;
      origChangeSlide({
        ...slide,
        isLive: hasLive ? slide.isLive : isLive,
      });
    },
    [origChangeSlide, isLive],
  );

  useEffect(() => {
    if (socket) {
      socket.emit("register:operator");
      if (currentSlide) {
        origChangeSlide({
          ...currentSlide,
          isLive: isLive,
        });
      }
    }
  }, [socket]);
  const [search, setSearch] = useState("");
  const [songSortMode, setSongSortMode] = useState<
    "default" | "alphabetical" | "edited" | "number"
  >(() => {
    return (localStorage.getItem("cp_song_sort_mode") as any) || "default";
  });
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [activeBackground, setActiveBackground] = useState("#000000");
  const [bgTab, setBgTab] = useState<"images" | "videos">("images");
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [mediaMapping, setMediaMapping] = useState<Record<string, string>>({});

  const [customBackgrounds, setCustomBackgrounds] = useState<string[]>(() => {
    const saved =
      getItemAccount("cp_custom_bgs", currentAccountId) ||
      localStorage.getItem("cp_custom_bgs");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (url) => typeof url === "string" && !url.startsWith("blob:"),
        );
      }
    } catch (e) {}
    return [];
  });

  const [customVideoBackgrounds, setCustomVideoBackgrounds] = useState<
    string[]
  >(() => {
    const saved =
      getItemAccount("cp_custom_video_bgs", currentAccountId) ||
      localStorage.getItem("cp_custom_video_bgs");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (url) => typeof url === "string" && !url.startsWith("blob:"),
        );
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    let active = true;
    const loadIndexedDBMedia = async () => {
      try {
        const [list, savedBgs, folderBgs] = await Promise.all([
          getAllMedia(),
          getPersistentBackgrounds(currentAccountId),
          fetchFolderBackgrounds(),
        ]);
        if (!active) return;

        const mapping: Record<string, string> = {};
        const discoveredImages: string[] = [];
        const discoveredVideos: string[] = [];

        list.forEach((item) => {
          try {
            let localUrl = "";
            if (item.file instanceof Blob && item.file.size > 0) {
              localUrl = URL.createObjectURL(item.file);
            }
            if (!localUrl) return;

            mapping[item.id] = localUrl;
            const cleanPath = extractMediaPath(item.id);
            if (cleanPath) {
              mapping[cleanPath] = localUrl;
              const filename = cleanPath.substring(
                cleanPath.lastIndexOf("/") + 1,
              );
              if (filename) mapping[filename] = localUrl;

              if (
                cleanPath.startsWith("/backgrounds/") ||
                cleanPath.startsWith("/local-media/") ||
                cleanPath.startsWith("/uploads/")
              ) {
                const isVid =
                  item.mediaKind === "video" ||
                  item.type?.startsWith("video/") ||
                  /\.(mp4|webm|ogg|mov|m4v)$/i.test(item.name || cleanPath);
                if (isVid) {
                  if (!discoveredVideos.includes(cleanPath)) {
                    discoveredVideos.push(cleanPath);
                  }
                } else {
                  if (!discoveredImages.includes(cleanPath)) {
                    discoveredImages.push(cleanPath);
                  }
                }
              }
            }
          } catch (itemErr) {
            console.warn(
              "Skipped malformed IndexedDB media item:",
              item?.id,
              itemErr,
            );
          }
        });

        setMediaMapping(mapping);

        // Restore custom images and videos from the dedicated /backgrounds/ folder, OPFS/IndexedDB & persistent storage
        const mergedImages = Array.from(
          new Set([
            ...(folderBgs.images || []),
            ...(savedBgs.images || []),
            ...discoveredImages,
          ]),
        ).filter((u) => typeof u === "string" && !u.startsWith("blob:"));
        const mergedVideos = Array.from(
          new Set([
            ...(folderBgs.videos || []),
            ...(savedBgs.videos || []),
            ...discoveredVideos,
          ]),
        ).filter((u) => typeof u === "string" && !u.startsWith("blob:"));

        if (mergedImages.length > 0) {
          setCustomBackgrounds((prev) =>
            Array.from(new Set([...mergedImages, ...prev])),
          );
        }
        if (mergedVideos.length > 0) {
          setCustomVideoBackgrounds((prev) =>
            Array.from(new Set([...mergedVideos, ...prev])),
          );
        }
      } catch (err) {
        console.error("Failed to load IndexedDB media:", err);
      }
    };
    loadIndexedDBMedia();
    return () => {
      active = false;
    };
  }, [currentAccountId, mediaUpdateTick]);

  const resolveMedia = useCallback(
    (url?: string) => {
      if (!url) return "";
      if (url.startsWith("data:")) return url;

      const cleanPath = extractMediaPath(url);
      if (mediaMapping[url]) return mediaMapping[url];
      if (cleanPath && mediaMapping[cleanPath]) return mediaMapping[cleanPath];
      const filename = cleanPath.split("/").pop();
      if (filename && mediaMapping[filename]) return mediaMapping[filename];

      if (url.startsWith("blob:")) {
        const stripped = url.replace(/^blob:/, "");
        if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
          url = stripped;
        }
      }

      let processedUrl = url;

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
      } else if (
        url.startsWith("http://localhost") ||
        url.startsWith("http://127.0.0.1")
      ) {
        if (
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1")
        ) {
          processedUrl = url;
        } else {
          try {
            const parsed = new URL(url);
            processedUrl =
              window.location.origin + parsed.pathname + parsed.search;
          } catch {}
        }
      }

      if (
        typeof window !== "undefined" &&
        window.location.protocol === "https:" &&
        processedUrl.startsWith("http://")
      ) {
        if (
          !processedUrl.startsWith("http://localhost") &&
          !processedUrl.startsWith("http://127.0.0.1")
        ) {
          processedUrl = "https://" + processedUrl.substring(7);
        }
      }

      return processedUrl;
    },
    [mediaMapping],
  );

  const isVideo = (url?: string) => {
    if (!url) return false;
    const cleanUrl = url.toLowerCase();

    // Exclude common image formats to prevent false positives
    if (
      cleanUrl.endsWith(".png") ||
      cleanUrl.endsWith(".jpg") ||
      cleanUrl.endsWith(".jpeg") ||
      cleanUrl.endsWith(".gif") ||
      cleanUrl.endsWith(".webp") ||
      cleanUrl.endsWith(".bmp") ||
      cleanUrl.endsWith(".svg")
    ) {
      return false;
    }

    return (
      cleanUrl.endsWith(".mp4") ||
      cleanUrl.endsWith(".webm") ||
      cleanUrl.endsWith(".ogg") ||
      cleanUrl.endsWith(".mov") ||
      cleanUrl.endsWith(".m4v") ||
      cleanUrl.includes(".mp4?") ||
      cleanUrl.includes(".webm?") ||
      cleanUrl.includes(".ogg?") ||
      cleanUrl.includes("mixkit.co/videos") ||
      cleanUrl.startsWith("data:video") ||
      cleanUrl.startsWith("blob:video") ||
      cleanUrl.includes(".mp4") ||
      cleanUrl.includes(".webm") ||
      cleanUrl.includes(".ogg")
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Copy FileList before clearing input element
    const files: File[] = Array.from(fileList);
    if (bgFileInputRef.current) {
      bgFileInputRef.current.value = "";
    }

    try {
      const newImages: string[] = [];
      const newVideos: string[] = [];
      const newMappings: Record<string, string> = {};

      // Try saving directly into the dedicated `/public/backgrounds/` folder on server first
      let serverUrls: string[] = [];
      if (
        typeof window !== "undefined" &&
        !window.location.hostname.endsWith(".vercel.app") &&
        !window.location.hostname.endsWith(".github.io")
      ) {
        try {
          const formData = new FormData();
          files.forEach((f) => formData.append("files", f));
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const ct = res.headers.get("content-type") || "";
          if (res.ok && ct.includes("application/json")) {
            const data = await res.json();
            if (Array.isArray(data?.urls) && data.urls.length === files.length) {
              serverUrls = data.urls;
            }
          }
        } catch {}
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVid =
          file.type.startsWith("video/") ||
          /\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name);

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const targetPath =
          serverUrls[i] ||
          `/local-media/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;
        const filename = targetPath.substring(targetPath.lastIndexOf("/") + 1);

        // Save raw binary Blob into dedicated browser OPFS "backgrounds" folder + IndexedDB (zero base64/code)
        const persistentBlob = await toPersistentBlob(
          file,
          file.type || (isVid ? "video/mp4" : "image/jpeg"),
        );

        await saveMedia(targetPath, persistentBlob, file.name, persistentBlob.type, {
          mediaKind: isVid ? "video" : "image",
        });

        const localObjectUrl = URL.createObjectURL(persistentBlob);
        newMappings[targetPath] = localObjectUrl;
        newMappings[filename] = localObjectUrl;

        if (isVid) {
          newVideos.push(targetPath);
        } else {
          newImages.push(targetPath);
        }
      }

      if (Object.keys(newMappings).length > 0) {
        setMediaMapping((prev) => ({ ...prev, ...newMappings }));
      }

      let lastSelected = "";
      let nextImages = customBackgrounds;
      let nextVideos = customVideoBackgrounds;

      if (newImages.length > 0) {
        nextImages = Array.from(new Set([...customBackgrounds, ...newImages]));
        setCustomBackgrounds(nextImages);
        lastSelected = newImages[newImages.length - 1];
        setBgTab("images");
      }

      if (newVideos.length > 0) {
        nextVideos = Array.from(
          new Set([...customVideoBackgrounds, ...newVideos]),
        );
        setCustomVideoBackgrounds(nextVideos);
        lastSelected = newVideos[newVideos.length - 1];
        setBgTab("videos");
      }

      await savePersistentBackgrounds(currentAccountId, nextImages, nextVideos);
      notifyMediaUpdated();

      if (lastSelected) {
        setActiveBackground(lastSelected);
      }

      showToast(
        serverUrls.length > 0
          ? `${files.length} media disimpan langsung ke folder backgrounds/`
          : `${files.length} media berhasil ditambahkan ke folder penyimpanan`,
        "success",
      );
    } catch (err) {
      console.error("Error saving uploaded media:", err);
      showToast("Gagal memproses file media", "warn");
    }
  };

  const handleAddBackground = () => {
    bgFileInputRef.current?.click();
  };
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [aiResults, setAiResults] = useState<Song[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNewSubmenu, setShowNewSubmenu] = useState(false);
  const [showNewWizardModal, setShowNewWizardModal] = useState(false);
  const [newWizardType, setNewWizardType] = useState<
    "song" | "bible" | "slide"
  >("song");
  const [newWizardTitle, setNewWizardTitle] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showProjectionDropdown, setShowProjectionDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [presentationName, setPresentationName] = useState("");
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isUploadingSchedule, setIsUploadingSchedule] = useState(false);
  const [saveFileName, setSaveFileName] = useState("jadwal_ibadah");

  const handleUploadScheduleFile = async (file: File) => {
    setIsUploadingSchedule(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/schedule-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal membongkar file presentasi.");
      }

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.schedule)) {
        setSchedule(resData.schedule);
        setShowOpenModal(false);
        setActiveTab("schedule");
        alert(`Berhasil memuat jadwal dengan ${resData.schedule.length} item!`);
      } else {
        alert("Berkas berhasil diproses tetapi datanya kosong.");
      }
    } catch (err: any) {
      console.error("Gagal mengunggah file presentasi:", err);
      alert("Gagal membaca berkas: " + err.message);
    } finally {
      setIsUploadingSchedule(false);
    }
  };
  const [activeTab, setActiveTab] = useState<
    "library" | "bible" | "schedule" | "presentations"
  >("library");
  const [bibleVersion, setBibleVersion] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("cp_custom_bibles");
      const bibles = saved ? JSON.parse(saved) : [];
      if (bibles && bibles.length > 0) {
        return bibles[0].id;
      }
    } catch (e) {}
    return "";
  });
  const [selectedBibleBook, setSelectedBibleBook] = useState("Kejadian"); // Default to Genesis/Kejadian or first book of the custom Bible
  const [selectedBibleChapter, setSelectedBibleChapter] = useState(1);
  const [chapterInput, setChapterInput] = useState("1");
  const [startVerse, setStartVerse] = useState(1);
  const [startVerseInput, setStartVerseInput] = useState("1");
  const [endVerse, setEndVerse] = useState(1);
  const [endVerseInput, setEndVerseInput] = useState("1");
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [selectedLibrarySongIds, setSelectedLibrarySongIds] = useState<
    string[]
  >([]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const selectAllScheduleRef = useRef<() => void>(() => {});
  const selectAllLibraryRef = useRef<() => void>(() => {});
  const selectAllBibleRef = useRef<() => void>(() => {});

  useEffect(() => {
    selectAllScheduleRef.current = selectAllSchedule;
    selectAllLibraryRef.current = selectAllLibrary;
    selectAllBibleRef.current = selectAllBible;
  }, []);
  const [isFetchingBible, setIsFetchingBible] = useState(false);
  const [bibleError, setBibleError] = useState<string | null>(null);
  const currentBibleContext = useRef("");
  const [masterOverride, setMasterOverride] = useState<
    "black" | "clear" | "logo" | "qr" | null
  >(null);
  const standbySlide = useRef<Slide | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cloudServerUrl, setCloudServerUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("cp_socket_server_url") || "";
    } catch {
      return "";
    }
  });
  const [obsTabActive, setObsTabActive] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [batchSongsToDelete, setBatchSongsToDelete] = useState<Song[] | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    type: "library_song" | "schedule_item" | "slide_item" | "live_preview";
    data: any;
  }>({
    show: false,
    x: 0,
    y: 0,
    type: "library_song",
    data: null,
  });

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "library_song" | "schedule_item" | "slide_item" | "live_preview",
    data: any,
  ) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data,
    });
  };
  const [tempShiftName, setTempShiftName] = useState("");
  const [tempShiftEndTime, setTempShiftEndTime] = useState("");
  const [tempShiftActive, setTempShiftActive] = useState(false);
  const [tempShiftToken, setTempShiftToken] = useState("");

  useEffect(() => {
    if (showShiftModal && currentShift) {
      setTempShiftName(currentShift.name || "");
      setTempShiftEndTime(currentShift.endTime || "");
      setTempShiftActive(currentShift.active || false);
      setTempShiftToken(currentShift.token || "");
    }
  }, [showShiftModal, currentShift]);
  const [slideSpeed, setSlideSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("cp_settings_slide_speed");
    return saved ? parseInt(saved, 10) : 5;
  });
  const [transitionDuration, setTransitionDuration] = useState<number>(() => {
    const saved = localStorage.getItem("cp_settings_transition_duration");
    return saved ? parseFloat(saved) : 0.3;
  });
  const [outputResolution, setOutputResolution] = useState<string>(() => {
    const saved = localStorage.getItem("cp_settings_output_resolution");
    return saved || "16:9";
  });
  const [showLogoOnClear, setShowLogoOnClear] = useState<boolean>(() => {
    const saved = localStorage.getItem("cp_settings_show_logo_on_clear");
    return saved === "true";
  });
  const [globalFontFamily, setGlobalFontFamily] = useState<string>(() => {
    const saved = localStorage.getItem("cp_settings_font_family");
    return saved || "Default";
  });
  const [globalTextTransform, setGlobalTextTransform] = useState<string>(() => {
    const saved = localStorage.getItem("cp_settings_text_transform");
    return saved || "Default";
  });
  const [lowerThirdMode, setLowerThirdMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("cp_settings_lower_third_mode");
    return saved === "true";
  });
  const [globalFontSizeScale, setGlobalFontSizeScale] = useState<number>(() => {
    const saved = localStorage.getItem("cp_settings_font_size_scale");
    return saved ? parseInt(saved, 10) : 100;
  });
  const [globalTextShadowStyle, setGlobalTextShadowStyle] = useState<string>(
    () => {
      const saved = localStorage.getItem("cp_settings_text_shadow_style");
      return saved || "Default";
    },
  );
  const [chromaKeyColor, setChromaKeyColor] = useState<string>(() => {
    const saved = localStorage.getItem("cp_settings_chroma_key_color");
    return saved || "transparent";
  });

  useEffect(() => {
    syncSettings({
      outputResolution,
      transitionDuration,
      globalFontFamily,
      globalTextTransform,
      lowerThirdMode,
      globalFontSizeScale,
      globalTextShadowStyle,
      chromaKeyColor,
    });
  }, [
    syncSettings,
    outputResolution,
    transitionDuration,
    globalFontFamily,
    globalTextTransform,
    lowerThirdMode,
    globalFontSizeScale,
    globalTextShadowStyle,
    chromaKeyColor,
  ]);

  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // Real Action History states (Undo/Redo)
  const [actionHistory, setActionHistory] = useState<
    Array<{ slide: Slide | null; background: string }>
  >([]);
  const [actionHistoryIdx, setActionHistoryIdx] = useState<number>(-1);
  const isTraversingHistory = useRef(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<
    Array<{ id: number; text: string; type: "info" | "success" | "warn" }>
  >([]);
  const showToast = (
    text: string,
    type: "info" | "success" | "warn" = "info",
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Media library & Audio monitors modals state
  const [showMediaLibraryModal, setShowMediaLibraryModal] = useState(false);
  const [showAudioMonitorsModal, setShowAudioMonitorsModal] = useState(false);

  // CPU, FPS, and Memory Simulation state
  const [cpuVal, setCpuVal] = useState(12);
  const [fpsVal, setFpsVal] = useState(60.0);
  const [memVal, setMemVal] = useState(1.4);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuVal((prev) => {
        const delta = (Math.random() - 0.5) * 4;
        const next = Math.round(prev + delta);
        return Math.min(Math.max(next, 6), 25);
      });
      setFpsVal((prev) => {
        const delta = (Math.random() - 0.5) * 0.3;
        const next = prev + delta;
        return Number(Math.min(Math.max(next, 58.9), 60.0).toFixed(2));
      });
      setMemVal((prev) => {
        const delta = (Math.random() - 0.5) * 0.08;
        const next = prev + delta;
        return Number(Math.min(Math.max(next, 1.2), 1.9).toFixed(2));
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Toggle browser fullscreen safely
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        showToast(
          "Layar penuh tidak didukung di frame ini, silakan buka di tab baru.",
          "warn",
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Web Audio Context for Church Pads
  const audioCtxRef = useRef<AudioContext | null>(null);
  const padOscsRef = useRef<OscillatorNode[]>([]);
  const padGainRef = useRef<GainNode | null>(null);
  const padFilterRef = useRef<BiquadFilterNode | null>(null);
  const [activePadKey, setActivePadKey] = useState<string | null>(null);
  const [padVolume, setPadVolume] = useState<number>(0.6); // 0.0 to 1.0
  const [padStyle, setPadStyle] = useState<"Warm" | "Cosmic" | "Sub">("Warm");

  // Clean play/stop pads
  const playChurchPad = (keyStr: string) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      stopChurchPad(false);

      const KEY_FREQ: Record<string, number[]> = {
        C: [130.81, 195.99, 261.63, 329.63],
        D: [146.83, 220.0, 293.66, 369.99],
        E: [164.81, 246.94, 329.63, 415.3],
        F: [174.61, 261.63, 349.23, 440.0],
        G: [196.0, 293.66, 392.0, 493.88],
        A: [220.0, 329.63, 440.0, 554.37],
        B: [246.94, 369.99, 493.88, 622.25],
      };

      const freqs = KEY_FREQ[keyStr];
      if (!freqs) return;

      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      mainGain.gain.linearRampToValueAtTime(
        padVolume * 0.25,
        ctx.currentTime + 2.5,
      );
      padGainRef.current = mainGain;

      const lowpassFilter = ctx.createBiquadFilter();
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.setValueAtTime(
        padStyle === "Warm" ? 450 : padStyle === "Cosmic" ? 750 : 250,
        ctx.currentTime,
      );
      lowpassFilter.Q.setValueAtTime(2.0, ctx.currentTime);
      padFilterRef.current = lowpassFilter;

      lowpassFilter.connect(mainGain);
      mainGain.connect(ctx.destination);

      const oscs: OscillatorNode[] = [];
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        if (padStyle === "Cosmic") {
          osc.type = index % 2 === 0 ? "sawtooth" : "triangle";
        } else {
          osc.type = "triangle";
        }
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.detune.setValueAtTime(index % 2 === 0 ? 6 : -6, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(index === 0 ? 0.9 : 0.6, ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(lowpassFilter);

        osc.start();
        oscs.push(osc);
      });

      padOscsRef.current = oscs;
      setActivePadKey(keyStr);
      showToast(
        `Mulai memainkan Ambiance Sound Pad di nada dasar "${keyStr}"`,
        "success",
      );
    } catch (e: any) {
      console.error(e);
      showToast("Gagal memutar audio pads: " + e.message, "warn");
    }
  };

  const stopChurchPad = (withFade = true) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const gainNode = padGainRef.current;
    const oscs = padOscsRef.current;

    setActivePadKey(null);

    if (gainNode) {
      if (withFade) {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + 3.0,
        );
        setTimeout(() => {
          try {
            oscs.forEach((osc) => osc.stop());
          } catch (e) {}
          if (padGainRef.current === gainNode) {
            padGainRef.current = null;
            padOscsRef.current = [];
          }
        }, 3200);
        showToast("Cinematic Fade-Out diaktifkan (3 detik)...", "info");
      } else {
        try {
          oscs.forEach((osc) => osc.stop());
        } catch (e) {}
        padOscsRef.current = [];
        padGainRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (padGainRef.current && audioCtxRef.current) {
      padGainRef.current.gain.linearRampToValueAtTime(
        padVolume * 0.25,
        audioCtxRef.current.currentTime + 0.5,
      );
    }
  }, [padVolume]);

  useEffect(() => {
    if (padFilterRef.current && audioCtxRef.current) {
      const cut = padStyle === "Warm" ? 450 : padStyle === "Cosmic" ? 750 : 250;
      padFilterRef.current.frequency.exponentialRampToValueAtTime(
        cut,
        audioCtxRef.current.currentTime + 1.0,
      );
    }
  }, [padStyle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        padOscsRef.current.forEach((osc) => osc.stop());
      } catch (e) {}
    };
  }, []);

  // Track history recording
  useEffect(() => {
    if (isTraversingHistory.current) {
      isTraversingHistory.current = false;
      return;
    }
    const currentText = previewSlide ? previewSlide.content : "";
    const currentBg = activeBackground;

    setActionHistory((prev) => {
      // Don't record if exactly identical to the last one
      if (prev.length > 0 && actionHistoryIdx >= 0) {
        const last = prev[actionHistoryIdx];
        if (
          (last.slide ? last.slide.content : "") === currentText &&
          last.background === currentBg
        ) {
          return prev;
        }
      }
      const sliced = prev.slice(0, actionHistoryIdx + 1);
      const updated = [
        ...sliced,
        { slide: previewSlide, background: activeBackground },
      ];
      // Clamp to 40 items max
      if (updated.length > 40) {
        updated.shift();
      }
      setActionHistoryIdx(updated.length - 1);
      return updated;
    });
  }, [previewSlide?.content, activeBackground]);

  const triggerUndo = () => {
    if (actionHistoryIdx > 0) {
      const nextIdx = actionHistoryIdx - 1;
      const target = actionHistory[nextIdx];
      isTraversingHistory.current = true;
      setActionHistoryIdx(nextIdx);

      if (target.slide) {
        setPreviewSlide(target.slide);
        standbySlide.current = target.slide;
        if (isLive && !masterOverride) {
          changeSlide(target.slide);
        }
        showToast(
          `Undo: Kembali ke lirik "${target.slide.title || "Slide"}"`,
          "success",
        );
      } else {
        setPreviewSlide(null);
        standbySlide.current = null;
        if (isLive) {
          changeSlide({
            content: "",
            title: "",
            background: target.background,
            type: "announcement",
          });
        }
        showToast("Undo: Menghapus output lirik", "success");
      }
      setActiveBackground(target.background);
    } else {
      showToast("Tidak ada tindakan yang bisa dibatalkan.", "warn");
    }
  };

  const triggerRedo = () => {
    if (actionHistoryIdx < actionHistory.length - 1) {
      const nextIdx = actionHistoryIdx + 1;
      const target = actionHistory[nextIdx];
      isTraversingHistory.current = true;
      setActionHistoryIdx(nextIdx);

      if (target.slide) {
        setPreviewSlide(target.slide);
        standbySlide.current = target.slide;
        if (isLive && !masterOverride) {
          changeSlide(target.slide);
        }
        showToast(
          `Redo: Beralih ke lirik "${target.slide.title || "Slide"}"`,
          "success",
        );
      } else {
        setPreviewSlide(null);
        standbySlide.current = null;
        if (isLive) {
          changeSlide({
            content: "",
            title: "",
            background: target.background,
            type: "announcement",
          });
        }
        showToast("Redo: Mengosongkan output lirik", "success");
      }
      setActiveBackground(target.background);
    } else {
      showToast("Tidak ada tindakan yang bisa diulang.", "warn");
    }
  };

  // Custom Bible and Song Database states
  const [customBibles, setCustomBibles] = useState<CustomBible[]>(() => {
    try {
      const saved = localStorage.getItem("cp_custom_bibles");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse saved custom bibles:", e);
      return [];
    }
  });

  const saveBiblesLocalStorage = (bibles: CustomBible[]) => {
    try {
      const minimalBibles = bibles.map((b) => ({ id: b.id, name: b.name }));
      localStorage.setItem("cp_custom_bibles", JSON.stringify(minimalBibles));
    } catch (err: any) {
      console.error("Gagal menyimpan metadata alkitab ke LocalStorage:", err);
    }
    // Also save complete bibles with all books to IndexedDB permanently
    savePersistentBibles(bibles);
  };

  const [showBibleDbModal, setShowBibleDbModal] = useState(false);
  const [showSongDbModal, setShowSongDbModal] = useState(false);

  // EasyWorship Importer States and Utilities
  const [isImportingBible, setIsImportingBible] = useState(false);
  const [isImportingSongs, setIsImportingSongs] = useState(false);

  // Dynamic SQL.js dynamic script loader
  const loadSqlJs = () => {
    return new Promise<any>((resolve, reject) => {
      if ((window as any).initSqlJs) {
        resolve((window as any).initSqlJs);
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).initSqlJs) {
          resolve((window as any).initSqlJs);
        } else {
          reject(new Error("initSqlJs not found on window"));
        }
      };
      script.onerror = () => {
        const fallbackScript = document.createElement("script");
        fallbackScript.src = "https://unpkg.com/sql.js@1.6.2/dist/sql-wasm.js";
        fallbackScript.async = true;
        fallbackScript.onload = () => {
          resolve((window as any).initSqlJs);
        };
        fallbackScript.onerror = () => {
          reject(new Error("Failed to load sql.js from CDNs"));
        };
        document.body.appendChild(fallbackScript);
      };
      document.body.appendChild(script);
    });
  };

  // RTF Clean function to retrieve plain-text lyrics from EasyWorship Words
  const cleanEWRtf = (rtf: string): string => {
    if (!rtf) return "";
    let text = rtf;
    text = text.replace(/\\par/gi, "\n");
    text = text.replace(/\\line/gi, "\n");
    text = text.replace(/\\tab/gi, "\t");
    text = text.replace(/\{\\\*[\s\S]*?\}/g, "");
    text = text.replace(/\{\\fonttbl[\s\S]*?\}/g, "");
    text = text.replace(/\{\\colortbl[\s\S]*?\}/g, "");
    text = text.replace(/\{\\stylesheet[\s\S]*?\}/g, "");
    text = text.replace(/\{\\info[\s\S]*?\}/g, "");
    text = text.replace(/\\([a-z]{1,32})(-?\d+)? ?/gi, "");
    text = text.replace(/\\'[0-9a-f]{2}/gi, "");
    text = text.replace(/[{}]/g, "");
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  };

  // Slide parser to divide EasyWorship song body into separate Slides
  const parseEWSongVerses = (plainText: string) => {
    const blocks = plainText.split(/\n\s*\n+/);
    const verses: string[] = [];
    const verseLabels: string[] = [];
    let defaultIndex = 1;

    blocks.forEach((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return;
      const lines = trimmedBlock.split("\n").map((l) => l.trim());
      const firstLine = lines[0];
      const isLabel =
        /^(verse|chorus|bridge|tag|ending|pre-chorus|refrain|slide|v\d+|c\d+|b\d+|split|reff|bait|bait\s+\d+|reff\s+\d+)/i.test(
          firstLine,
        ) ||
        (firstLine.startsWith("[") && firstLine.endsWith("]"));

      if (isLabel && lines.length > 1) {
        const cleanLabel = firstLine.replace(/[\[\]]/g, "").trim();
        verseLabels.push(cleanLabel);
        verses.push(lines.slice(1).join("\n"));
      } else {
        verseLabels.push(`Verse ${defaultIndex}`);
        verses.push(trimmedBlock);
        defaultIndex++;
      }
    });

    if (verses.length === 0) {
      verses.push(plainText);
      verseLabels.push("Verse 1");
    }

    const finalLabels = regenerateSlideLabels(verses, verseLabels, false);
    return { verses, verseLabels: finalLabels };
  };

  // Parse Plain Text songs compiled or copy-pasted (extremely robust)
  const parseTextSongs = (rawText: string): Song[] => {
    if (!rawText || !rawText.trim()) return [];

    // First, try normalized split by "---" delimiter of any length
    let sections = rawText.split(/(?:\r?\n){1,3}-+(?:\r?\n){1,3}/);
    if (sections.length <= 1) {
      sections = rawText.split(/(?:\r?\n)---+(?:\r?\n)/);
    }
    if (sections.length <= 1) {
      // If there's no "---", check if we can split by "Title:" or "Judul:"
      if (/^(?:Title|Judul):/im.test(rawText)) {
        sections = rawText.split(/(?=(?:Title:|Judul:))/i);
      } else {
        sections = [rawText];
      }
    }

    const parsedSongs: Song[] = [];

    sections.forEach((sect, idx) => {
      const block = sect.trim();
      if (!block) return;

      const lines = block.split(/\r?\n/).map((l) => l.trim());
      if (lines.length === 0) return;

      let title = "";
      let artist = "Impor Teks";
      const verses: string[] = [];
      const verseLabels: string[] = [];

      // Check if it's Key-Value format
      const hasKeyValue = lines.some((l) =>
        /^(?:title|judul|artist|author|artis|pencipta):/i.test(l),
      );

      if (hasKeyValue) {
        let currentVerseText: string[] = [];
        let currentLabel = "Slide 1";
        let slideCount = 1;

        lines.forEach((line) => {
          if (/^(?:title|judul):/i.test(line)) {
            title = line.replace(/^(?:title|judul):/i, "").trim();
          } else if (/^(?:artist|author|artis|pencipta):/i.test(line)) {
            artist = line
              .replace(/^(?:artist|author|artis|pencipta):/i, "")
              .trim();
          } else if (
            /^(?:lirik|lyrics|verses|content|lirik_lagu):/i.test(line)
          ) {
            // Treat as starter
          } else {
            // Is it a label?
            const isLabel =
              /^(?:verse|text|chorus|bridge|tag|ending|pre-chorus|refrain|slide|v\d+|c\d+|b\d+|split|reff|reffrain|bait|bait\s+\d+|reff\s+\d+|slide\s+\d+)/i.test(
                line,
              ) ||
              (line.startsWith("[") && line.endsWith("]"));

            if (isLabel) {
              if (currentVerseText.length > 0) {
                verses.push(currentVerseText.join("\n"));
                verseLabels.push(currentLabel);
                currentVerseText = [];
              }
              currentLabel = line.replace(/[\[\]]/g, "").trim();
            } else if (line.length > 0) {
              currentVerseText.push(line);
            } else {
              // Empty line inside a song represents slide separation
              if (currentVerseText.length > 0) {
                verses.push(currentVerseText.join("\n"));
                verseLabels.push(currentLabel);
                currentVerseText = [];
                slideCount++;
                currentLabel = `Slide ${slideCount}`;
              }
            }
          }
        });

        if (currentVerseText.length > 0) {
          verses.push(currentVerseText.join("\n"));
          verseLabels.push(currentLabel);
        }
      } else {
        // Simple lines block: No Key-Value headers
        title = lines[0];

        let lyricsStartIndex = 1;
        if (lines.length > 1 && lines[1].toLowerCase().startsWith("by ")) {
          artist = lines[1].replace(/^by\s+/i, "").trim();
          lyricsStartIndex = 2;
        }

        // Divide remaining lines into paragraphs (verses) split by empty lines
        let currentVerseText: string[] = [];
        let slideCount = 1;

        for (let i = lyricsStartIndex; i < lines.length; i++) {
          const line = lines[i];
          if (line === "") {
            if (currentVerseText.length > 0) {
              verses.push(currentVerseText.join("\n"));
              verseLabels.push(`Slide ${slideCount}`);
              currentVerseText = [];
              slideCount++;
            }
          } else {
            const isLabel =
              /^(?:verse|chorus|bridge|tag|ending|pre-chorus|refrain|slide|v\d+|c\d+|b\d+|split|reff|bait|bait\s+\d+|reff\s+\d+|slide\s+\d+)/i.test(
                line,
              ) ||
              (line.startsWith("[") && line.endsWith("]"));
            if (isLabel) {
              if (currentVerseText.length > 0) {
                verses.push(currentVerseText.join("\n"));
                verseLabels.push(`Slide ${slideCount}`);
                currentVerseText = [];
                slideCount++;
              }
              let customLabel = line.replace(/[\[\]]/g, "").trim();
              let nextLineLines: string[] = [];
              while (i + 1 < lines.length && lines[i + 1] !== "") {
                i++;
                nextLineLines.push(lines[i]);
              }
              verses.push(nextLineLines.join("\n"));
              verseLabels.push(customLabel);
            } else {
              currentVerseText.push(line);
            }
          }
        }

        if (currentVerseText.length > 0) {
          verses.push(currentVerseText.join("\n"));
          verseLabels.push(`Slide ${slideCount}`);
        }
      }

      if (title && title.trim()) {
        const finalLabels = regenerateSlideLabels(verses, verseLabels, false);
        parsedSongs.push({
          id: `txt-song-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: title.trim(),
          artist: artist.trim(),
          verses: verses.length > 0 ? verses : ["(Lirik kosong)"],
          verseLabels: finalLabels,
        });
      }
    });

    return parsedSongs;
  };

  // Normalize/Translate English and Abbreviated Book names to Indonesian equivalent
  const normalizeBibleBookName = (id: number, name: string): string => {
    const EW_BOOK_ID_MAP: { [key: number]: string } = {
      1: "Kejadian",
      2: "Keluaran",
      3: "Imamat",
      4: "Bilangan",
      5: "Ulangan",
      6: "Yosua",
      7: "Hakim-hakim",
      8: "Rut",
      9: "1 Samuel",
      10: "2 Samuel",
      11: "1 Raja-raja",
      12: "2 Raja-raja",
      13: "1 Tawarikh",
      14: "2 Tawarikh",
      15: "Ezra",
      16: "Nehemia",
      17: "Ester",
      18: "Ayub",
      19: "Mazmur",
      20: "Amsal",
      21: "Pengkhotbah",
      22: "Kidung Agung",
      23: "Yesaya",
      24: "Yeremia",
      25: "Ratapan",
      26: "Yehezkiel",
      27: "Daniel",
      28: "Hosea",
      29: "Yoel",
      30: "Amos",
      31: "Obaja",
      32: "Yunus",
      33: "Mikha",
      34: "Nahum",
      35: "Habakuk",
      36: "Zefanya",
      37: "Hagai",
      38: "Zakharia",
      39: "Maleakhi",
      40: "Matius",
      41: "Markus",
      42: "Lukas",
      43: "Yohanes",
      44: "Kisah Para Rasul",
      45: "Roma",
      46: "1 Korintus",
      47: "2 Korintus",
      48: "Galatia",
      49: "Efesus",
      50: "Filipi",
      51: "Kolose",
      52: "1 Tesalonika",
      53: "2 Tesalonika",
      54: "1 Timotius",
      55: "2 Timotius",
      56: "Titus",
      57: "Filemon",
      58: "Ibrani",
      59: "Yakobus",
      60: "1 Petrus",
      61: "2 Petrus",
      62: "1 Yohanes",
      63: "2 Yohanes",
      64: "3 Yohanes",
      65: "Yudas",
      66: "Wahyu",
    };

    const EW_BOOK_NAME_MAP: { [key: string]: string } = {
      genesis: "Kejadian",
      exodus: "Keluaran",
      leviticus: "Imamat",
      numbers: "Bilangan",
      deuteronomy: "Ulangan",
      joshua: "Yosua",
      judges: "Hakim-hakim",
      ruth: "Rut",
      "1 samuel": "1 Samuel",
      "2 samuel": "2 Samuel",
      "1 kings": "1 Raja-raja",
      "2 kings": "2 Raja-raja",
      "1 chronicles": "1 Tawarikh",
      "2 chronicles": "2 Tawarikh",
      ezra: "Ezra",
      nehemiah: "Nehemia",
      esther: "Ester",
      job: "Ayub",
      psalms: "Mazmur",
      proverbs: "Amsal",
      ecclesiastes: "Pengkhotbah",
      "song of solomon": "Kidung Agung",
      isaiah: "Yesaya",
      jeremiah: "Yeremia",
      lamentations: "Ratapan",
      ezekiel: "Yehezkiel",
      daniel: "Daniel",
      hosea: "Hosea",
      joel: "Yoel",
      amos: "Amos",
      obadiah: "Obaja",
      jonah: "Yunus",
      micah: "Mikha",
      nahum: "Nahum",
      habakkuk: "Habakuk",
      zephaniah: "Zefanya",
      haggai: "Hagai",
      zechariah: "Zakharia",
      malachi: "Maleakhi",
      matthew: "Matius",
      mark: "Markus",
      luke: "Lukas",
      john: "Yohanes",
      acts: "Kisah Para Rasul",
      romans: "Roma",
      "1 corinthians": "1 Korintus",
      "2 corinthians": "2 Korintus",
      galatians: "Galatia",
      ephesians: "Efesus",
      philippians: "Filipi",
      colossians: "Kolose",
      "1 thessalonians": "1 Tesalonika",
      "2 thessalonians": "2 Tesalonika",
      "1 timothy": "1 Timotius",
      "2 timothy": "2 Timotius",
      titus: "Titus",
      philemon: "Filemon",
      hebrews: "Ibrani",
      james: "Yakobus",
      "1 peter": "1 Petrus",
      "2 peter": "2 Petrus",
      "1 john": "1 Yohanes",
      "2 john": "2 Yohanes",
      "3 john": "3 Yohanes",
      jude: "Yudas",
      revelation: "Wahyu",
    };

    if (id && EW_BOOK_ID_MAP[id]) return EW_BOOK_ID_MAP[id];
    if (name) {
      const cleanName = name.trim().toLowerCase();
      if (EW_BOOK_NAME_MAP[cleanName]) return EW_BOOK_NAME_MAP[cleanName];
      const matched = Object.keys(EW_BOOK_NAME_MAP).find(
        (k) => cleanName.includes(k) || k.includes(cleanName),
      );
      if (matched) return EW_BOOK_NAME_MAP[matched];
    }
    return name || `Kitab ${id}`;
  };

  // Service Schedule State
  const [schedule, setSchedule] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem("cp_last_schedule");
    return saved ? JSON.parse(saved) : [];
  });
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [editorPreviewIdx, setEditorPreviewIdx] = useState(0);
  const [editorTab, setEditorTab] = useState<"content" | "styles" | "masters">(
    "content",
  );
  const [editorZoom, setEditorZoom] = useState(63);
  const [editorSidebarWidth, setEditorSidebarWidth] = useState(35); // percentage for resizable text column
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep editorPreviewIdx securely in bounds of current editingItem verses
  useEffect(() => {
    if (editingItem) {
      if (
        editorPreviewIdx >= editingItem.verses.length ||
        editorPreviewIdx < 0
      ) {
        setEditorPreviewIdx(0);
      }
    } else {
      setEditorPreviewIdx(0);
    }
  }, [editingItem?.id, editingItem?.verses?.length]);

  // States for Edit Menu Popovers/Submenus (Scripture, Shape, Media, Arrange)
  const [editorActiveMenu, setEditorActiveMenu] = useState<
    | "scripture"
    | "shape"
    | "media"
    | "gambar_bg"
    | "video_bg"
    | "arrange"
    | "logo_overlay"
    | null
  >(null);
  const [editorLogoSlot, setEditorLogoSlot] = useState<"left" | "right">(
    "left",
  );
  const [editorMediaTab, setEditorMediaTab] = useState<"static" | "video">(
    "static",
  );

  // Dragging background image states & mouse handling
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0, scale: 100 });
  const [dragType, setDragType] = useState<"pan" | "scale" | null>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [showQuickBgs, setShowQuickBgs] = useState(false);

  // Dragging/resizing text box states & mouse handling
  const [isDraggingTextColumn, setIsDraggingTextColumn] = useState(false);
  const [textDragType, setTextDragType] = useState<"pan" | "resize" | null>(
    null,
  );
  const [textDragHandle, setTextDragHandle] = useState<string | null>(null);
  const textDragStartRef = useRef({
    x: 0,
    y: 0,
    textWidth: 92,
    textHeight: 78,
    textLeft: 4,
    textTop: 11,
  });

  // Keyboard Shortcut Handler for Navigation and Screen Clear in EasyWorship Mode
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      // Ctrl+A / Cmd+A Select All Shortcut based on activeTab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (activeTabRef.current === "schedule") {
          selectAllScheduleRef.current();
        } else if (activeTabRef.current === "library") {
          selectAllLibraryRef.current();
        } else if (activeTabRef.current === "bible") {
          selectAllBibleRef.current();
        }
        return;
      }

      // EasyWorship Toggles (independent of selectedSong)
      // C key -> Toggle Black
      if (
        e.key.toLowerCase() === "c" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        toggleMasterOverride("black");
        showToast("Layar Hitam (Black) Ditekan", "info");
        return;
      }
      // L key -> Toggle Logo
      if (
        e.key.toLowerCase() === "l" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        toggleMasterOverride("logo");
        showToast("Logo Overlay Utama Ditekan", "info");
        return;
      }
      // T key -> Toggle Clear Text
      if (
        e.key.toLowerCase() === "t" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        toggleMasterOverride("clear");
        showToast("Hapus Teks Saja (Clear) Ditekan", "info");
        return;
      }
      // B key -> Toggle Black as well
      if (
        e.key.toLowerCase() === "b" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        toggleMasterOverride("black");
        showToast("Layar Hitam Terpilih", "info");
        return;
      }
      // Escape -> Clear All Override
      if (e.key === "Escape") {
        e.preventDefault();
        setMasterOverride(null);
        if (standbySlide.current) {
          changeSlide(standbySlide.current);
        } else if (previewSlide) {
          changeSlide(previewSlide);
        }
        showToast("Override Dimatikan - Live Teks Tampil", "success");
        return;
      }

      if (!selectedSong) return;

      const verses = selectedSong.verses || [];
      if (verses.length === 0) return;

      const currentIdx =
        previewSlide &&
        previewSlide.parentId === selectedSong.id &&
        previewSlide.slideIdx !== undefined
          ? previewSlide.slideIdx
          : -1;

      const runSlideAction = (targetIdx: number) => {
        const labels = selectedSong.verseLabels || [];
        const isBible =
          selectedSong.id.startsWith("bible-") ||
          (selectedSong as any).type === "bible";
        const bibleVerseNum = getBibleVerseLabel(labels, targetIdx);
        const displayContent = isBible
          ? `${bibleVerseNum}. ${verses[targetIdx]}`
          : verses[targetIdx];
        const displayTitle = isBible
          ? `${selectedSong.title.split(":")[0]}:${bibleVerseNum}`
          : selectedSong.title;
        handleVerseClick(
          displayContent,
          displayTitle,
          selectedSong.id,
          targetIdx,
        );
        showToast(`Slide ${targetIdx + 1} Aktif`, "info");
      };

      // 1. Navigation: Space / Enter / ArrowDown / PageDown -> Next Slide
      if (
        e.key === " " ||
        e.key === "Enter" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        const nextIdx = currentIdx + 1;
        if (nextIdx < verses.length) {
          runSlideAction(nextIdx);
        } else {
          // Switch to next schedule item if possible
          const schedIdx = schedule.findIndex(
            (s) => s.id === selectedSong.id || s.songId === selectedSong.id,
          );
          if (schedIdx !== -1 && schedIdx + 1 < schedule.length) {
            const nextItem = schedule[schedIdx + 1];
            setSelectedSong(nextItem as any);
            showToast(`Lanjut ke Jadwal: ${nextItem.title}`, "success");
          }
        }
      }

      // 2. Navigation: ArrowUp / PageUp -> Previous Slide
      else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        const prevIdx = currentIdx - 1;
        if (prevIdx >= 0) {
          runSlideAction(prevIdx);
        } else {
          // Switch to previous schedule item if possible
          const schedIdx = schedule.findIndex(
            (s) => s.id === selectedSong.id || s.songId === selectedSong.id,
          );
          if (schedIdx !== -1 && schedIdx - 1 >= 0) {
            const prevItem = schedule[schedIdx - 1];
            setSelectedSong(prevItem as any);
            showToast(`Kembali ke Jadwal: ${prevItem.title}`, "success");
          }
        }
      }

      // 3. Navigation: Home -> First Slide
      else if (e.key === "Home") {
        e.preventDefault();
        runSlideAction(0);
      }

      // 4. Navigation: End -> Last Slide
      else if (e.key === "End") {
        e.preventDefault();
        runSlideAction(verses.length - 1);
      }
    };

    document.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      document.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [selectedSong, previewSlide, schedule]);

  // Click handler to close custom right click context menu anywhere
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.show) {
        setContextMenu((prev) => ({ ...prev, show: false }));
      }
    };
    window.addEventListener("click", handleCloseMenu);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
    };
  }, [contextMenu.show]);

  const handleBgMouseDown = (
    e: React.MouseEvent,
    type: "pan" | "scale" = "pan",
    handle: string | null = null,
  ) => {
    if (!editingItem || !editingItem.backgroundOverride) return;
    if (editorActiveMenu !== "gambar_bg" && editorActiveMenu !== "video_bg")
      return;

    // Ignore if clicking on textarea when panning
    if (type === "pan" && (e.target as HTMLElement).tagName === "TEXTAREA")
      return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(true);
    setDragType(type);
    if (handle) setActiveHandle(handle);

    const currentX =
      editingItem.bgPositionX !== undefined ? editingItem.bgPositionX : 0;
    const currentY =
      editingItem.bgPositionY !== undefined ? editingItem.bgPositionY : 0;
    const currentScale =
      editingItem.bgScale !== undefined ? editingItem.bgScale : 100;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: currentX,
      posY: currentY,
      scale: currentScale,
    };
  };

  const handleBgMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBg || !editingItem) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (dragType === "pan") {
      const sensitivity = 0.25;
      const newPosX = Math.max(
        -100,
        Math.min(100, dragStartRef.current.posX + dx * sensitivity),
      );
      const newPosY = Math.max(
        -100,
        Math.min(100, dragStartRef.current.posY + dy * sensitivity),
      );

      setEditingItem({
        ...editingItem,
        bgPositionX: Math.round(newPosX),
        bgPositionY: Math.round(newPosY),
      });
    } else if (dragType === "scale") {
      let delta = 0;
      if (
        activeHandle === "br" ||
        activeHandle === "mr" ||
        activeHandle === "bc"
      ) {
        delta = (dx + dy) / 2;
      } else if (
        activeHandle === "tl" ||
        activeHandle === "ml" ||
        activeHandle === "tc"
      ) {
        delta = -(dx + dy) / 2;
      } else if (activeHandle === "tr") {
        delta = (dx - dy) / 2;
      } else if (activeHandle === "bl") {
        delta = (-dx + dy) / 2;
      }

      const scaleFactor = 0.5;
      const newScale = Math.max(
        20,
        Math.min(300, dragStartRef.current.scale + delta * scaleFactor),
      );

      setEditingItem({
        ...editingItem,
        bgScale: Math.round(newScale),
      });
    }
  };

  const handleBgMouseUp = () => {
    setIsDraggingBg(false);
    setDragType(null);
    setActiveHandle(null);
  };

  const handleTextMouseDown = (
    e: React.MouseEvent,
    type: "pan" | "resize" = "pan",
    handle: string | null = null,
  ) => {
    if (!editingItem) return;

    // If we're typing inside the textarea, let typing work and don't drag
    if (type === "pan" && (e.target as HTMLElement).tagName === "TEXTAREA")
      return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTextColumn(true);
    setTextDragType(type);
    if (handle) setTextDragHandle(handle);

    const currentWidth =
      editingItem.textWidth !== undefined ? editingItem.textWidth : 92;
    const currentHeight =
      editingItem.textHeight !== undefined ? editingItem.textHeight : 78;
    const currentLeft =
      editingItem.textLeft !== undefined
        ? editingItem.textLeft
        : (100 - currentWidth) / 2;
    const currentTop =
      editingItem.textTop !== undefined
        ? editingItem.textTop
        : (100 - currentHeight) / 2;

    textDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      textWidth: currentWidth,
      textHeight: currentHeight,
      textLeft: currentLeft,
      textTop: currentTop,
    };
  };

  const handleTextMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTextColumn || !editingItem) return;
    const rect = previewCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = e.clientX - textDragStartRef.current.x;
    const dy = e.clientY - textDragStartRef.current.y;

    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    const start = textDragStartRef.current;
    let newWidth = start.textWidth;
    let newHeight = start.textHeight;
    let newLeft = start.textLeft;
    let newTop = start.textTop;

    if (textDragType === "pan") {
      newLeft = Math.max(-20, Math.min(100, start.textLeft + dxPct));
      newTop = Math.max(-20, Math.min(100, start.textTop + dyPct));
    } else if (textDragType === "resize") {
      const handle = textDragHandle;
      // Right side expansion
      if (handle === "mr" || handle === "br" || handle === "tr") {
        newWidth = Math.max(
          10,
          Math.min(100 - start.textLeft, start.textWidth + dxPct),
        );
      }
      // Left side expansion
      if (handle === "ml" || handle === "bl" || handle === "tl") {
        const computedLeft = Math.max(
          0,
          Math.min(
            start.textLeft + start.textWidth - 10,
            start.textLeft + dxPct,
          ),
        );
        const widthChange = start.textLeft - computedLeft;
        newLeft = computedLeft;
        newWidth = Math.max(10, start.textWidth + widthChange);
      }
      // Bottom side expansion
      if (handle === "bc" || handle === "br" || handle === "bl") {
        newHeight = Math.max(
          10,
          Math.min(100 - start.textTop, start.textHeight + dyPct),
        );
      }
      // Top side expansion
      if (handle === "tc" || handle === "tr" || handle === "tl") {
        const computedTop = Math.max(
          0,
          Math.min(
            start.textTop + start.textHeight - 10,
            start.textTop + dyPct,
          ),
        );
        const heightChange = start.textTop - computedTop;
        newTop = computedTop;
        newHeight = Math.max(10, start.textHeight + heightChange);
      }
    }

    setEditingItem({
      ...editingItem,
      textWidth: Math.round(newWidth),
      textHeight: Math.round(newHeight),
      textLeft: Math.round(newLeft),
      textTop: Math.round(newTop),
    });
  };

  const handleTextMouseUp = () => {
    setIsDraggingTextColumn(false);
    setTextDragType(null);
    setTextDragHandle(null);
  };

  const handleBgWheel = (e: React.WheelEvent) => {
    // Handled natively on previewCanvasRef to bypass passive event listener limits and avoid browser page zoom
  };

  const previewCanvasRef = useRef<HTMLDivElement>(null);

  // Globally prevent default browser zoom-in and zoom-out on Ctrl+Wheel, hotkeys, & trackpad pinching
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "=" || e.key === "-" || e.key === "+" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("wheel", preventBrowserZoom, { passive: false });
    document.addEventListener("keydown", preventKeys, { passive: false });
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", preventBrowserZoom);
      document.removeEventListener("keydown", preventKeys);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  // Native listener for smooth, non-passive background zoom that blocks default page zoom/scroll
  useEffect(() => {
    const el = previewCanvasRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const isEditBgActive =
        editorActiveMenu === "gambar_bg" || editorActiveMenu === "video_bg";
      if (isEditBgActive) {
        e.preventDefault();
        e.stopPropagation();

        setEditingItem((prev) => {
          if (!prev || !prev.backgroundOverride) return prev;
          const currentScale = prev.bgScale !== undefined ? prev.bgScale : 100;
          const direction = e.deltaY < 0 ? 1 : -1;
          const step = 5;
          const newScale = Math.max(
            20,
            Math.min(300, currentScale + direction * step),
          );
          return {
            ...prev,
            bgScale: newScale,
          };
        });
      }
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
    };
  }, [editorActiveMenu]);

  const [editorScripBook, setEditorScripBook] = useState("Kejadian");
  const [editorScripChapter, setEditorScripChapter] = useState(1);
  const [editorScripStartVerse, setEditorScripStartVerse] = useState(1);
  const [editorScripEndVerse, setEditorScripEndVerse] = useState(1);
  const [editorScripVersion, setEditorScripVersion] = useState(() => {
    try {
      const saved = localStorage.getItem("cp_custom_bibles");
      const bibles = saved ? JSON.parse(saved) : [];
      if (bibles && bibles.length > 0) {
        return bibles[0].id;
      }
    } catch (e) {}
    return "";
  });
  const [editorScripPreviewList, setEditorScripPreviewList] = useState<
    { vNum: number; content: string }[]
  >([]);
  const [editorIsFetchingScrip, setEditorIsFetchingScrip] = useState(false);
  const [editorScripError, setEditorScripError] = useState<string | null>(null);
  const [isInitialLoadCompleted, setIsInitialLoadCompleted] = useState(false);
  const [songImportTab, setSongImportTab] = useState<"files" | "raw_text">(
    "raw_text",
  );
  const [bibleImportTab, setBibleImportTab] = useState<
    "text_raw" | "json"
  >("text_raw");
  const [rawTextPaste, setRawTextPaste] = useState("");
  const [isAiParsingSongs, setIsAiParsingSongs] = useState(false);

  const parseXmlBible = (
    xmlText: string,
    fileName: string,
  ): CustomBible | null => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // 1. Check if it's OpenSong XML format (usually has <bible><b n="...">)
      let bElements = xmlDoc.getElementsByTagName("b");
      if (bElements.length > 0) {
        const books: any = {};
        for (let i = 0; i < bElements.length; i++) {
          const bTag = bElements[i];
          const rawBookName = bTag.getAttribute("n") || `Kitab ${i + 1}`;
          books[rawBookName] = {};

          const cElements = bTag.getElementsByTagName("c");
          for (let j = 0; j < cElements.length; j++) {
            const cTag = cElements[j];
            const chapNum = cTag.getAttribute("n") || String(j + 1);
            books[rawBookName][chapNum] = [];

            const vElements = cTag.getElementsByTagName("v");
            for (let k = 0; k < vElements.length; k++) {
              const vTag = vElements[k];
              const verseText = vTag.textContent || "";
              books[rawBookName][chapNum].push(verseText);
            }
          }
        }

        const fileBaseName = fileName.replace(/\.[^/.]+$/, "").toUpperCase();
        return {
          id: `xml-opensong-${fileBaseName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: `OpenSong Alkitab - ${fileBaseName}`,
          books,
        };
      }

      // 2. Check if it's Zefania XML format (usually has <XMLBIBLE> with <BIBLEBOOK bname="...">)
      let bibleBookElements = xmlDoc.getElementsByTagName("BIBLEBOOK");
      if (bibleBookElements.length > 0) {
        const books: any = {};
        for (let i = 0; i < bibleBookElements.length; i++) {
          const bTag = bibleBookElements[i];
          const rawBookName =
            bTag.getAttribute("bname") ||
            bTag.getAttribute("bnumber") ||
            `Kitab ${i + 1}`;
          books[rawBookName] = {};

          const cElements = bTag.getElementsByTagName("CHAPTER");
          for (let j = 0; j < cElements.length; j++) {
            const cTag = cElements[j];
            const chapNum = cTag.getAttribute("cnumber") || String(j + 1);
            books[rawBookName][chapNum] = [];

            const vElements = cTag.getElementsByTagName("VERS");
            for (let k = 0; k < vElements.length; k++) {
              const vTag = vElements[k];
              const verseText = vTag.textContent || "";
              books[rawBookName][chapNum].push(verseText);
            }
          }
        }

        const fileBaseName = fileName.replace(/\.[^/.]+$/, "").toUpperCase();
        return {
          id: `xml-zefania-${fileBaseName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: `Zefania Alkitab - ${fileBaseName}`,
          books,
        };
      }
    } catch (err) {
      console.error("Gagal mem-parsing XML format:", err);
    }
    return null;
  };

  const parseTextScripture = (
    rawText: string,
    titleName: string,
  ): CustomBible | null => {
    try {
      const lines = rawText.split(/\r?\n/);
      const books: any = {};

      // Regex matches: "Yohanes 3:16 Karena begetu besar..." or "1 Yohanes 3:16 ..."
      const pattern = /^(\d?\s*[a-zA-Z\s\-]+)\s+(\d+)\s*[:\.]\s*(\d+)\s+(.+)$/;
      let parsedCount = 0;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const match = trimmed.match(pattern);
        if (match) {
          const bookName = match[1].trim();
          const chapterNum = match[2].trim();
          const verseNum = parseInt(match[3].trim());
          const verseText = match[4].trim();

          if (!books[bookName]) {
            books[bookName] = {};
          }
          if (!books[bookName][chapterNum]) {
            books[bookName][chapterNum] = [];
          }

          books[bookName][chapterNum][verseNum - 1] = verseText;
          parsedCount++;
        }
      });

      if (parsedCount === 0) {
        // Try fallback space-separated coords pattern: "Yohanes 3 16 Karena..."
        const spacePattern = /^(\d?\s*[a-zA-Z\s\-]+)\s+(\d+)\s+(\d+)\s+(.+)$/;
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const match = trimmed.match(spacePattern);
          if (match) {
            const bookName = match[1].trim();
            const chapterNum = match[2].trim();
            const verseNum = parseInt(match[3].trim());
            const verseText = match[4].trim();

            if (!books[bookName]) {
              books[bookName] = {};
            }
            if (!books[bookName][chapterNum]) {
              books[bookName][chapterNum] = [];
            }
            books[bookName][chapterNum][verseNum - 1] = verseText;
            parsedCount++;
          }
        });
      }

      if (parsedCount > 0) {
        // Safe padding
        Object.keys(books).forEach((b) => {
          Object.keys(books[b]).forEach((c) => {
            const arr = books[b][c];
            for (let i = 0; i < arr.length; i++) {
              if (arr[i] === undefined) {
                arr[i] = `[Ayat kosong]`;
              }
            }
          });
        });

        const cleanTitle = titleName.trim() || "Kustom";
        return {
          id: `txt-${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: `Alkitab Teks - ${cleanTitle}`,
          books,
        };
      }
    } catch (err) {
      console.error("Gagal mem-parsing teks Alkitab:", err);
    }
    return null;
  };

  const parseFlatVersesArray = (arr: any[]): any => {
    const books: any = {};
    arr.forEach((item) => {
      if (item && typeof item === "object") {
        const bName =
          item.book || item.book_name || item.book_title || item.b || "Umum";
        const chapNum = String(
          item.chapter || item.chapter_number || item.c || "1",
        );
        const vNum = parseInt(item.verse || item.verse_number || item.v || "1");
        const txt =
          item.text ||
          item.content ||
          item.translation ||
          item.t ||
          item.text_val ||
          "";

        if (!books[bName]) {
          books[bName] = {};
        }
        if (!books[bName][chapNum]) {
          books[bName][chapNum] = [];
        }
        books[bName][chapNum][vNum - 1] = txt;
      }
    });

    Object.keys(books).forEach((b) => {
      Object.keys(books[b]).forEach((c) => {
        const versesArr = books[b][c];
        for (let i = 0; i < versesArr.length; i++) {
          if (versesArr[i] === undefined) {
            versesArr[i] = `[Ayat kosong]`;
          }
        }
      });
    });

    return books;
  };

  const tryParseAnyJsonBible = (
    rawText: string,
    fileName: string,
  ): CustomBible | null => {
    try {
      const parsed = JSON.parse(rawText);
      if (!parsed) return null;

      const fileBaseName = fileName.replace(/\.[^/.]+$/, "").toUpperCase();
      const generatedId = `json-${fileBaseName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const generatedName = `Alkitab JSON - ${fileBaseName}`;

      let finalBooks: any = null;

      // Case 1: Standard CustomBible or slightly missing metadata but has "books"
      if (
        parsed.books &&
        typeof parsed.books === "object" &&
        !Array.isArray(parsed.books)
      ) {
        finalBooks = parsed.books;
      }
      // Case 2: Array of books, where each book has "name"/"title" and "chapters" (or nested arrays/objects)
      else if (parsed.books && Array.isArray(parsed.books)) {
        finalBooks = {};
        parsed.books.forEach((b: any) => {
          const bName =
            b.name || b.title || b.book_name || `Kitab ${Math.random()}`;
          finalBooks[bName] = {};
          if (Array.isArray(b.chapters)) {
            b.chapters.forEach((ch: any, idx: number) => {
              const chapNum = String(idx + 1);
              if (Array.isArray(ch)) {
                finalBooks[bName][chapNum] = ch.map((v: any) =>
                  typeof v === "string"
                    ? v
                    : v?.text || v?.content || JSON.stringify(v),
                );
              } else if (ch && typeof ch === "object") {
                const innerVerses = ch.verses || ch.verses_list || [];
                if (Array.isArray(innerVerses)) {
                  finalBooks[bName][String(ch.chapter || ch.num || chapNum)] =
                    innerVerses.map((v: any) =>
                      typeof v === "string"
                        ? v
                        : v?.text || v?.content || JSON.stringify(v),
                    );
                }
              }
            });
          }
        });
      }
      // Case 3: Direct dictionary at root, where keys look like book names and values are objects
      else if (typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        const hasChapterObjects =
          keys.length > 0 &&
          keys.every((k) => {
            const val = parsed[k];
            return val && typeof val === "object" && !Array.isArray(val);
          });

        if (hasChapterObjects) {
          finalBooks = parsed;
        } else {
          if (parsed.chapters && Array.isArray(parsed.chapters)) {
            finalBooks = parseFlatVersesArray(parsed.chapters);
          } else if (parsed.verses && Array.isArray(parsed.verses)) {
            finalBooks = parseFlatVersesArray(parsed.verses);
          } else if (parsed.data && Array.isArray(parsed.data)) {
            finalBooks = parseFlatVersesArray(parsed.data);
          }
        }
      }
      // Case 4: Flat array of verses or chapters at root
      else if (Array.isArray(parsed)) {
        const first = parsed[0];
        if (first && typeof first === "object") {
          if (first.chapters || first.verses) {
            finalBooks = {};
            parsed.forEach((b: any) => {
              const bName = b.name || b.title || b.book_name || `Kitab`;
              finalBooks[bName] = {};
              if (b.chapters && typeof b.chapters === "object") {
                if (Array.isArray(b.chapters)) {
                  b.chapters.forEach((ch: any, idx: number) => {
                    const chapNum = String(idx + 1);
                    if (Array.isArray(ch)) {
                      finalBooks[bName][chapNum] = ch.map((v: any) =>
                        typeof v === "string" ? v : v?.text || v?.content || "",
                      );
                    } else if (ch && typeof ch === "object") {
                      const actualChapNum = String(
                        ch.chapter || ch.num || chapNum,
                      );
                      const verses = ch.verses || [];
                      if (Array.isArray(verses)) {
                        finalBooks[bName][actualChapNum] = verses.map(
                          (v: any) =>
                            typeof v === "string"
                              ? v
                              : v?.text || v?.content || "",
                        );
                      }
                    }
                  });
                } else {
                  Object.keys(b.chapters).forEach((chapNum: string) => {
                    const ch = b.chapters[chapNum];
                    if (Array.isArray(ch)) {
                      finalBooks[bName][chapNum] = ch.map((v: any) =>
                        typeof v === "string" ? v : v?.text || v?.content || "",
                      );
                    }
                  });
                }
              }
            });
          } else {
            finalBooks = parseFlatVersesArray(parsed);
          }
        }
      }

      if (
        finalBooks &&
        typeof finalBooks === "object" &&
        Object.keys(finalBooks).length > 0
      ) {
        const cleanedBooks: any = {};
        Object.keys(finalBooks).forEach((bName) => {
          const chaptersMap = finalBooks[bName];
          if (
            chaptersMap &&
            typeof chaptersMap === "object" &&
            !Array.isArray(chaptersMap)
          ) {
            const tempChaps: any = {};
            let hasAtLeastOneChapter = false;
            Object.keys(chaptersMap).forEach((chapNum) => {
              const verses = chaptersMap[chapNum];
              if (Array.isArray(verses)) {
                tempChaps[chapNum] = verses.map((v: any) => {
                  if (typeof v === "string") return v;
                  if (v && typeof v === "object")
                    return v.text || v.content || JSON.stringify(v);
                  return String(v || "");
                });
                hasAtLeastOneChapter = true;
              }
            });
            if (hasAtLeastOneChapter) {
              cleanedBooks[bName] = tempChaps;
            }
          }
        });

        if (Object.keys(cleanedBooks).length > 0) {
          return {
            id: parsed.id
              ? String(parsed.id).trim().toLowerCase()
              : generatedId,
            name: parsed.name ? String(parsed.name).trim() : generatedName,
            books: cleanedBooks,
          };
        }
      }
    } catch (err) {
      console.error("Gagal deep-parsing JSON Alkitab:", err);
    }
    return null;
  };

  const mapBookNamesList = (list: string[], isBatak: boolean) => {
    const defaultBooks = isBatak 
      ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) 
      : BIBLE_BOOKS;
    if (!list || list.length === 0) return defaultBooks;
    const isNumericList = list.every((item) => /^\d+$/.test(item.trim()));
    if (isNumericList) {
      return list.map((item) => {
        const idx = parseInt(item.trim()) - 1;
        if (idx >= 0 && idx < defaultBooks.length) {
          return defaultBooks[idx];
        }
        return item;
      });
    }
    return list.map(item => {
      let idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === item.trim().toLowerCase());
      if (idx === -1) {
        const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);
        const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === item.trim().toLowerCase());
        if (matchBatak) {
          idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());
        }
      }
      if (idx !== -1 && idx < defaultBooks.length) {
        return defaultBooks[idx];
      }
      return item;
    });
  };

  const getAvailableBooks = () => {
    const isBatak = bibleVersion === "toba" || bibleVersion.toLowerCase().includes("batak");
    const matched = customBibles.find((cb) => cb.id === bibleVersion);
    if (matched) {
      if (matched.bookNames && matched.bookNames.length > 0) {
        return mapBookNamesList(matched.bookNames, isBatak);
      }
      if (matched.books) {
        const keys = Object.keys(matched.books);
        if (keys.length > 0) {
          return mapBookNamesList(keys, isBatak);
        }
      }
    }
    return isBatak ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) : BIBLE_BOOKS;
  };

  const getEditorAvailableBooks = () => {
    const isBatak = editorScripVersion === "toba" || editorScripVersion.toLowerCase().includes("batak");
    const matched = customBibles.find((cb) => cb.id === editorScripVersion);
    if (matched) {
      if (matched.bookNames && matched.bookNames.length > 0) {
        return mapBookNamesList(matched.bookNames, isBatak);
      }
      if (matched.books) {
        const keys = Object.keys(matched.books);
        if (keys.length > 0) {
          return mapBookNamesList(keys, isBatak);
        }
      }
    }
    return isBatak ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) : BIBLE_BOOKS;
  };


  useEffect(() => {
    const isBuiltIn = ["tb", "toba", "gntd", "kjv", "bis"].includes(bibleVersion);
    if (
      !isBuiltIn &&
      customBibles.length > 0 &&
      !customBibles.some((cb) => cb.id === bibleVersion)
    ) {
      setBibleVersion(customBibles[0].id);
    }
  }, [customBibles, bibleVersion]);

  useEffect(() => {
    const books = getAvailableBooks();
    if (books.length > 0 && !books.includes(selectedBibleBook)) {
      setSelectedBibleBook(books[0]);
    }
  }, [bibleVersion, customBibles]);

  useEffect(() => {
    const books = getEditorAvailableBooks();
    if (books.length > 0 && !books.includes(editorScripBook)) {
      setEditorScripBook(books[0]);
    }
  }, [editorScripVersion, customBibles]);

  // Library Songs State - retain edits permanently inside browser Local Storage per Account
  const [librarySongs, setLibrarySongs] = useState<Song[]>(() => {
    const saved = getItemAccount("cp_library_songs", currentAccountId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse saved library songs:", e);
      }
    }
    return [];
  });

  const [libraryPresentations, setLibraryPresentations] = useState<Song[]>(() => {
    const saved = getItemAccount("cp_library_presentations", currentAccountId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse saved library presentations:", e);
      }
    }
    return [];
  });

  // Load custom songs & bibles from IndexedDB & backend on mount (scoped to active account)
  useEffect(() => {
    async function loadPersistentAndBackendData() {
      // 1. First, hydrate from IndexedDB for 100% offline & serverless data safety
      try {
        const idbBibles = await getPersistentBibles();
        if (Array.isArray(idbBibles) && idbBibles.length > 0) {
          setCustomBibles((prev) => {
            const hasBooks = (b: CustomBible) => b.books && Object.keys(b.books).length > 0;
            const validIdb = idbBibles.filter(hasBooks);
            if (validIdb.length === 0) return prev;
            const validIds = new Set(validIdb.map((b) => b.id));
            const remaining = prev.filter((b) => !validIds.has(b.id));
            return [...validIdb, ...remaining];
          });
        }
      } catch (err) {
        console.warn("IndexedDB bibles hydration error:", err);
      }

      try {
        const idbSongs = await getPersistentSongs(currentAccountId);
        if (Array.isArray(idbSongs) && idbSongs.length > 0) {
          setLibrarySongs((prev) => {
            if (prev.length === 0) return idbSongs;
            const prevIds = new Set(prev.map((s) => s.id));
            const toAdd = idbSongs.filter((s) => !prevIds.has(s.id));
            return [...prev, ...toAdd];
          });
        }
      } catch (err) {
        console.warn("IndexedDB songs hydration error:", err);
      }

      try {
        const idbSched = await getPersistentSchedule(currentAccountId);
        if (Array.isArray(idbSched) && idbSched.length > 0) {
          setSchedule((prev) => (prev.length === 0 ? idbSched : prev));
        }
      } catch (err) {
        console.warn("IndexedDB schedule hydration error:", err);
      }

      try {
        const idbPres = await getPersistentPresentations(currentAccountId);
        if (Array.isArray(idbPres) && idbPres.length > 0) {
          setLibraryPresentations((prev) => (prev.length === 0 ? idbPres : prev));
        }
      } catch (err) {
        console.warn("IndexedDB presentations hydration error:", err);
      }

      // 2. Fetch backend if available (guard content-type against SPA index.html rewrites)
      try {
        const resSongs = await fetch(`/api/custom-songs?accountId=${currentAccountId}`);
        const ctSongs = resSongs.headers.get("content-type") || "";
        if (resSongs.ok && ctSongs.includes("application/json")) {
          const songs = await resSongs.json();
          if (Array.isArray(songs) && songs.length > 0) {
            setLibrarySongs((prev) => {
              const serverTitles = new Set(
                songs.map((s) => s.title.toLowerCase()),
              );
              const uniqueLocal = prev.filter((s) => {
                if (!s || !s.title) return false;
                return (
                  !serverTitles.has(s.title.toLowerCase()) &&
                  !s.id.startsWith("mock-")
                );
              });
              return [...songs, ...uniqueLocal];
            });
          }
        }
      } catch (e) {
        // Backend not available (e.g. Vercel static)
      }

      try {
        const resBibles = await fetch(`/api/custom-bibles?accountId=${currentAccountId}`);
        const ctBibles = resBibles.headers.get("content-type") || "";
        if (resBibles.ok && ctBibles.includes("application/json")) {
          const bibles = await resBibles.json();
          if (Array.isArray(bibles) && bibles.length > 0) {
            setCustomBibles((prev) => {
              const serverIds = new Set(bibles.map((b) => b.id));
              const uniqueLocal = prev.filter((b) => !serverIds.has(b.id));
              return [...bibles, ...uniqueLocal];
            });
          }
        }
      } catch (e) {
        // Backend not available
      }
      try {
        const resLocalBibles = await fetch("/api/local-bibles");
        const ctLocal = resLocalBibles.headers.get("content-type") || "";
        if (resLocalBibles.ok && ctLocal.includes("application/json")) {
          const localBibles = await resLocalBibles.json();
          if (Array.isArray(localBibles) && localBibles.length > 0) {
            setCustomBibles((prev) => {
              const serverIds = new Set(localBibles.map((b) => b.id));
              const uniqueLocal = prev.filter((b) => !serverIds.has(b.id));
              return [...localBibles, ...uniqueLocal];
            });
          }
        }
      } catch (e) {
        // Backend not available
      }

      try {
        const bgs = await fetchFolderBackgrounds();
        if (bgs.images && bgs.images.length > 0) {
          setCustomBackgrounds((prev) => {
            const folderSet = new Set(bgs.images);
            const uniqueLocal = prev.filter((url) => !folderSet.has(url));
            return [...bgs.images, ...uniqueLocal];
          });
        }
        if (bgs.videos && bgs.videos.length > 0) {
          setCustomVideoBackgrounds((prev) => {
            const folderSet = new Set(bgs.videos);
            const uniqueLocal = prev.filter((url) => !folderSet.has(url));
            return [...bgs.videos, ...uniqueLocal];
          });
        }
      } catch (e) {
        // Folder manifest not available
      } finally {
        setIsInitialLoadCompleted(true);
      }
    }
    loadPersistentAndBackendData();
  }, [currentAccountId]);

  // Safe manual sync function that avoids on-mount race conditions overriding backend
  const syncSongsToBackend = async (songsList: Song[]) => {
    try {
      if (songsList.length === 0) return;
      await fetch(`/api/custom-songs?accountId=${currentAccountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(songsList),
      });
    } catch (e) {
      console.error("Explicit backup songs to server failed:", e);
    }
  };

  // Sync state back to persistent storage whenever librarySongs changes
  useEffect(() => {
    savePersistentSongs(currentAccountId, librarySongs);
  }, [librarySongs, currentAccountId]);

  // Sync state back to persistent storage whenever libraryPresentations changes
  useEffect(() => {
    savePersistentPresentations(currentAccountId, libraryPresentations);
  }, [libraryPresentations, currentAccountId]);

  // Sync schedule whenever schedule changes
  useEffect(() => {
    savePersistentSchedule(currentAccountId, schedule);
  }, [schedule, currentAccountId]);

  // Sync state back to server and localStorage whenever customBibles changes
  useEffect(() => {
    saveBiblesLocalStorage(customBibles);

    if (!isInitialLoadCompleted) return;

    const backupBibles = async () => {
      try {
        await fetch(`/api/custom-bibles?accountId=${currentAccountId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customBibles),
        });
      } catch (e) {
        console.error("Auto backup bibles to server failed:", e);
      }
    };
    if (customBibles.length > 0) {
      backupBibles();
    }
  }, [customBibles, isInitialLoadCompleted, currentAccountId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const chapter = parseInt(chapterInput);
      if (!isNaN(chapter) && chapter > 0 && activeTab === "bible") {
        setSelectedBibleChapter(chapter);
        fetchBibleChapter(selectedBibleBook, chapter);
      }
    }, 800); // Increased debounce to 800ms to respect API quota and prevent accidental multiple calls while typing
    return () => clearTimeout(timer);
  }, [selectedBibleBook, chapterInput, activeTab, bibleVersion]);

  useEffect(() => {
    const s = parseInt(startVerseInput);
    const e = parseInt(endVerseInput);
    if (!isNaN(s)) setStartVerse(s);
    if (!isNaN(e)) setEndVerse(e);
  }, [startVerseInput, endVerseInput]);

  useEffect(() => {
    localStorage.setItem("cp_last_schedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    if (!editingItem) {
      setEditorPreviewIdx(0);
      setEditorTab("content");
    } else {
      // General auto-synchronization of edited items back to selectedSong and active schedule
      if (selectedSong && selectedSong.id === editingItem.id) {
        const isDifferent =
          JSON.stringify(selectedSong) !== JSON.stringify(editingItem);
        if (isDifferent) {
          setSelectedSong(editingItem as any);
        }
      }

      const schedItem = schedule.find((s) => s.id === editingItem.id);
      if (schedItem) {
        const isDifferent =
          JSON.stringify(schedItem) !== JSON.stringify(editingItem);
        if (isDifferent) {
          const newSched = schedule.map((s) =>
            s.id === editingItem.id ? editingItem : s,
          );
          setSchedule(newSched);
          localStorage.setItem("cp_last_schedule", JSON.stringify(newSched));
        }
      }
    }
  }, [editingItem, selectedSong, schedule]);

  const addBibleToSchedule = () => {
    if (!selectedSong || !selectedSong.id.startsWith("bible-")) return;

    const cbMatch = customBibles.find((cb) => cb.id === bibleVersion);
    const versionLabel = cbMatch
      ? cbMatch.name
      : bibleVersion === "toba"
        ? "Batak Toba"
        : bibleVersion === "gntd"
          ? "Good News (GNTD)"
          : "Alkitab TB";
    const isBatak = bibleVersion === "toba" || bibleVersion.toLowerCase().includes("batak");
    const bookTitle = isBatak ? BIBLE_BOOKS_BATAK[selectedBibleBook] || selectedBibleBook : selectedBibleBook;

    // Slice verses based on selection
    const startIdx = Math.max(0, startVerse - 1);
    const endIdx = Math.min(selectedSong.verses.length, endVerse);
    const filteredVerses = selectedSong.verses.slice(startIdx, endIdx);

    // Create base labels for verses
    const labels = [];
    for (let i = startVerse; i <= endVerse; i++) {
      labels.push(`Ayat ${i}`);
    }

    const rangeText =
      startVerse === endVerse ? `${startVerse}` : `${startVerse}-${endVerse}`;

    const newItem: ScheduleItem = {
      id: Math.random().toString(36).substr(2, 9),
      songId: selectedSong.id,
      title: `${bookTitle} ${selectedBibleChapter}:${rangeText}`,
      artist: versionLabel,
      type: "bible",
      verses: filteredVerses,
      verseLabels: labels,
    };

    setSchedule([...schedule, newItem]);
    setActiveTab("schedule");
  };

  const addToSchedule = (item: Song | ScheduleItem) => {
    const newItem: ScheduleItem = {
      id: Math.random().toString(36).substr(2, 9),
      songId: item.id,
      title: item.title,
      artist: (item as Song).artist || "Custom",
      type: item.id.startsWith("bible-") ? "bible" : "song",
      verses: [...item.verses],
      verseLabels: item.verseLabels ? [...item.verseLabels] : undefined,
      fontFamily: (item as any).fontFamily,
      textColor: (item as any).textColor,
      fontSizeMode: (item as any).fontSizeMode,
      fontSize: (item as any).fontSize,
      textTracking: (item as any).textTracking,
      textSpacing: (item as any).textSpacing,
      textOutline: (item as any).textOutline,
      textOutlineColor: (item as any).textOutlineColor,
      slideTransition: (item as any).slideTransition,
      textBold: (item as any).textBold,
      textItalic: (item as any).textItalic,
      textShadow: (item as any).textShadow,
      textTransform: (item as any).textTransform,
      backgroundOverride: (item as any).backgroundOverride,
      textAlign: (item as any).textAlign,
      textPosition: (item as any).textPosition,
      bgOpacity: (item as any).bgOpacity,
      bgBrightness: (item as any).bgBrightness,
      bgBlur: (item as any).bgBlur,
      bgFit: (item as any).bgFit,
      bgScale: (item as any).bgScale,
    };
    setSchedule([...schedule, newItem]);
    setActiveTab("schedule");
  };

  const removeFromSchedule = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = schedule.filter((s) => s.id !== id);
    setSchedule(updated);
    localStorage.setItem("cp_last_schedule", JSON.stringify(updated));
    localStorage.setItem("cp_service_schedule", JSON.stringify(updated));
  };

  const createNewLibrarySong = () => {
    setSearch("");
    const newSong: Song = {
      id: `lib-song-${Date.now()}`,
      title: "Lagu Baru",
      artist: "Artis",
      verses: ["Bait 1\nTuliskan lirik lagu Anda di sini."],
      verseLabels: ["Verse 1"],
      updatedAt: Date.now(),
    } as any;
    const updated = [newSong, ...librarySongs];
    setLibrarySongs(updated);
    syncSongsToBackend(updated);

    // Immediately open editor for it!
    setEditingItem({
      id: newSong.id,
      title: newSong.title,
      artist: newSong.artist,
      type: "song",
      verses: [...newSong.verses],
      verseLabels: ["Verse 1"],
    } as any);
  };

  const handleClearAllSongs = async () => {
    const confirmClear = window.confirm(
      "Apakah Anda yakin ingin menghapus SEMUA lagu dari menu lirik?",
    );
    if (confirmClear) {
      setLibrarySongs([]);
      savePersistentSongs(currentAccountId, []);
      setSelectedSong(null);
      showToast("Semua lagu berhasil dihapus!", "success");
      try {
        await syncSongsToBackend([]);
      } catch (err) {
        console.error("Gagal sinkronisasi penghapusan ke server:", err);
      }
    }
  };

  const deleteSongFromLibrary = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setSongToDelete(song);
  };

  const confirmDeleteSong = () => {
    if (!songToDelete) return;
    const updated = librarySongs.filter((l) => l.id !== songToDelete.id);
    setLibrarySongs(updated);
    if (selectedSong?.id === songToDelete.id) setSelectedSong(null);
    syncSongsToBackend(updated);
    savePersistentSongs(currentAccountId, updated);
    setSongToDelete(null);
    showToast("Lagu berhasil dihapus dari perpustakaan.", "success");
  };

  const confirmDeleteBatchSongs = () => {
    if (!batchSongsToDelete) return;
    const ids = batchSongsToDelete.map((s) => s.id);
    const updated = librarySongs.filter((l) => !ids.includes(l.id));
    setLibrarySongs(updated);
    if (selectedSong && ids.includes(selectedSong.id)) setSelectedSong(null);
    syncSongsToBackend(updated);
    savePersistentSongs(currentAccountId, updated);
    setBatchSongsToDelete(null);
    setSelectedLibrarySongIds([]);
    showToast(
      `${ids.length} lagu berhasil dihapus dari perpustakaan.`,
      "success",
    );
  };

  const saveAndApplyImportedSongs = async (
    updatedSongs: Song[],
    textMsg: string,
  ) => {
    try {
      savePersistentSongs(currentAccountId, updatedSongs);
      setLibrarySongs(updatedSongs);
      setSearch("");
      setActiveTab("library");
      if (updatedSongs.length > 0) {
        setSelectedSong(updatedSongs[0]);
      }
      setShowSongDbModal(false);
      showToast(textMsg, "success");

      // Explicit immediate sync POST to guarantee backend has latest library backup
      await syncSongsToBackend(updatedSongs);
    } catch (err: any) {
      console.error("Gagal koordinasi backup data impor:", err);
    }
  };

  const projectorUrl = getPublicUrl(`/projector?mode=share&account=${currentAccountId}`);

  const fetchBibleChapter = async (book: string, chapter: number) => {
    setIsFetchingBible(true);
    setBibleError(null);
    const version = bibleVersion;

    const customMatch = customBibles.find((cb) => cb.id === version);
    if (customMatch) {
      try {
        let verses: string[] = [];

        // Try local books if they exist (e.g. presets)
        if (customMatch.books) {
          let bookChapterObj = null;
          let matchedKey = Object.keys(customMatch.books).find(
            (b) => b.toLowerCase() === book.toLowerCase(),
          );
          if (matchedKey) {
            bookChapterObj = customMatch.books[matchedKey];
          } else {
            let targetIdx = BIBLE_BOOKS.findIndex(
              (b) => b.toLowerCase() === book.toLowerCase(),
            );
            if (targetIdx === -1) {
              const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);
              const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === book.toLowerCase());
              if (matchBatak) targetIdx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());
            }
            if (targetIdx !== -1) {
              const numericKey = String(targetIdx + 1);
              if (customMatch.books[numericKey]) {
                bookChapterObj = customMatch.books[numericKey];
              }
            }
          }

          if (bookChapterObj) {
            const rawVerses = bookChapterObj[chapter.toString()];
            if (rawVerses) {
              if (Array.isArray(rawVerses)) {
                verses = rawVerses;
              } else if (rawVerses && typeof rawVerses === "object") {
                const keys = Object.keys(rawVerses).sort(
                  (a, b) => parseInt(a) - parseInt(b),
                );
                verses = keys.map((k) => {
                  const val = rawVerses[k];
                  return typeof val === "string"
                    ? val
                    : val?.text || val?.content || JSON.stringify(val);
                });
              }
            }
          }
        }

        // On-demand fetch from database API
        if (verses.length === 0) {
          const res = await fetch(
            `/api/custom-bibles/${encodeURIComponent(version)}/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`,
          );
          const ct = res.headers.get("content-type") || "";
          if (!res.ok || !ct.includes("application/json")) {
            throw new Error(
              `Pasal ${chapter} untuk kitab ${book} gagal diambil dari database server.`,
            );
          }
          const data = await res.json();
          verses = data.verses || [];
        }

        if (!verses || !Array.isArray(verses) || verses.length === 0) {
          throw new Error(
            `Pasal ${chapter} untuk kitab ${book} tidak ditemukan di dalam database '${customMatch.name}'.`,
          );
        }

        const formatted: Song = {
          id: `bible-${version}-${book}-${chapter}`,
          title: `${book} ${chapter}`,
          artist: customMatch.name,
          verses: verses,
          verseLabels: verses.map((_, idx: number) => `Ayat ${idx + 1}`),
        };
        setSelectedSong(formatted);

        const context = `${book}-${chapter}`;
        if (currentBibleContext.current !== context && verses.length > 0) {
          setEndVerseInput(verses.length.toString());
          setStartVerseInput("1");
          currentBibleContext.current = context;
        }
      } catch (err: any) {
        console.error(err);
        setBibleError(err.message || "Gagal memuat Alkitab.");
      } finally {
        setIsFetchingBible(false);
      }
    } else {
      // Standard/Native Bible Fetch fallback (tb / toba / gntd)
      try {
        const isBatak = version === "toba";
        const isGntd = version === "gntd";
        const displayLabel =
          version === "toba"
            ? "Batak Toba"
            : version === "gntd"
              ? "Good News (GNTD)"
              : "Alkitab TB";

        const res = await fetch("/api/ai/scripture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            book: book,
            chapter: chapter,
            version: version || "tb",
          }),
        });

        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          throw new Error(
            `Gagal memuat nats ${book} ${chapter} dari Web-service.`,
          );
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error(`Nats ${book} ${chapter} tidak ditemukan di server.`);
        }

        const verses = data.map((item: any) => item.content);
        const formatted: Song = {
          id: `bible-${version || "tb"}-${book}-${chapter}`,
          title: `${book} ${chapter}`,
          artist: displayLabel,
          verses: verses,
          verseLabels: data.map((item: any, i: number) => {
            const titleParts = item.title.split(":");
            const vNum = titleParts[titleParts.length - 1] || `${i + 1}`;
            return `Ayat ${vNum}`;
          }),
        };
        setSelectedSong(formatted);

        const context = `${book}-${chapter}`;
        if (currentBibleContext.current !== context && verses.length > 0) {
          setEndVerseInput(verses.length.toString());
          setStartVerseInput("1");
          currentBibleContext.current = context;
        }
      } catch (err: any) {
        console.error(err);
        setBibleError(err.message || "Gagal memuat Alkitab.");
      } finally {
        setIsFetchingBible(false);
      }
    }
  };

  const fetchEditorScripturePreview = async (
    book: string,
    chapter: number,
    version: string,
  ) => {
    setEditorIsFetchingScrip(true);
    setEditorScripError(null);
    try {
      const customMatch = customBibles.find((cb) => cb.id === version);
      if (customMatch) {
        let verses: string[] = [];

        // Try local books if they exist (e.g. presets)
        if (customMatch.books) {
          let bookChapterObj = null;
          let matchedKey = Object.keys(customMatch.books).find(
            (b) => b.toLowerCase() === book.toLowerCase(),
          );
          if (matchedKey) {
            bookChapterObj = customMatch.books[matchedKey];
          } else {
            let targetIdx = BIBLE_BOOKS.findIndex(
              (b) => b.toLowerCase() === book.toLowerCase(),
            );
            if (targetIdx === -1) {
              const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);
              const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === book.toLowerCase());
              if (matchBatak) targetIdx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());
            }
            if (targetIdx !== -1) {
              const numericKey = String(targetIdx + 1);
              if (customMatch.books[numericKey]) {
                bookChapterObj = customMatch.books[numericKey];
              }
            }
          }

          if (bookChapterObj) {
            const rawVerses = bookChapterObj[chapter.toString()];
            if (rawVerses) {
              if (Array.isArray(rawVerses)) {
                verses = rawVerses;
              } else if (rawVerses && typeof rawVerses === "object") {
                const keys = Object.keys(rawVerses).sort(
                  (a, b) => parseInt(a) - parseInt(b),
                );
                verses = keys.map((k) => {
                  const val = rawVerses[k];
                  return typeof val === "string"
                    ? val
                    : val?.text || val?.content || JSON.stringify(val);
                });
              }
            }
          }
        }

        // On-demand fetch from database API
        if (verses.length === 0) {
          const res = await fetch(
            `/api/custom-bibles/${encodeURIComponent(version)}/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`,
          );
          const ct = res.headers.get("content-type") || "";
          if (res.ok && ct.includes("application/json")) {
            const data = await res.json();
            verses = data.verses || [];
          }
        }

        if (verses && Array.isArray(verses) && verses.length > 0) {
          setEditorScripPreviewList(
            verses.map((c, i) => ({ vNum: i + 1, content: c })),
          );
        } else {
          setEditorScripPreviewList([]);
          setEditorScripError(
            `Pasal ${chapter} tidak ditemukan di database '${customMatch.name}'`,
          );
        }
      } else {
        // Standard/Native Bible Fetch fallback (tb / toba / gntd)
        const res = await fetch("/api/ai/scripture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            book: book,
            chapter: chapter,
            version: version || "tb",
          }),
        });

        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setEditorScripPreviewList(
              data.map((item: any, i: number) => {
                const titleParts = item.title.split(":");
                const vNum =
                  parseInt(titleParts[titleParts.length - 1]) || i + 1;
                return { vNum, content: item.content };
              }),
            );
          } else {
            setEditorScripPreviewList([]);
            setEditorScripError(`Pasal ${chapter} tidak ditemukan di server.`);
          }
        } else {
          throw new Error("Gagal mengambil nats dari server.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setEditorScripError(err.message || "Gagal memuat ayat.");
      setEditorScripPreviewList([]);
    } finally {
      setEditorIsFetchingScrip(false);
    }
  };

  const insertScriptureToEditor = (individual: boolean) => {
    // Slices list based on start and end
    const startIdx = Math.max(0, editorScripStartVerse - 1);
    const endIdx = Math.min(editorScripPreviewList.length, editorScripEndVerse);
    const sliced = editorScripPreviewList.slice(startIdx, endIdx);
    if (sliced.length === 0) return;

    const newVerses = [...editingItem.verses];
    const isBible =
      editingItem.id?.startsWith("bible-") || editingItem.type === "bible";
    const originalLabels = editingItem.verseLabels
      ? [...editingItem.verseLabels]
      : editingItem.verses.map((_, idx) =>
          isBible ? `Ayat ${idx + 1}` : `Verse ${idx + 1}`,
        );
    const tempLabels = [...originalLabels];

    if (individual) {
      // Insert every verse as its own slide
      sliced.forEach((v, index) => {
        const insertPos = editorPreviewIdx + 1 + index;
        newVerses.splice(insertPos, 0, v.content);
        tempLabels.splice(
          insertPos,
          0,
          `${editorScripBook} ${editorScripChapter}:${v.vNum}`,
        );
      });
      setEditorPreviewIdx(editorPreviewIdx + sliced.length);
    } else {
      // Insert as a single combined slide
      const combinedText = sliced
        .map((v) => `${v.vNum}. ${v.content}`)
        .join("\n");
      const insertPos = editorPreviewIdx + 1;
      newVerses.splice(insertPos, 0, combinedText);
      tempLabels.splice(
        insertPos,
        0,
        `${editorScripBook} ${editorScripChapter}:${editorScripStartVerse}-${editorScripEndVerse}`,
      );
      setEditorPreviewIdx(insertPos);
    }

    const newLabels = regenerateSlideLabels(newVerses, tempLabels, isBible);
    const updatedItem = {
      ...editingItem,
      verses: newVerses,
      verseLabels: newLabels,
    };
    setEditingItem(updatedItem);

    if (selectedSong && selectedSong.id === updatedItem.id) {
      setSelectedSong(updatedItem as any);
    }
    const newSched = schedule.map((s) =>
      s.id === updatedItem.id ? updatedItem : s,
    );
    setSchedule(newSched);
    localStorage.setItem("cp_last_schedule", JSON.stringify(newSched));
    showToast(`Berhasil menyisipkan ${sliced.length} ayat!`, "success");
  };

  const handleAISearch = async () => {
    if (!search) return;
    setIsSearchingAI(true);
    try {
      const response = await fetch("/api/ai/scripture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: search }),
      });
      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error(data.error || "Search failed");
      }

      const formatted: Song[] = data.map((item: any, idx: number) => ({
        id: `ai-${idx}`,
        title: item.title,
        artist: "AI Scripture",
        verses: [item.content],
      }));
      setAiResults(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingAI(false);
    }
  };

  const filteredSongs = useMemo(() => {
    const cleanQuery = search.trim().toLowerCase();
    let baseList = [...librarySongs];
    if (cleanQuery) {
      baseList = baseList.filter((s) => {
        const matchTitle =
          s.title && s.title.toLowerCase().includes(cleanQuery);
        const matchArtist =
          s.artist && s.artist.toLowerCase().includes(cleanQuery);
        const matchVerses =
          s.verses &&
          s.verses.some((v) => v && v.toLowerCase().includes(cleanQuery));
        return matchTitle || matchArtist || matchVerses;
      });
    }

    if (songSortMode === "alphabetical") {
      baseList.sort((a, b) => {
        const titleA = (a.title || "").trim().toLowerCase();
        const titleB = (b.title || "").trim().toLowerCase();
        return titleA.localeCompare(titleB);
      });
    } else if (songSortMode === "edited") {
      baseList.sort((a, b) => {
        const timeA = (a as any).updatedAt || 0;
        const timeB = (b as any).updatedAt || 0;
        if (timeA !== timeB) return timeB - timeA;
        return (a.title || "")
          .trim()
          .toLowerCase()
          .localeCompare((b.title || "").trim().toLowerCase());
      });
    } else if (songSortMode === "number") {
      baseList.sort((a, b) => {
        const titleA = (a.title || "").trim().toLowerCase();
        const titleB = (b.title || "").trim().toLowerCase();
        const numA = parseInt((titleA.match(/\d+/) || [])[0] || "0", 10);
        const numB = parseInt((titleB.match(/\d+/) || [])[0] || "0", 10);
        if (numA !== numB) return numA - numB;
        return titleA.localeCompare(titleB);
      });
    }

    return [...baseList, ...aiResults];
  }, [search, librarySongs, aiResults, songSortMode]);

  const filteredPresentations = useMemo(() => {
    const cleanQuery = search.trim().toLowerCase();
    let baseList = [...libraryPresentations];
    if (cleanQuery) {
      baseList = baseList.filter((s) => {
        const matchTitle =
          s.title && s.title.toLowerCase().includes(cleanQuery);
        const matchVerses =
          s.verses &&
          s.verses.some((v) => v && v.toLowerCase().includes(cleanQuery));
        return matchTitle || matchVerses;
      });
    }
    return baseList;
  }, [search, libraryPresentations]);

  function selectAllSchedule() {
    setSelectedScheduleIds(schedule.map((s) => s.id));
    setSelectedLibrarySongIds([]);
    showToast(`Memilih semua ${schedule.length} item jadwal`, "info");
  }

  function selectAllLibrary() {
    if (filteredSongs.length === 0) return;
    setSelectedLibrarySongIds(filteredSongs.map((s) => s.id));
    setSelectedScheduleIds([]);
    showToast(
      `Memilih semua ${filteredSongs.length} lagu hasil pencarian`,
      "info",
    );
  }

  function selectAllBible() {
    if (!selectedSong || !selectedSong.id.startsWith("bible-")) {
      showToast("Pilih pasal Alkitab terlebih dahulu", "warn");
      return;
    }
    const total = selectedSong.verses.length;
    setStartVerse(1);
    setStartVerseInput("1");
    setEndVerse(total);
    setEndVerseInput(total.toString());
    showToast(
      `Memilih semua ${total} ayat di ${selectedSong.title}`,
      "success",
    );
  }

  const handleVerseClick = (
    content: string,
    title: string,
    parentId?: string,
    slideIdx?: number,
  ) => {
    let styleObj: any = {};
    if (parentId) {
      // Look up schedule item or active song for custom styling
      const schItem = schedule.find(
        (s) => s.id === parentId || s.songId === parentId,
      );
      if (schItem) {
        styleObj = {
          textColor: schItem.textColor,
          fontSizeMode: schItem.fontSizeMode,
          fontSize: schItem.fontSize,
          textAlign: schItem.textAlign,
          textPosition: schItem.textPosition,
          textBold: schItem.textBold,
          textItalic: schItem.textItalic,
          textShadow: schItem.textShadow,
          fontFamily: schItem.fontFamily,
          textTransform: schItem.textTransform,
          backgroundOverride: schItem.backgroundOverride,
          textTracking: schItem.textTracking,
          textSpacing: schItem.textSpacing,
          slideTransition: schItem.slideTransition,
          textOutline: schItem.textOutline,
          textOutlineColor: schItem.textOutlineColor,
          bgOpacity: schItem.bgOpacity,
          bgBrightness: schItem.bgBrightness,
          bgBlur: schItem.bgBlur,
          bgFit: schItem.bgFit,
          bgScale: schItem.bgScale,
          logoLeftUrl: schItem.logoLeftUrl,
          logoRightUrl: schItem.logoRightUrl,
          logoUrl: schItem.logoUrl,
          logoPosition: schItem.logoPosition,
          shapeDecoration: schItem.shapeDecoration,
          bgPositionX: schItem.bgPositionX,
          bgPositionY: schItem.bgPositionY,
        };
      } else if (selectedSong && selectedSong.id === parentId) {
        const sSong = selectedSong as any;
        styleObj = {
          textColor: sSong.textColor,
          fontSizeMode: sSong.fontSizeMode,
          fontSize: sSong.fontSize,
          textAlign: sSong.textAlign,
          textPosition: sSong.textPosition,
          textBold: sSong.textBold,
          textItalic: sSong.textItalic,
          textShadow: sSong.textShadow,
          fontFamily: sSong.fontFamily,
          textTransform: sSong.textTransform,
          backgroundOverride: sSong.backgroundOverride,
          textTracking: sSong.textTracking,
          textSpacing: sSong.textSpacing,
          slideTransition: sSong.slideTransition,
          textOutline: sSong.textOutline,
          textOutlineColor: sSong.textOutlineColor,
          bgOpacity: sSong.bgOpacity,
          bgBrightness: sSong.bgBrightness,
          bgBlur: sSong.bgBlur,
          bgFit: sSong.bgFit,
          bgScale: sSong.bgScale,
          logoLeftUrl: sSong.logoLeftUrl,
          logoRightUrl: sSong.logoRightUrl,
          logoUrl: sSong.logoUrl,
          logoPosition: sSong.logoPosition,
          shapeDecoration: sSong.shapeDecoration,
          bgPositionX: sSong.bgPositionX,
          bgPositionY: sSong.bgPositionY,
        };
      }
    }

    const newSlide: Slide = {
      content,
      title,
      parentId,
      slideIdx,
      background: activeBackground,
      type: title.includes(":") ? "scripture" : "lyrics",
      ...styleObj,
    };

    // Always update operator's preview
    setPreviewSlide(newSlide);
    standbySlide.current = newSlide;

    // Only update the projector if LIVE and NO override is active
    if (isLive && !masterOverride) {
      changeSlide(newSlide);
    }
  };

  const handleBackgroundSelect = (bg: string) => {
    setActiveBackground(bg);

    // Identify the active item's ID
    const activeId = previewSlide?.parentId || selectedSong?.id;

    // 1. If currently in editing mode (editingItem is present), also set its backgroundOverride
    if (editingItem) {
      setEditingItem({ ...editingItem, backgroundOverride: bg });
    }

    if (activeId) {
      // 2. Find and update the active schedule item
      const hasSchedItem = schedule.find(
        (s) => s.id === activeId || s.songId === activeId,
      );
      if (hasSchedItem) {
        const updatedSchedule = schedule.map((s) => {
          if (s.id === activeId || s.songId === activeId) {
            return { ...s, backgroundOverride: bg };
          }
          return s;
        });
        setSchedule(updatedSchedule);
        localStorage.setItem(
          "cp_last_schedule",
          JSON.stringify(updatedSchedule),
        );
      }

      // 3. Find and update the selected song in memory
      if (selectedSong && selectedSong.id === activeId) {
        const updatedSong = { ...selectedSong, backgroundOverride: bg };
        setSelectedSong(updatedSong as any);
      }

      // 4. Update the song in the song library database and sync
      const existsInLibrary = librarySongs.some((ls) => ls.id === activeId);
      if (existsInLibrary) {
        const updatedSongsList = librarySongs.map((ls) => {
          if (ls.id === activeId) {
            return { ...ls, backgroundOverride: bg, updatedAt: Date.now() };
          }
          return ls;
        });
        setLibrarySongs(updatedSongsList);
        savePersistentSongs(currentAccountId, updatedSongsList);
        syncSongsToBackend(updatedSongsList);
      }
    }

    // 5. Update the live slide and preview slide immediately on 1st click
    const baseSlide = previewSlide || currentSlide || {
      content: "",
      title: "",
      type: "announcement" as const,
    };

    const updatedSlide: Slide = {
      ...baseSlide,
      background: bg,
      backgroundOverride: bg,
      isLive: true,
    };

    setPreviewSlide(updatedSlide);
    standbySlide.current = updatedSlide;

    // Only replace live output if NO masterOverride (logo/black/clear/qr) is active;
    // when an override IS active, the activeBackground effect keeps override & Mobile Share synced.
    if (isLive && !masterOverride) {
      changeSlide(updatedSlide);
    }
  };

  useEffect(() => {
    if (
      !isAutoPlay ||
      !selectedSong ||
      !previewSlide ||
      previewSlide.slideIdx === undefined
    )
      return;

    const interval = setInterval(() => {
      const currentIdx = previewSlide.slideIdx;
      if (currentIdx === undefined) return;
      const nextIdx = (currentIdx + 1) % selectedSong.verses.length;

      const labels = selectedSong.verseLabels || [];
      const isBible =
        selectedSong.id.startsWith("bible-") ||
        (selectedSong as any).type === "bible";
      const verse = selectedSong.verses[nextIdx];
      const bibleVerseNum = getBibleVerseLabel(labels, nextIdx);
      const displayContent = isBible
        ? `${bibleVerseNum}. ${verse}`
        : verse;
      const displayTitle = isBible
        ? `${selectedSong.title.split(":")[0]}:${bibleVerseNum}`
        : selectedSong.title;

      handleVerseClick(displayContent, displayTitle, selectedSong.id, nextIdx);
    }, slideSpeed * 1000);

    return () => clearInterval(interval);
  }, [isAutoPlay, selectedSong, previewSlide, slideSpeed]);

  const toggleLive = () => {
    const nextLive = !isLive;
    setIsLive(nextLive);

    if (nextLive) {
      // Going LIVE: Priority to masterOverride, then current selection
      if (masterOverride) {
        if (masterOverride === "black") {
          changeSlide({
            content: "",
            title: "",
            background: "",
            type: "announcement",
            isLive: true,
          });
        } else if (masterOverride === "clear") {
          changeSlide({
            content: "",
            title: "",
            background: activeBackground,
            type: "announcement",
            isLive: true,
          });
        } else if (masterOverride === "logo") {
          changeSlide({
            content: "",
            title: "",
            background: activeBackground,
            type: "logo",
            isLive: true,
          });
        } else if (masterOverride === "qr") {
          changeSlide({
            content: getPublicUrl(`/projector?mode=share&account=${currentAccountId}`),
            title: "REMOTE CONTROL",
            background: activeBackground,
            type: "qr",
            isLive: true,
          });
        }
      } else {
        const toSend = previewSlide || standbySlide.current;
        if (toSend) {
          changeSlide({ ...toSend, isLive: true });
        }
      }
    } else {
      // Going OFFLINE: Clear the projector to black/standby
      changeSlide({
        content: "System Offline",
        title: "",
        background: "",
        type: "announcement",
        isLive: false,
      });
    }
  };

  const toggleMasterOverride = (type: "black" | "clear" | "logo" | "qr") => {
    if (masterOverride === type) {
      // Toggle OFF: Restore from buffered slide
      setMasterOverride(null);
      if (standbySlide.current) {
        changeSlide(standbySlide.current);
      } else {
        // Fallback to empty if nothing buffered
        changeSlide({
          content: "",
          title: "",
          background: "",
          type: "announcement",
        });
      }
    } else {
      // Toggle ON: Save current selection as standby if not already overridden
      if (!masterOverride && currentSlide) {
        standbySlide.current = { ...currentSlide };
      }

      setMasterOverride(type);

      if (type === "black") {
        changeSlide({
          content: "",
          title: "",
          background: "",
          type: "announcement",
        });
      } else if (type === "clear") {
        changeSlide({
          content: "",
          title: "",
          background: activeBackground,
          type: "announcement",
        });
      } else if (type === "logo") {
        changeSlide({
          content: "",
          title: "",
          background: activeBackground,
          type: "logo",
        });
      } else if (type === "qr") {
        changeSlide({
          content: getPublicUrl(`/projector?mode=share&account=${currentAccountId}`),
          title: "REMOTE CONTROL",
          background: activeBackground,
          type: "qr",
        });
      }
    }
  };

  // Sync background changes to standby and live overrides
  useEffect(() => {
    if (standbySlide.current) {
      standbySlide.current = {
        ...standbySlide.current,
        background: activeBackground,
      };
    }
    if (previewSlide) {
      setPreviewSlide({ ...previewSlide, background: activeBackground });
    }

    if (isLive && !masterOverride) {
      if (standbySlide.current) {
        changeSlide(standbySlide.current);
      }
    } else if (
      isLive &&
      (masterOverride === "clear" ||
        masterOverride === "logo" ||
        masterOverride === "qr")
    ) {
      // Update the override slide with NEW background live
      if (masterOverride === "clear") {
        changeSlide({
          content: "",
          title: "",
          background: activeBackground,
          type: "announcement",
        });
      } else if (masterOverride === "logo") {
        changeSlide({
          content: "",
          title: "",
          background: activeBackground,
          type: "logo",
        });
      } else if (masterOverride === "qr") {
        changeSlide({
          content: getPublicUrl(`/projector?mode=share&account=${currentAccountId}`),
          title: "REMOTE CONTROL",
          background: activeBackground,
          type: "qr",
        });
      }
    }
  }, [activeBackground]);

  const handleMenuAction = (action: string) => {
    setActiveMenu(null);
    setShowNewSubmenu(false);
    if (action === "new-song") {
      const title = "Lagu Baru";
      const newItem: ScheduleItem = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        artist: "Manual Entry",
        type: "song",
        verses: ["Bait 1 lirik di sini\nBaris kedua lirik lagu"],
        verseLabels: ["Bait 1"],
      };
      setSchedule((prev) => [...prev, newItem]);
      setSelectedSong(newItem as any);
      setEditingItem(newItem);
    } else if (action === "new-bible") {
      const title = "Ayat Alkitab Baru";
      const newItem: ScheduleItem = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        artist: "Alkitab",
        type: "bible",
        verses: [
          "Yohanes 3:16\nKarena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.",
        ],
        verseLabels: ["Yohanes 3:16"],
      };
      setSchedule((prev) => [...prev, newItem]);
      setSelectedSong(newItem as any);
      setEditingItem(newItem);
    } else if (action === "new-presentation") {
      const title = "Presentasi Baru";
      const newItem: ScheduleItem = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        type: "slide",
        verses: ["Slide Content 1", "Slide Content 2"],
        verseLabels: ["Slide 1", "Slide 2"],
      };
      setSchedule((prev) => [...prev, newItem]);
      setSelectedSong(newItem as any);
      setEditingItem(newItem);
    } else if (action === "open-project") {
      setShowOpenModal(true);
    } else if (action === "save-project") {
      setShowSaveModal(true);
    } else if (action === "blackout") {
      toggleMasterOverride("black");
    } else if (action === "bible-db") {
      setActiveTab("bible");
    }
  };

  return (
    <div
      className="flex flex-col h-screen bg-[#0A0A0B] text-gray-300 font-sans overflow-hidden"
      onClick={() => setActiveMenu(null)}
    >
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-4 py-2 bg-[#161618] border-b border-[#2A2A2E] z-50">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <AppLogo
              className="w-9 h-9"
              showText={false}
              bgWhiteSquare={true}
            />
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tighter text-white uppercase leading-none">
                Church
              </span>
              <span className="font-medium text-[10px] tracking-[0.2em] text-blue-400 uppercase leading-none mt-1">
                Presenter
              </span>
            </div>
          </div>
          <div className="flex space-x-4 text-[10px] font-bold text-gray-400 relative">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === "file" ? null : "file");
                }}
                className={`hover:text-white transition-colors uppercase ${activeMenu === "file" ? "text-white" : ""}`}
              >
                FILE
              </button>
              <AnimatePresence>
                {activeMenu === "file" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-48 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-1 z-[100]"
                  >
                    <div
                      className="relative"
                      onMouseEnter={() => setShowNewSubmenu(true)}
                      onMouseLeave={() => setShowNewSubmenu(false)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewSubmenu(!showNewSubmenu);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between ${showNewSubmenu ? "bg-blue-600 text-white" : ""}`}
                      >
                        New{" "}
                        <ChevronRight
                          className={`w-3 h-3 opacity-50 transition-transform ${showNewSubmenu ? "rotate-90" : ""}`}
                        />
                      </button>
                      <AnimatePresence>
                        {showNewSubmenu && (
                          <motion.div
                            initial={{ opacity: 0, x: 5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 5 }}
                            className="absolute left-[95%] -top-1 w-44 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-1 z-[110]"
                          >
                            <button
                              onClick={() => handleMenuAction("new-song")}
                              className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider"
                            >
                              Song <Music className="w-3 h-3 opacity-50" />
                            </button>
                            <button
                              onClick={() =>
                                handleMenuAction("new-presentation")
                              }
                              className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider"
                            >
                              Presentation{" "}
                              <FileText className="w-3 h-3 opacity-50" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      onClick={() => handleMenuAction("open-project")}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Open Project <FolderOpen className="w-3 h-3 opacity-50" />
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => handleMenuAction("save-project")}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Save Project <Save className="w-3 h-3 opacity-50" />
                    </button>
                    <button
                      onClick={() => {
                        setShowPresentationModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Save Presentation <FileText className="w-3 h-3 opacity-50" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === "edit" ? null : "edit");
                }}
                className={`hover:text-white transition-colors uppercase ${activeMenu === "edit" ? "text-white" : ""}`}
              >
                EDIT
              </button>
              <AnimatePresence>
                {activeMenu === "edit" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-48 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-1 z-[100]"
                  >
                    <button
                      onClick={() => {
                        triggerUndo();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Undo Action{" "}
                      <span className="text-[8px] bg-zinc-800 text-gray-400 px-1 rounded">
                        Ctrl+Z
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        triggerRedo();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Redo Action{" "}
                      <span className="text-[8px] bg-zinc-800 text-gray-400 px-1 rounded">
                        Ctrl+Y
                      </span>
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => {
                        toggleMasterOverride("clear");
                        showToast(
                          "Output teks di proyektor berhasil dibersihkan",
                          "info",
                        );
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      Clear Text Output
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === "media" ? null : "media");
                }}
                className={`hover:text-white transition-colors uppercase ${activeMenu === "media" ? "text-white" : ""}`}
              >
                MEDIA
              </button>
              <AnimatePresence>
                {activeMenu === "media" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-48 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-1 z-[100]"
                  >
                    <button
                      onClick={() => {
                        setShowMediaLibraryModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Change Background{" "}
                      <ImageIcon className="w-3 h-3 opacity-50" />
                    </button>
                    <button
                      onClick={() => {
                        bgFileInputRef.current?.click();
                        setActiveMenu(null);
                        showToast(
                          "Pilih video loop dari komputer Anda untuk ditambahkan",
                          "info",
                        );
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Add Video Loop <Video className="w-3 h-3 opacity-50" />
                    </button>
                    <button
                      onClick={() => {
                        setShowMediaLibraryModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Media Library{" "}
                      <FolderOpen className="w-3 h-3 opacity-50" />
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => {
                        setShowBibleDbModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-amber-600 hover:text-white transition-colors flex items-center justify-between text-xs"
                    >
                      Database Alkitab{" "}
                      <Book className="w-3.5 h-3.5 text-amber-500 opacity-85" />
                    </button>
                    <button
                      onClick={() => {
                        setShowSongDbModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between text-xs"
                    >
                      Database Lagu{" "}
                      <ListMusic className="w-3.5 h-3.5 text-blue-400 opacity-85" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === "view" ? null : "view");
                }}
                className={`hover:text-white transition-colors uppercase ${activeMenu === "view" ? "text-white" : ""}`}
              >
                View
              </button>
              <AnimatePresence>
                {activeMenu === "view" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-48 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-1 z-[100]"
                  >
                    <button
                      onClick={() => {
                        openProjectorExtendWindow(currentAccountId);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between text-emerald-400 font-bold"
                    >
                      Buka Ekstend (Monitor 2){" "}
                      <Monitor className="w-3.5 h-3.5 opacity-85" />
                    </button>
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      Toggle Fullscreen{" "}
                      <Sliders className="w-3.5 h-3.5 opacity-55" />
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => {
                        setShowAudioMonitorsModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-between text-blue-400 font-bold"
                    >
                      Audio Monitors & Pad{" "}
                      <Mic2 className="w-3.5 h-3.5 opacity-75" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SETTING Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(
                    activeMenu === "settings_menu" ? null : "settings_menu",
                  );
                }}
                className={`hover:text-white transition-colors uppercase flex items-center gap-1 ${activeMenu === "settings_menu" ? "text-white" : ""}`}
              >
                Setting
              </button>
              <AnimatePresence>
                {activeMenu === "settings_menu" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-48 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-2 z-[100]"
                  >
                    <button
                      onClick={() => {
                        setShowSettingsModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-xs"
                    >
                      <Sliders className="w-3.5 h-3.5" /> Atur Kecepatan Slide
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-xs"
                    >
                      <Monitor className="w-3.5 h-3.5" /> Atur Output Tampilan
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => {
                        setShowSettingsModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-xs text-blue-500 font-bold"
                    >
                      <Settings className="w-3.5 h-3.5 animate-spin-slow" />{" "}
                      Pengaturan Sistem...
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SHIFT Menu */}
            <div className="relative flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShiftModal(true);
                  setActiveMenu(null);
                }}
                className={`hover:text-white transition-all uppercase flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 ${currentShift?.active ? "text-emerald-400 font-black" : "text-gray-400"}`}
                title="Atur Shift & Jadwal Penutupan Mobile Share"
              >
                <span className="relative flex h-2 w-2">
                  {currentShift?.active && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${currentShift?.active ? "bg-emerald-500" : "bg-zinc-600"}`}
                  ></span>
                </span>
                <span>Shift</span>
              </button>
            </div>

            {/* AKUN Menu */}
            <div className="relative border-l border-[#2A2A2E]/50 pl-4 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(
                    activeMenu === "akun_menu" ? null : "akun_menu",
                  );
                }}
                className={`hover:text-white transition-colors uppercase flex items-center gap-1.5 ${activeMenu === "akun_menu" ? "text-white" : ""}`}
              >
                <User className="w-3.5 h-3.5 text-blue-400" /> AKUN
              </button>
              <AnimatePresence>
                {activeMenu === "akun_menu" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-6 left-0 w-52 bg-[#1C1C1F] border border-[#2A2A2E] rounded shadow-2xl py-2 z-[100]"
                  >
                    <div className="px-4 py-2 border-b border-[#2A2A2E] mb-1.5">
                      <div className="text-[10px] text-gray-200 uppercase tracking-wider font-extrabold truncate max-w-[170px]">
                        {username}
                      </div>
                      <div className="text-[8px] text-blue-400 uppercase font-black tracking-widest mt-0.5">
                        {userRole}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowAccountModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                    >
                      <User className="w-3.5 h-3.5 opacity-70" /> Profil
                      Operator
                    </button>
                    <button
                      onClick={() => {
                        setShowAccountModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
                    >
                      <KeyRound className="w-3.5 h-3.5 opacity-70" /> Atur PIN
                      Akses
                    </button>
                    <div className="h-px bg-[#2A2A2E] my-1" />
                    <button
                      onClick={() => {
                        setActiveMenu(null);
                        showToast(
                          `Sesi operator ${username} berhasil keluar`,
                          "info",
                        );
                        setTimeout(() => navigate("/"), 600);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-rose-600 hover:text-white text-rose-400 transition-colors flex items-center gap-2 text-xs font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5 opacity-70" /> Keluar Sesi
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Active User Avatar Badge (Quick access to Account profile) */}
          <button
            onClick={() => navigate("/")}
            title="Klik untuk berpindah atau mengelola Akun Gereja"
            className="flex items-center gap-2 px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 hover:border-blue-500/60 rounded-lg group transition-all text-left"
          >
            <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center text-[10px] font-black text-blue-300 uppercase tracking-tight">
              {currentAccount.name ? currentAccount.name.charAt(0) : "G"}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-[9px] font-black text-blue-200 group-hover:text-white transition-colors leading-none tracking-tight truncate max-w-[140px]">
                {currentAccount.name}
              </span>
              <span className="text-[7.5px] text-blue-400 font-mono leading-none mt-0.5">
                @{currentAccount.username}
              </span>
            </div>
          </button>

          <div className="w-[1px] h-4 bg-[#2A2A2E]"></div>

          <div className="flex items-center space-x-1.5">
            <div
              className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
            ></div>
            <span
              className={`text-[10px] uppercase font-bold ${isLive ? "text-emerald-400" : "text-amber-400"}`}
            >
              {isLive ? "Live Output Active" : "Standby / Sync Paused"}
            </span>
          </div>
          <div className="w-[1px] h-4 bg-[#2A2A2E]"></div>
          <button
            onClick={toggleLive}
            className={`${isLive ? "bg-red-600 animate-pulse" : "bg-gray-800 hover:bg-gray-700"} text-white px-4 py-1.5 rounded text-[10px] font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2 cursor-pointer`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-white" : "bg-gray-400"}`}
            ></div>
            {isLive ? "Live" : "Standby"}
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Library */}
        <aside className="w-64 bg-[#111112] border-r border-[#2A2A2E] flex flex-col">
          <div className="flex border-b border-[#2A2A2E]">
            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "schedule" ? "text-blue-500 bg-blue-500/5" : "text-gray-600 hover:text-gray-400"}`}
            >
              Schedule
            </button>
            <button
              onClick={() => setActiveTab("library")}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "library" ? "text-blue-500 bg-blue-500/5" : "text-gray-600 hover:text-gray-400"}`}
            >
              Song
            </button>
            <button
              onClick={() => setActiveTab("bible")}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "bible" ? "text-blue-500 bg-blue-500/5" : "text-gray-600 hover:text-gray-400"}`}
            >
              Bible
            </button>
            <button
              onClick={() => setActiveTab("presentations")}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "presentations" ? "text-blue-500 bg-blue-500/5" : "text-gray-600 hover:text-gray-400"}`}
            >
              Present
            </button>
          </div>

          {activeTab === "schedule" && (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0A0B]/50">
              <div className="text-[9px] font-black text-gray-500 uppercase px-4 py-3 tracking-widest flex justify-between items-center select-none border-b border-[#2A2A2E]/30">
                <span>
                  Service Plan{" "}
                  <span className="text-blue-500 ml-1">
                    ({schedule.length} Items)
                  </span>
                </span>
                {schedule.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllSchedule}
                    className="text-blue-400 hover:text-blue-300 transition-colors uppercase font-black text-[8px] hover:underline"
                    title="Pilih semua item jadwal (Ctrl+A)"
                  >
                    Pilih Semua
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
                {schedule.length === 0 && (
                  <div className="py-10 text-center opacity-20 flex flex-col items-center">
                    <Layers className="w-8 h-8 mb-2" />
                    <p className="text-[9px] uppercase font-bold">
                      No items in schedule
                    </p>
                  </div>
                )}
                {schedule.map((item, idx) => {
                  const isMultiSelected = selectedScheduleIds.includes(item.id);
                  const hasMultiSelection = selectedScheduleIds.length > 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (hasMultiSelection) {
                          setSelectedScheduleIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id],
                          );
                        } else {
                          setSelectedSong(item as any);
                        }
                      }}
                      onContextMenu={(e) =>
                        handleContextMenu(e, "schedule_item", item)
                      }
                      className={`w-full group flex items-center px-3 py-3 rounded text-[11px] cursor-pointer transition-all border border-transparent ${
                        isMultiSelected
                          ? "bg-blue-600/35 text-blue-300 border-blue-500/50 shadow-md shadow-blue-950/40"
                          : selectedSong?.id === item.id
                            ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                            : "hover:bg-[#1C1C1F] text-gray-400"
                      }`}
                    >
                      <div
                        className="mr-3 flex items-center justify-center shrink-0"
                        onClick={(e) => {
                          if (hasMultiSelection) {
                            e.stopPropagation();
                            setSelectedScheduleIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id],
                            );
                          }
                        }}
                      >
                        {hasMultiSelection ? (
                          <input
                            type="checkbox"
                            checked={isMultiSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded border-[#2A2A2E] bg-[#1a1a1c] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        ) : (
                          <span className="text-gray-600 group-hover:text-blue-500 font-mono text-[9px]">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <div className="truncate font-bold tracking-tight">
                          {item.title}
                        </div>
                        <div className="text-[9px] opacity-40 uppercase tracking-tighter truncate">
                          {item.artist}
                        </div>
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                          className="p-1 hover:text-white"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => removeFromSchedule(item.id, e)}
                          className="p-1 hover:text-red-500"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedScheduleIds.length > 0 && (
                <div className="bg-[#161618] border-t border-[#2A2A2E] p-2 flex items-center justify-between gap-2 shadow-2xl shrink-0 z-10 animate-fade-in">
                  <span className="text-[10px] font-black uppercase text-blue-400 pl-1">
                    {selectedScheduleIds.length} Terpilih
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = schedule.filter(
                          (s) => !selectedScheduleIds.includes(s.id),
                        );
                        setSchedule(updated);
                        localStorage.setItem(
                          "cp_last_schedule",
                          JSON.stringify(updated),
                        );
                        localStorage.setItem(
                          "cp_service_schedule",
                          JSON.stringify(updated),
                        );
                        setSelectedScheduleIds([]);
                        showToast(
                          "Berhasil menghapus item terpilih dari jadwal",
                          "success",
                        );
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-black text-[9px] rounded uppercase flex items-center gap-1 transition-all"
                    >
                      <Trash className="w-3 h-3" /> Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedScheduleIds([])}
                      className="px-2 py-1 bg-[#2A2A2E] hover:bg-[#3A3A3F] text-gray-300 font-bold text-[9px] rounded uppercase transition-all"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "library" ? (
            <>
              <div className="p-3">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1.5 w-3 h-3 text-white/20" />
                    <input
                      type="text"
                      placeholder="Cari Lagu / Song Search..."
                      className="w-full bg-[#1C1C1F] border border-[#2A2A2E] rounded px-8 py-1 text-[11px] focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-all"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAISearch}
                    disabled={isSearchingAI || !search}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 p-1 rounded transition-colors"
                  >
                    {isSearchingAI ? (
                      <div className="w-4 h-4 border border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* EW7 Library Management Header Button */}
              <div className="px-3 pb-2 border-b border-[#2A2A2E]/50 flex items-center justify-between gap-1 select-none">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">
                    Lagu
                  </span>
                  {filteredSongs.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllLibrary}
                      className="text-blue-400 hover:text-blue-300 text-[8px] font-black uppercase tracking-wider hover:underline"
                      title="Pilih semua lagu pencarian (Ctrl+A)"
                    >
                      Pilih Semua
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-[#161618] border border-[#2A2A2E] p-0.5 rounded text-[8px] select-none text-zinc-500 font-black uppercase tracking-wider shrink-0">
                  <span className="text-[7px] text-zinc-650 px-1 font-bold">
                    sort:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSongSortMode("default");
                      localStorage.setItem("cp_song_sort_mode", "default");
                    }}
                    className={`px-1 rounded transition-all select-none ${songSortMode === "default" ? "bg-[#2A2A2E] text-blue-400 font-extrabold" : "hover:text-zinc-300"}`}
                    title="Urutan Bawaan"
                  >
                    Bawaan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSongSortMode("alphabetical");
                      localStorage.setItem("cp_song_sort_mode", "alphabetical");
                    }}
                    className={`px-1 rounded transition-all flex items-center gap-0.5 select-none ${songSortMode === "alphabetical" ? "bg-[#2A2A2E] text-blue-400 font-extrabold" : "hover:text-zinc-300"}`}
                    title="Urutkan Berdasarkan Abjad (A-Z)"
                  >
                    <CaseSensitive className="w-2.5 h-2.5" /> Abjad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSongSortMode("number");
                      localStorage.setItem("cp_song_sort_mode", "number");
                    }}
                    className={`px-1 rounded transition-all flex items-center gap-0.5 select-none ${songSortMode === "number" ? "bg-[#2A2A2E] text-blue-400 font-extrabold" : "hover:text-zinc-300"}`}
                    title="Urutkan Berdasarkan Angka/Nomor Buku Lagu"
                  >
                    <Hash className="w-2.5 h-2.5" /> Nomor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSongSortMode("edited");
                      localStorage.setItem("cp_song_sort_mode", "edited");
                    }}
                    className={`px-1 rounded transition-all flex items-center gap-0.5 select-none ${songSortMode === "edited" ? "bg-[#2A2A2E] text-blue-400 font-extrabold" : "hover:text-zinc-300"}`}
                    title="Urutkan Berdasarkan Waktu Terakhir Diedit"
                  >
                    <Clock className="w-2.5 h-2.5" /> Edit
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar py-2">
                  {filteredSongs.length === 0 ? (
                    <div className="py-8 text-center text-gray-600 text-[10px] uppercase font-bold">
                      No items found
                    </div>
                  ) : (
                    filteredSongs.map((song) => {
                      const isMultiSelected = selectedLibrarySongIds.includes(
                        song.id,
                      );
                      const hasMultiSelection =
                        selectedLibrarySongIds.length > 0;
                      return (
                        <div
                          key={song.id}
                          className={`w-full group flex items-center px-2 py-2 rounded text-[11px] cursor-pointer transition-all border border-transparent ${
                            isMultiSelected
                              ? "bg-blue-600/35 text-blue-300 border-blue-500/50 shadow-md shadow-blue-950/40"
                              : selectedSong?.id === song.id
                                ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                                : "hover:bg-[#1C1C1F] text-gray-400"
                          }`}
                          onClick={() => {
                            if (hasMultiSelection) {
                              setSelectedLibrarySongIds((prev) =>
                                prev.includes(song.id)
                                  ? prev.filter((id) => id !== song.id)
                                  : [...prev, song.id],
                              );
                            } else {
                              setSelectedSong(song);
                            }
                          }}
                          onContextMenu={(e) =>
                            handleContextMenu(e, "library_song", song)
                          }
                        >
                          <div
                            className="mr-2 flex items-center justify-center shrink-0"
                            onClick={(e) => {
                              if (hasMultiSelection) {
                                e.stopPropagation();
                                setSelectedLibrarySongIds((prev) =>
                                  prev.includes(song.id)
                                    ? prev.filter((id) => id !== song.id)
                                    : [...prev, song.id],
                                );
                              }
                            }}
                          >
                            {hasMultiSelection ? (
                              <input
                                type="checkbox"
                                checked={isMultiSelected}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded border-[#2A2A2E] bg-[#1a1a1c] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                            ) : (
                              <span className="text-[10px] opacity-40 group-hover:text-blue-500 font-bold">
                                🎵
                              </span>
                            )}
                          </div>

                          <div className="flex-1 truncate">
                            <div className="truncate font-bold tracking-tight">
                              {song.title}
                            </div>
                            <div className="text-[8px] font-medium opacity-40 uppercase tracking-wider">
                              {song.artist || "Artis"}
                            </div>
                          </div>

                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1 space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToSchedule(song);
                              }}
                              className="p-1 hover:text-white bg-blue-500/10 rounded"
                              title="Tambahkan ke Jadwal Ibadah"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem({
                                  ...song,
                                  type: "song",
                                } as any);
                              }}
                              className="p-1 hover:text-white bg-white/5 rounded"
                              title="Edit Konten & Desain Lagu Permanen"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {!song.id.includes("bible") &&
                              song.id !== "1" &&
                              song.id !== "2" &&
                              song.id !== "3" && (
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    deleteSongFromLibrary(song, e)
                                  }
                                  className="p-1 hover:text-red-500 bg-red-500/10 rounded"
                                  title="Hapus Lagu dari Database"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedLibrarySongIds.length > 0 && (
                  <div className="bg-[#161618] border-t border-[#2A2A2E] p-2 flex items-center justify-between gap-1 shadow-2xl shrink-0 z-10 animate-fade-in">
                    <span className="text-[9px] font-black uppercase text-blue-400 pl-1">
                      {selectedLibrarySongIds.length} Terpilih
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const songsToAdd = librarySongs.filter((s) =>
                            selectedLibrarySongIds.includes(s.id),
                          );
                          const newItems = songsToAdd.map((song) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            songId: song.id,
                            title: song.title,
                            artist: song.artist || "Unknown",
                            type: "song" as const,
                            verses: [...song.verses],
                            verseLabels: song.verseLabels
                              ? [...song.verseLabels]
                              : song.verses.map((_, i) => `Verse ${i + 1}`),
                            backgroundImageOverride:
                              (song as any).backgroundImageOverride || null,
                            backgroundOverride:
                              (song as any).backgroundOverride || null,
                            bgType: (song as any).bgType || null,
                            bgScale: (song as any).bgScale || null,
                          }));
                          setSchedule([...schedule, ...newItems]);
                          setSelectedLibrarySongIds([]);
                          showToast(
                            `Berhasil menambahkan ${songsToAdd.length} lagu ke jadwal!`,
                            "success",
                          );
                          setActiveTab("schedule");
                        }}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-[8px] rounded uppercase flex items-center gap-0.5 transition-all"
                      >
                        <Plus className="w-2.5 h-2.5" /> Jadwal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const songs = librarySongs.filter((s) =>
                            selectedLibrarySongIds.includes(s.id),
                          );
                          setBatchSongsToDelete(songs);
                        }}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-black text-[8px] rounded uppercase flex items-center gap-0.5 transition-all"
                      >
                        <Trash className="w-2.5 h-2.5" /> Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLibrarySongIds([])}
                        className="px-1.5 py-1 bg-[#2A2A2E] hover:bg-[#3A3A3F] text-gray-300 font-bold text-[8px] rounded uppercase transition-all"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === "presentations" ? (
            <div className="flex flex-col h-full overflow-hidden bg-[#0A0A0B]/30">
              <div className="p-3 border-b border-[#2A2A2E]">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1.5 w-3 h-3 text-white/20" />
                    <input
                      type="text"
                      placeholder="Cari Presentasi..."
                      className="w-full bg-[#1C1C1F] border border-[#2A2A2E] rounded px-8 py-1 text-[11px] focus:outline-none focus:border-blue-500 text-white placeholder-gray-600 transition-all"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111112]/50 relative pb-12">
                <div className="p-2 space-y-1">
                  {filteredPresentations.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-[9px] font-bold uppercase tracking-wider">
                      {search ? "Tidak ditemukan" : "Belum ada presentasi tersimpan"}
                    </div>
                  ) : (
                    filteredPresentations.map((pres) => {
                      const isSelected = selectedSong?.id === pres.id;
                      return (
                        <div
                          key={pres.id}
                          className="flex group relative"
                        >
                          <button
                            onClick={() => setSelectedSong(pres)}
                            onDoubleClick={() => addToSchedule(pres)}
                            className={`flex-1 text-left px-2.5 py-2 rounded text-[10px] transition-all flex items-start gap-2 select-none group border ${
                              isSelected
                                ? "bg-blue-600/15 border-blue-500/30 text-blue-400 font-bold"
                                : "hover:bg-blue-900/20 text-gray-400 border-transparent hover:border-blue-500/10"
                            }`}
                          >
                            <FileText
                              className={`w-3.5 h-3.5 mt-0.5 opacity-60 ${isSelected ? "text-blue-400" : ""}`}
                            />
                            <div className="overflow-hidden">
                              <div className="truncate">{pres.title}</div>
                              <div className="text-[8.5px] font-normal opacity-50 truncate mt-0.5">
                                {pres.verses.length} Slide
                              </div>
                            </div>
                          </button>
                          {isSelected && (
                            <div className="absolute right-1 top-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Apakah anda yakin ingin menghapus presentasi ini?")) {
                                    setLibraryPresentations(prev => prev.filter(p => p.id !== pres.id));
                                  }
                                }}
                                className="px-2 bg-red-900/50 hover:bg-red-600 border border-red-700/50 rounded text-red-200 hover:text-white flex items-center justify-center transition-all"
                                title="Hapus presentasi"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToSchedule(pres);
                                }}
                                className="px-3 bg-blue-600 hover:bg-blue-500 rounded text-white font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1 transition-all"
                              >
                                <Plus className="w-3 h-3" /> Jadwal
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "bible" ? (
            <div className="flex flex-col h-full overflow-hidden bg-[#0A0A0B]/30">
              {customBibles.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 h-full text-center text-zinc-400 space-y-4">
                  <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                    <Book className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                      Database Alkitab Kosong
                    </h4>
                    <p className="text-[10px] leading-relaxed text-zinc-500 mt-2">
                      Semua isi Alkitab bawaan telah dihapus sesuai permintaan.
                      <br />
                      Silakan unggah database Alkitab kustom (JSON / Teks)
                      Anda melalui menu di atas untuk mulai mencari ayat.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBibleDbModal(true)}
                    className="mt-1 px-4 py-2 bg-red-600 hover:bg-red-500 hover:scale-[1.02] active:scale-[0.98] text-white font-black text-[9.5px] uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-red-600/10 cursor-pointer"
                  >
                    Unggah Alkitab Kustom
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-[#2A2A2E]/50">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex bg-[#121213] p-0.5 rounded-lg border border-[#2A2A2E]/50 flex-wrap gap-1 max-w-[210px]">
                        {/* Bahasa Indonesia */}
                        {(() => {
                          const indoBible = customBibles.find(
                            (cb) =>
                              cb.id === "json-indo-tb" ||
                              cb.id.toLowerCase().includes("indo") ||
                              cb.id.toLowerCase().includes("tb"),
                          );
                          const isIndoSelected = indoBible ? bibleVersion === indoBible.id : bibleVersion === "tb";
                          const targetVersionId = indoBible ? indoBible.id : "tb";
                          const titleText = indoBible ? indoBible.name : "Alkitab Bahasa Indonesia Terjemahan Baru (Online)";
                          
                          return (
                            <button
                              type="button"
                              onClick={() => setBibleVersion(targetVersionId)}
                              className={`px-2 py-1 text-[8px] font-black uppercase tracking-tighter rounded-md transition-all ${isIndoSelected ? "bg-blue-600 text-white shadow-lg font-extrabold" : "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"}`}
                              title={titleText}
                            >
                              Bahasa Indonesia {indoBible ? "" : "(Online)"}
                            </button>
                          );
                        })()}

                        {/* Bahasa Batak */}
                        {(() => {
                          const batakBible = customBibles.find(
                            (cb) =>
                              cb.id.toLowerCase().includes("toba") ||
                              cb.id.toLowerCase().includes("batak"),
                          );
                          const isBatakSelected = batakBible ? bibleVersion === batakBible.id : bibleVersion === "toba";
                          const targetVersionId = batakBible ? batakBible.id : "toba";
                          const titleText = batakBible ? batakBible.name : "Alkitab Bahasa Batak Toba (Scraper Online)";
                          
                          return (
                            <button
                              type="button"
                              onClick={() => setBibleVersion(targetVersionId)}
                              className={`px-2 py-1 text-[8px] font-black uppercase tracking-tighter rounded-md transition-all ${isBatakSelected ? "bg-blue-600 text-white shadow-lg font-extrabold" : "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"}`}
                              title={titleText}
                            >
                              Bahasa Batak {batakBible ? "" : "(Online)"}
                            </button>
                          );
                        })()}

                        {/* Other Custom Bibles if they exist */}
                        {customBibles
                          .filter(
                            (cb) =>
                              cb.id !== "json-indo-tb" &&
                              !cb.id.toLowerCase().includes("indo") &&
                              !cb.id.toLowerCase().includes("tb") &&
                              !cb.id.toLowerCase().includes("toba") &&
                              !cb.id.toLowerCase().includes("batak"),
                          )
                          .map((cb) => (
                            <button
                              key={cb.id}
                              onClick={() => setBibleVersion(cb.id)}
                              className={`px-2 py-1 text-[8px] font-black uppercase tracking-tighter rounded-md transition-all ${bibleVersion === cb.id ? "bg-blue-600 text-white shadow-lg font-extrabold" : "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"}`}
                              title={cb.name}
                            >
                              {cb.name
                                .replace("EasyWorship Alkitab - ", "")
                                .slice(0, 10)
                                .toUpperCase()}
                            </button>
                          ))}
                      </div>
                      <button
                        onClick={addBibleToSchedule}
                        disabled={!selectedSong?.id.startsWith("bible-")}
                        className={`flex items-center gap-1 text-[9px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-black disabled:opacity-30 transition-all`}
                      >
                        <Plus className="w-2.5 h-2.5" /> ADD TO PLAN
                      </button>
                    </div>
                    <select
                      className="w-full bg-[#121213] border border-[#2A2A2E]/50 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                      value={selectedBibleBook}
                      onChange={(e) => setSelectedBibleBook(e.target.value)}
                    >
                      {getAvailableBooks().map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <div>
                        <span className="text-[7.5px] font-black text-gray-500 uppercase mb-0.5 block tracking-wider">
                          Pasal
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full bg-[#121213] border border-[#2A2A2E]/50 rounded px-2 py-1 text-[11px] text-white focus:border-blue-500/50 outline-none text-center font-bold"
                          value={chapterInput}
                          onChange={(e) =>
                            setChapterInput(
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Pasal"
                        />
                      </div>
                      <div>
                        <span className="text-[7.5px] font-black text-gray-500 uppercase mb-0.5 block tracking-wider">
                          Dari Ayat
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full bg-[#121213] border border-[#2A2A2E]/50 rounded px-2 py-1 text-[11px] text-white focus:border-blue-500/50 outline-none text-center font-bold"
                          value={startVerseInput}
                          onChange={(e) =>
                            setStartVerseInput(
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Dari"
                        />
                      </div>
                      <div>
                        <span className="text-[7.5px] font-black text-gray-500 uppercase mb-0.5 block tracking-wider">
                          Sampai
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full bg-[#121213] border border-[#2A2A2E]/50 rounded px-2 py-1 text-[11px] text-white focus:border-blue-500/50 outline-none text-center font-bold"
                          value={endVerseInput}
                          onChange={(e) =>
                            setEndVerseInput(
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          placeholder="Sampai"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {isFetchingBible ? (
                  <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <Loader2 className="w-5 h-5 animate-spin mb-2 text-blue-500" />
                    <span className="text-[8px] uppercase font-black tracking-widest text-zinc-500">
                      Memuat Ayat...
                    </span>
                  </div>
                ) : bibleError ? (
                  <div className="p-4 bg-red-950/20 border border-red-500/30 rounded text-center my-6">
                    <p className="text-red-400 text-[10px] uppercase font-black mb-2 leading-relaxed">
                      {bibleError}
                    </p>
                    <button
                      onClick={() =>
                        fetchBibleChapter(
                          selectedBibleBook,
                          selectedBibleChapter,
                        )
                      }
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black rounded uppercase transition-colors"
                    >
                      Coba Lagi
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                      Daftar Ayat
                    </div>
                    {selectedSong?.id.startsWith("bible-") &&
                      selectedSong.verses.map((verse, idx) => {
                        const vNum = idx + 1;
                        const isInRange =
                          vNum >= startVerse && vNum <= endVerse;
                        const isCurrentlyActive =
                          currentSlide?.parentId === selectedSong.id &&
                          currentSlide?.slideIdx === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() =>
                              handleVerseClick(
                                `${vNum}. ${verse}`,
                                `${selectedBibleBook} ${selectedBibleChapter}:${vNum}`,
                                selectedSong.id,
                                idx,
                              )
                            }
                            className={`w-full text-left p-2 rounded text-[11px] group transition-colors border leading-relaxed ${isCurrentlyActive ? "border-blue-600 bg-blue-600/20" : isInRange ? "bg-blue-600/10 border-blue-500/30" : "hover:bg-white/5 border-transparent"}`}
                          >
                            <span
                              className={`text-[9px] font-black mr-2 ${isCurrentlyActive ? "text-white" : isInRange ? "text-blue-400" : "text-gray-600"}`}
                            >
                              {vNum}
                            </span>
                            <span
                              className={`${isCurrentlyActive || isInRange ? "text-white" : "text-gray-400 group-hover:text-gray-300"} transition-all`}
                            >
                              {verse}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </aside>

        {/* Center Content: Slide Grid */}
        <main
          className="p-4 flex flex-col h-full overflow-hidden"
          style={{
            backgroundColor: "#000000",
            width: "680px",
            paddingLeft: "16px",
            paddingTop: "16px",
            marginLeft: "0px",
            marginTop: "0px",
            marginRight: "0px",
            marginBottom: "0px",
          }}
        >
          <div className="flex justify-between items-start mb-6 flex-shrink-0">
            <div>
              <h2 className="text-xl font-black text-white leading-tight tracking-tight">
                {selectedSong?.title || "Choose a Song"}
              </h2>
              <p className="text-[10px] text-gray-500 italic uppercase tracking-wider font-bold mt-1">
                {selectedSong?.artist || "Library Selection Required"}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (selectedSong) {
                    const item = schedule.find(
                      (s) => s.songId === selectedSong.id,
                    ) || {
                      id: selectedSong.id,
                      title: selectedSong.title,
                      artist: selectedSong.artist || "Unknown",
                      type: selectedSong.id.startsWith("bible-")
                        ? "bible"
                        : "song",
                      verses: [...selectedSong.verses],
                    };
                    setEditingItem(item as ScheduleItem);
                  } else {
                    alert("Select a song/item first to edit.");
                  }
                }}
                className="px-3 py-1 bg-[#1C1C1F] border border-[#2A2A2E] rounded text-[9px] font-bold text-gray-400 hover:text-white hover:bg-[#2A2A2E] transition-all uppercase tracking-tighter flex items-center gap-1"
              >
                <Edit2 className="w-2.5 h-2.5" /> Edit Builder
              </button>
              <button
                onClick={() => alert("Chord chart toggled")}
                className="px-3 py-1 bg-[#1C1C1F] border border-[#2A2A2E] rounded text-[9px] font-bold text-gray-400 hover:text-white hover:bg-[#2A2A2E] transition-all uppercase tracking-tighter"
              >
                Chords
              </button>
              <button
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`px-3 py-1 border rounded text-[9px] font-bold transition-all uppercase tracking-tighter flex items-center gap-1 ${
                  isAutoPlay
                    ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20"
                    : "bg-[#1C1C1F] border-[#2A2A2E] text-gray-400 hover:text-white hover:bg-[#2A2A2E]"
                }`}
              >
                <Play
                  className={`w-2.5 h-2.5 ${isAutoPlay ? "animate-pulse" : ""}`}
                />
                {isAutoPlay ? `Playing (${slideSpeed}s)` : "Auto Play"}
              </button>
            </div>
          </div>

          {/* Independently Scrollable Container for Slides */}
          <div className="flex-1 overflow-y-auto pr-1 mb-4 custom-scrollbar">
            <div
              className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              style={{ marginBottom: "0px" }}
            >
              {selectedSong?.verses.map((verse, idx) => {
                const labels = selectedSong.verseLabels || [];
                const isBible =
                  selectedSong.id.startsWith("bible-") ||
                  (selectedSong as any).type === "bible";
                const bibleVerseNum = getBibleVerseLabel(labels, idx);
                const displayContent = isBible
                  ? `${bibleVerseNum}. ${verse}`
                  : verse;
                const displayTitle = isBible
                  ? `${selectedSong.title.split(":")[0]}:${bibleVerseNum}`
                  : selectedSong.title;
                const isActive =
                  previewSlide?.parentId === selectedSong.id &&
                  previewSlide?.slideIdx === idx;

                return (
                  <button
                    key={idx}
                    onClick={() =>
                      handleVerseClick(
                        displayContent,
                        displayTitle,
                        selectedSong.id,
                        idx,
                      )
                    }
                    onContextMenu={(e) =>
                      handleContextMenu(e, "slide_item", { verse, idx })
                    }
                    className={`aspect-video rounded border-2 flex flex-col p-3 text-center cursor-pointer shadow-xl transition-all relative group bg-[#161618] overflow-hidden ${isActive ? "bg-[#1C1C1F] border-blue-600 ring-4 ring-blue-500/10" : "border-[#2A2A2E] hover:border-gray-500"}`}
                  >
                    <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
                      <p
                        className={`text-[11px] font-bold leading-relaxed line-clamp-4 ${isActive ? "text-white" : "text-gray-300"}`}
                      >
                        {isBible ? `${bibleVerseNum}. ${verse}`.toUpperCase() : verse.toUpperCase()}
                      </p>
                    </div>
                    <div className="mt-2 h-5 flex items-center justify-between w-full select-none shrink-0">
                      {labels[idx] !== "" ? (
                        <span
                          className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shrink-0 ${isActive ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                        >
                          {labels[idx] !== undefined
                            ? labels[idx]
                            : isBible
                              ? `Ayat ${idx + 1}`
                              : `Verse ${idx + 1}`}
                        </span>
                      ) : (
                        <span
                          className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shrink-0 ${isActive ? "bg-blue-950/40 text-blue-400 border border-blue-900/30" : "bg-zinc-900 text-zinc-500 border border-zinc-800/20"}`}
                        >
                          {isBible ? `Ayat ${bibleVerseNum} (Pecah)` : "Verse (Split)"}
                        </span>
                      )}
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
              {!selectedSong && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-[#2A2A2E] rounded-xl bg-white/2">
                  <Play className="w-8 h-8 text-white/5 mb-4" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">
                    Standby - Select sequence
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer: Background Themes Folders */}
          <div className="p-4 bg-[#111112] border border-[#2A2A2E] rounded-lg flex-shrink-0">
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setBgTab("images")}
                  className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b-2 transition-all ${bgTab === "images" ? "text-blue-500 border-blue-500 font-extrabold" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Images Folder
                </button>
                <button
                  onClick={() => setBgTab("videos")}
                  className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b-2 transition-all ${bgTab === "videos" ? "text-blue-500 border-blue-500 font-extrabold" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                >
                  <Video className="w-3.5 h-3.5" /> Videos Folder
                </button>
              </div>
              <button
                onClick={handleAddBackground}
                className="text-[9px] font-bold text-blue-500 hover:text-blue-400 transition-all uppercase tracking-wider flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Background
              </button>
              <input
                type="file"
                ref={bgFileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
            </div>

            {bgTab === "images" ? (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {[...BACKGROUNDS, ...customBackgrounds].map((bg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleBackgroundSelect(bg)}
                    className={`h-14 aspect-video rounded-md overflow-hidden border-2 transition-all flex-shrink-0 relative group ${activeBackground === bg ? "border-blue-500 scale-95 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-[#2A2A2E] opacity-50 hover:opacity-100"}`}
                  >
                    <img
                      src={resolveMedia(bg)}
                      alt="bg"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {customVideoBackgrounds.map((bg, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleBackgroundSelect(bg)}
                    className={`h-14 aspect-video rounded-md overflow-hidden border-2 transition-all flex-shrink-0 relative group bg-black/40 ${activeBackground === bg ? "border-blue-500 scale-95 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-[#2A2A2E] opacity-60 hover:opacity-100"}`}
                  >
                    <video
                      src={resolveMedia(bg)}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[7px] font-bold text-gray-400">
                      VIDEO
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Output Monitors */}
        <aside className="w-72 bg-[#111112] border-l border-[#2A2A2E] flex flex-col p-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                {isLive ? "Live Output" : "Preview (Sync Off)"}
              </span>
              <span
                className={`text-[10px] font-black ${isLive ? "text-red-500 animate-pulse" : "text-gray-500"}`}
              >
                {isLive ? "ON AIR" : "OFFLINE"}
              </span>
            </div>
            <div
              onContextMenu={(e) => handleContextMenu(e, "live_preview", null)}
              className={`${outputResolution === "4:3" ? "aspect-[4/3]" : "aspect-video"} ${lowerThirdMode ? (chromaKeyColor === "green" ? "bg-[#00ff00]" : "bg-transparent border border-white/5") : "bg-black"} rounded border border-red-950/50 flex items-center justify-center p-4 relative group cursor-pointer overflow-hidden shadow-2xl @container`}
              style={{ containerType: "inline-size" }}
            >
              {masterOverride === "logo" ||
              (isLive && currentSlide?.type === "logo") ? (
                <>
                  {!lowerThirdMode &&
                    (() => {
                      const logoBg =
                        currentSlide?.type === "logo"
                          ? currentSlide?.backgroundOverride ||
                            currentSlide?.background ||
                            activeBackground
                          : activeBackground;
                      if (!logoBg || logoBg === "#000000" || logoBg === "transparent") return null;
                      return isVideo(logoBg) ? (
                        <video
                          key={logoBg}
                          src={resolveMedia(logoBg)}
                          muted
                          autoPlay
                          loop
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-[0.8] z-0"
                        />
                      ) : (
                        <img
                          key={logoBg}
                          src={resolveMedia(logoBg)}
                          alt="bg"
                          className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-80 z-0"
                          referrerPolicy="no-referrer"
                        />
                      );
                    })()}
                  {!lowerThirdMode && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none z-[1]" />
                  )}
                  <div className="absolute inset-0 z-10 flex items-center justify-center p-2 pointer-events-none">
                    <AppLogo
                      className="w-20 h-20 drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]"
                      showText={false}
                    />
                  </div>
                </>
              ) : masterOverride === "qr" ||
                (isLive && currentSlide?.type === "qr") ? (
                <>
                  {!lowerThirdMode &&
                    activeBackground &&
                    (isVideo(activeBackground) ? (
                      <video
                        key={activeBackground}
                        src={resolveMedia(activeBackground)}
                        muted
                        autoPlay
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-[0.8] z-0"
                      />
                    ) : (
                      <img
                        key={activeBackground}
                        src={resolveMedia(activeBackground)}
                        alt="bg"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-80 z-0"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-2 pointer-events-none">
                    <div className="bg-white p-1.5 rounded shadow-md mb-1">
                      <QRCodeSVG
                        value={getPublicUrl(`/projector?mode=share&account=${currentAccountId}`)}
                        size={52}
                      />
                    </div>
                    <p className="text-[7px] font-semibold text-white/85">
                      Scan QR Code
                    </p>
                  </div>
                </>
              ) : masterOverride === "black" ||
                (isLive &&
                  currentSlide?.content === "" &&
                  currentSlide?.type === "announcement" &&
                  !currentSlide?.background) ? (
                <div className="absolute inset-0 z-0 bg-black" />
              ) : masterOverride === "clear" ||
                (isLive &&
                  !currentSlide?.content &&
                  !currentSlide?.title &&
                  currentSlide?.type === "announcement" &&
                  currentSlide?.background) ? (
                <>
                  {!lowerThirdMode &&
                    activeBackground &&
                    (isVideo(activeBackground) ? (
                      <video
                        key={activeBackground}
                        src={resolveMedia(activeBackground)}
                        muted
                        autoPlay
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-[0.8]"
                      />
                    ) : (
                      <img
                        key={activeBackground}
                        src={resolveMedia(activeBackground)}
                        alt="bg"
                        className="absolute inset-0 w-full h-full object-cover opacity-85 brightness-80"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                </>
              ) : (
                <>
                  {/* Background Rendering with complete tuning properties support */}
                  {!lowerThirdMode &&
                    (() => {
                      const bg = isLive
                        ? currentSlide?.backgroundOverride ||
                          currentSlide?.background
                        : previewSlide?.backgroundOverride ||
                          previewSlide?.background ||
                          activeBackground;
                      if (!bg) return null;

                      const activeSlide = isLive
                        ? currentSlide
                        : previewSlide || {};
                      const bgOpacityVal =
                        activeSlide?.bgOpacity !== undefined
                          ? activeSlide.bgOpacity / 100
                          : 0.85;
                      const bgBrightnessVal =
                        activeSlide?.bgBrightness !== undefined
                          ? activeSlide.bgBrightness / 100
                          : 0.8;
                      const bgBlurVal =
                        activeSlide?.bgBlur !== undefined
                          ? activeSlide.bgBlur
                          : 0;
                      const bgFitVal = activeSlide?.bgFit || "cover";
                      const bgScaleVal =
                        activeSlide?.bgScale !== undefined
                          ? activeSlide.bgScale / 100
                          : 1;
                      const bgPositionXVal =
                        activeSlide?.bgPositionX !== undefined
                          ? activeSlide.bgPositionX
                          : 0;
                      const bgPositionYVal =
                        activeSlide?.bgPositionY !== undefined
                          ? activeSlide.bgPositionY
                          : 0;

                      return isVideo(bg) ? (
                        <video
                          src={resolveMedia(bg)}
                          muted
                          autoPlay
                          loop
                          playsInline
                          className="absolute inset-0 w-full h-full"
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
                          className="absolute inset-0 w-full h-full"
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

                  {/* Gradient Overlay mirroring the Projector */}
                  {!lowerThirdMode &&
                    (() => {
                      const bg = isLive
                        ? currentSlide?.backgroundOverride ||
                          currentSlide?.background
                        : previewSlide?.backgroundOverride ||
                          previewSlide?.background ||
                          activeBackground;
                      const isLight = isLightBg(bg);
                      return (
                        <div
                          className={`absolute inset-0 bg-gradient-to-t ${isLight ? "from-white/10 via-transparent to-white/5" : "from-black/70 via-transparent to-black/30"} pointer-events-none`}
                        />
                      );
                    })()}

                  {/* Content Rendering synchronized mirroring the structure of Projector Display */}
                  {(() => {
                    const slide = isLive
                      ? currentSlide
                      : previewSlide || {
                          content: "SYSTEM READY",
                          title: "",
                          type: "announcement",
                        };
                    if (!slide)
                      return (
                        <p className="text-[10px] font-bold text-white uppercase opacity-40">
                          System Offline
                        </p>
                      );

                    const bg = isLive
                      ? currentSlide?.backgroundOverride ||
                        currentSlide?.background
                      : previewSlide?.backgroundOverride ||
                        previewSlide?.background ||
                        activeBackground;
                    const isLight = isLightBg(bg);

                    const baseTextColor = slide.textColor || "#ffffff";
                    const textColor =
                      isLight &&
                      (baseTextColor.toLowerCase() === "#ffffff" ||
                        baseTextColor.toLowerCase() === "white")
                        ? "#111827"
                        : baseTextColor;
                    const fontSizeMode = slide.fontSizeMode || "auto";
                    const fontSize = slide.fontSize || 60;
                    const textAlign = slide.textAlign || "center";
                    const textPosition = lowerThirdMode
                      ? "bottom"
                      : slide.textPosition || "center";
                    const textBold = slide.textBold !== false;
                    const textItalic = slide.textItalic || false;
                    const textShadow = slide.textShadow !== false;
                    const fontFamilyValue =
                      globalFontFamily !== "Default"
                        ? globalFontFamily
                        : slide.fontFamily || "Sans / Inter";
                    const textTransformValue =
                      globalTextTransform !== "Default"
                        ? globalTextTransform
                        : slide.textTransform || "uppercase";
                    const textTrackingValue = slide.textTracking || "normal";
                    const textSpacingValue = slide.textSpacing || "normal";
                    const textOutline = slide.textOutline || false;
                    const textOutlineColor =
                      slide.textOutlineColor || "#000000";

                    const alignClass =
                      textAlign === "left"
                        ? "text-left items-start justify-start"
                        : textAlign === "right"
                          ? "text-right items-end justify-end"
                          : "text-center items-center justify-center";
                    const posClass =
                      textPosition === "top"
                        ? "items-start pt-3"
                        : textPosition === "bottom"
                          ? lowerThirdMode
                            ? "items-end pb-1"
                            : "items-end pb-3"
                          : "items-center justify-center";
                    const weightClass = textBold ? "font-bold" : "font-normal";
                    const italicClass = textItalic ? "italic" : "not-italic";

                    // Fonts Mapping
                    const fontMapping: { [key: string]: string } = {
                      Cinzel: "font-cinzel",
                      "Space Grotesk": "font-space",
                      Outfit: "font-outfit",
                      "Playfair Display": "font-playfair",
                      "JetBrains Mono": "font-mono",
                      "Sans / Inter": "font-sans",
                    };
                    const fontClass =
                      fontMapping[fontFamilyValue] || "font-sans";

                    // Trackings Mapping
                    const trackingMapping: { [key: string]: string } = {
                      tighter: "tracking-tighter",
                      tight: "tracking-tight",
                      normal: "tracking-normal",
                      wide: "tracking-wide",
                      widest: "tracking-widest",
                    };
                    const trackingClass =
                      trackingMapping[textTrackingValue] || "tracking-normal";

                    // Leading Line Spacing Mapping
                    const spacingMapping: { [key: string]: string } = {
                      relaxed: "leading-relaxed",
                      snug: "leading-snug",
                      normal: "leading-normal",
                      loose: "leading-loose",
                    };
                    const spacingClass =
                      spacingMapping[textSpacingValue] || "leading-normal";

                    const transformClass =
                      textTransformValue === "none"
                        ? "normal-case"
                        : textTransformValue === "lower-case"
                          ? "lowercase"
                          : textTransformValue === "capitalize"
                            ? "capitalize"
                            : "uppercase";

                    const shadowValue = (() => {
                      const list: string[] = [];
                      const isShadowEnabled =
                        globalTextShadowStyle === "None"
                          ? false
                          : textShadow || globalTextShadowStyle !== "Default";

                      if (isShadowEnabled) {
                        if (globalTextShadowStyle === "Heavy") {
                          list.push(
                            "0 2px 4px rgba(0,0,0,0.98)",
                            "0 1px 2px rgba(0,0,0,0.95)",
                          );
                        } else if (
                          globalTextShadowStyle === "Soft High-Contrast"
                        ) {
                          list.push(
                            "0 0 4px rgba(0,0,0,0.98)",
                            "0 0 6px rgba(0,0,0,0.9)",
                          );
                        } else {
                          if (isLight) {
                            list.push(
                              "0 0.5px 1.5px rgba(0,0,0,0.15)",
                              "0 0.5px 1px rgba(0,0,0,0.1)",
                            );
                          } else {
                            list.push(
                              "0 2px 8px rgba(0,0,0,0.95)",
                              "0 1px 2px rgba(0,0,0,0.95)",
                            );
                          }
                        }
                      }
                      if (textOutline) {
                        list.push(
                          `0.5px 0.5px 0px ${textOutlineColor}`,
                          `-0.5px -0.5px 0px ${textOutlineColor}`,
                          `0.5px -0.5px 0px ${textOutlineColor}`,
                          `-0.5px 0.5px 0px ${textOutlineColor}`,
                          `0px 0.5px 0px ${textOutlineColor}`,
                          `0px -0.5px 0px ${textOutlineColor}`,
                          `0.5px 0px 0px ${textOutlineColor}`,
                          `-0.5px 0px 0px ${textOutlineColor}`,
                        );
                      }
                      return list.length > 0 ? list.join(", ") : undefined;
                    })();

                    const scaleMultiplier = globalFontSizeScale / 100;

                    const textContent = slide?.content || "";
                    const charCount = textContent.length;
                    const lineCount = textContent.split("\n").length;

                    let baseAutoCqw = 5.6; // Default starting auto cqw size (which scales nicely)

                    if (slide?.type === "lyrics") {
                      if (charCount > 300 || lineCount > 7) {
                        baseAutoCqw = 2.4;
                      } else if (charCount > 180 || lineCount > 5) {
                        baseAutoCqw = 3.2;
                      } else if (charCount > 100 || lineCount > 4) {
                        baseAutoCqw = 3.9;
                      } else if (charCount > 50 || lineCount > 3) {
                        baseAutoCqw = 4.6;
                      }
                    } else if (slide?.type === "scripture") {
                      if (charCount > 305 || lineCount > 7) {
                        baseAutoCqw = 2.2;
                      } else if (charCount > 180 || lineCount > 5) {
                        baseAutoCqw = 3.0;
                      } else if (charCount > 100 || lineCount > 4) {
                        baseAutoCqw = 3.8;
                      } else if (charCount > 50 || lineCount > 3) {
                        baseAutoCqw = 4.5;
                      }
                    } else if (slide?.type === "announcement") {
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
                      textShadow: shadowValue,
                      fontSize:
                        fontSizeMode === "manual"
                          ? `calc(${fontSize / 19.2}cqw * ${scaleMultiplier})`
                          : `calc(${baseAutoCqw}cqw * ${scaleMultiplier})`,
                      lineHeight: "1.25",
                    };

                    const textClass = isLight ? "text-zinc-900" : "text-white";

                    return (
                      <>
                        {/* Shape Decorations Overlay */}
                        {slide.shapeDecoration === "bottom-bar" && (
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/80 backdrop-blur border border-zinc-700/30 rounded h-6 z-[5] pointer-events-none" />
                        )}
                        {slide.shapeDecoration === "left-accent" && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan-500 z-[5] pointer-events-none" />
                        )}
                        {slide.shapeDecoration === "brackets" && (
                          <>
                            <div className="absolute left-1.5 top-1.5 bottom-1.5 w-1.5 border-t border-b border-l border-cyan-400 z-[5] pointer-events-none opacity-80" />
                            <div className="absolute right-1.5 top-1.5 bottom-1.5 w-1.5 border-t border-b border-r border-cyan-400 z-[5] pointer-events-none opacity-80" />
                          </>
                        )}
                        {slide.shapeDecoration === "thin-frame" && (
                          <div className="absolute inset-1.5 border border-zinc-500/20 z-[5] pointer-events-none" />
                        )}
                        {slide.shapeDecoration === "glow-rect" && (
                          <div className="absolute inset-x-4 inset-y-2 bg-zinc-950/40 blur-[3px] rounded z-[2] pointer-events-none" />
                        )}

                        {slide.logoLeftUrl && (
                          <div className="absolute top-2 left-2 z-[15] pointer-events-none">
                            <img
                              src={resolveMedia(slide.logoLeftUrl)}
                              alt="Left Logo"
                              className="w-10 h-10 object-contain rounded-md drop-shadow"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {slide.logoRightUrl && (
                          <div className="absolute top-2 right-2 z-[15] pointer-events-none">
                            <img
                              src={resolveMedia(slide.logoRightUrl)}
                              alt="Right Logo"
                              className="w-10 h-10 object-contain rounded-md drop-shadow"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {!slide.logoLeftUrl &&
                          !slide.logoRightUrl &&
                          slide.logoUrl && (
                            <div
                              className={`absolute top-2 z-[15] pointer-events-none ${slide.logoPosition === "left" ? "left-2" : "right-2"}`}
                            >
                              <img
                                src={resolveMedia(slide.logoUrl)}
                                alt="Slide Logo"
                                className="w-10 h-10 object-contain rounded-md drop-shadow"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                        <div
                          className={`absolute inset-0 z-10 flex p-3 pointer-events-none ${posClass} ${textAlign === "left" ? "justify-start" : textAlign === "right" ? "justify-end" : "justify-center"}`}
                        >
                          <div className={`w-full flex flex-col ${alignClass}`}>
                            {slide.type === "logo" ? (
                              <div className="flex flex-col items-center justify-center">
                                <AppLogo
                                  className="w-8 h-8 mb-1 drop-shadow-md"
                                  showText={false}
                                />
                                <h2
                                  className={`text-[8px] font-black tracking-widest ${textClass} uppercase`}
                                >
                                  CHURCH PRESENTER
                                </h2>
                              </div>
                            ) : slide.type === "qr" ? (
                              <div className="flex flex-col items-center justify-center">
                                <div className="bg-white p-1 rounded shadow-md mb-1 col">
                                  <QRCodeSVG
                                    value={getPublicUrl(`/projector?mode=share&account=${currentAccountId}`)}
                                    size={45}
                                  />
                                </div>
                                <p
                                  className={`text-[7px] font-semibold ${isLight ? "text-zinc-800" : "text-white/80"}`}
                                >
                                  Scan QR Code
                                </p>
                              </div>
                            ) : slide.type === "scripture" ? (
                              <div
                                className={`flex flex-col ${textAlign === "left" ? "items-start" : textAlign === "right" ? "items-end" : "items-center"} ${lowerThirdMode ? "bg-black/85 backdrop-blur-md p-1.5 rounded border border-white/15 w-full text-center" : "w-full"}`}
                              >
                                {slide.content && !lowerThirdMode && (
                                  <div
                                    className={`w-4 h-0.5 ${isLight ? "bg-blue-700" : "bg-blue-500"} mb-1 rounded-full`}
                                  />
                                )}
                                <p
                                  style={customStyle}
                                  className={`${textClass} ${fontClass} ${trackingClass} ${spacingClass} ${transformClass} ${weightClass} ${italicClass}`}
                                >
                                  "{slide.content}"
                                </p>
                                {slide.title && (
                                  <p
                                    style={{
                                      color:
                                        isLight && !lowerThirdMode
                                          ? "#1e3a8a"
                                          : "#60a5fa",
                                      ...(lowerThirdMode
                                        ? { fontSize: "6px" }
                                        : {}),
                                    }}
                                    className={
                                      lowerThirdMode
                                        ? "text-[5px] font-black uppercase tracking-wider text-blue-400 mt-0.5"
                                        : "text-[6px] font-black mt-1 uppercase tracking-wider"
                                    }
                                  >
                                    {slide.title}
                                  </p>
                                )}
                              </div>
                            ) : slide.type === "lyrics" ? (
                              <div
                                className={
                                  lowerThirdMode
                                    ? "bg-black/85 backdrop-blur-md px-3 py-1 rounded-md shadow-xl w-full text-center border border-white/15"
                                    : "w-full text-center"
                                }
                              >
                                <p
                                  style={customStyle}
                                  className={`${textClass} whitespace-pre-line px-2 ${fontClass} ${trackingClass} ${spacingClass} ${transformClass} ${weightClass} ${italicClass}`}
                                >
                                  {slide.content}
                                </p>
                              </div>
                            ) : (
                              <div
                                className={`flex flex-col ${textAlign === "left" ? "items-start" : textAlign === "right" ? "items-end" : "items-center"} ${lowerThirdMode ? "bg-black/85 backdrop-blur-md p-1.5 rounded border border-white/15 w-full text-center" : "w-full"}`}
                              >
                                {slide.title && (
                                  <p
                                    className={
                                      lowerThirdMode
                                        ? "text-[5px] font-bold text-blue-400 uppercase mb-0.5"
                                        : `text-[7px] font-medium ${isLight ? "text-zinc-600/90" : "text-white/70"} mb-0.5 uppercase tracking-wider`
                                    }
                                  >
                                    {slide.title}
                                  </p>
                                )}
                                <p
                                  style={customStyle}
                                  className={`${textClass} ${fontClass} ${trackingClass} ${spacingClass} ${transformClass} ${weightClass} ${italicClass}`}
                                >
                                  {slide.content}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
              <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Monitor className="w-8 h-8 text-white/20" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                Stage Display
              </span>
            </div>
            <div className="aspect-video bg-[#161618] rounded border border-[#2A2A2E] relative p-3 flex flex-col justify-between shadow-inner">
              <div className="text-[9px] text-yellow-500 font-mono font-bold uppercase tracking-tight line-clamp-1">
                Current: {currentSlide?.title || "None"}
              </div>
              <div className="flex-1 flex items-center justify-center py-2 overflow-hidden w-full">
                <div className="w-full max-h-[68px] overflow-y-auto scrollbar-none flex items-center justify-center">
                  <p className="text-[9px] text-white/40 font-mono text-center italic whitespace-pre-line px-1 leading-normal">
                    "{currentSlide?.content || "Waiting for signal..."}"
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-[8px] text-blue-400 font-mono">
                  NEXT UP: CHORUS
                </div>
                <div className="text-xl font-mono text-white font-black tracking-tighter">
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-[#161618] rounded border border-[#2A2A2E] p-4 flex flex-col">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">
              Master Controls
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMasterOverride(null);
                  changeSlide({
                    content: "",
                    title: "",
                    background: "",
                    type: "announcement",
                  });
                }}
                className="py-3 bg-red-950/20 text-red-500 border border-red-900/50 rounded text-[10px] font-black uppercase tracking-widest hover:bg-red-900/40 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => toggleMasterOverride("black")}
                className={`py-3 border rounded text-[10px] font-black uppercase tracking-widest transition-all ${masterOverride === "black" ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-[#111112] text-gray-500 border-[#2A2A2E] hover:border-gray-500"}`}
              >
                Black
              </button>
              <button
                onClick={() => toggleMasterOverride("logo")}
                className={`py-3 border rounded text-[10px] font-black uppercase tracking-widest transition-all ${masterOverride === "logo" ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-[#111112] text-gray-400 border-[#2A2A2E] hover:border-gray-500"}`}
              >
                Logo
              </button>
              <button
                onClick={() => toggleMasterOverride("qr")}
                className={`py-3 border rounded text-[10px] font-black uppercase tracking-widest transition-all ${masterOverride === "qr" ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-[#111112] text-gray-400 border-[#2A2A2E] hover:border-gray-500"}`}
              >
                QR Code
              </button>
              <button
                onClick={() => toggleMasterOverride("clear")}
                className={`py-3 border rounded text-[10px] font-black uppercase tracking-widest transition-all ${masterOverride === "clear" ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-[#111112] text-gray-400 border-[#2A2A2E] hover:border-gray-500"}`}
              >
                Clear
              </button>
            </div>

            <div className="mt-auto pt-4 flex flex-col gap-2 relative">
              <button
                onClick={() => setShowProjectionDropdown((prev) => !prev)}
                className="w-full flex items-center justify-center gap-2 py-2 text-white rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10 cursor-pointer hover:brightness-125"
                style={{
                  borderStyle: "groove",
                  borderRadius: "40px",
                  textAlign: "center",
                  fontFamily: "Arial",
                  backgroundColor: "#081f5d",
                }}
              >
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Projection</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showProjectionDropdown ? "rotate-180" : ""}`} />
              </button>

              {showProjectionDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-[90]"
                    onClick={() => setShowProjectionDropdown(false)}
                  />
                  <div className="absolute left-0 right-0 bottom-full mb-2 bg-[#18181B] border border-[#2A2A2E] rounded-xl shadow-2xl p-1.5 z-[100] text-left">
                    <button
                      onClick={() => {
                        openProjectorExtendWindow(currentAccountId);
                        setShowProjectionDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-600/30 hover:border-blue-500/40 border border-transparent rounded-lg transition-all flex items-start gap-2.5 group cursor-pointer"
                    >
                      <Monitor className="w-4 h-4 text-blue-400 mt-0.5 group-hover:scale-110 transition-transform shrink-0" />
                      <div>
                        <div className="text-[11px] font-black text-white group-hover:text-blue-300 uppercase tracking-tight">
                          Mode Ekstend
                        </div>
                        <div className="text-[9px] text-gray-400 leading-snug">
                          Pop-up proyektor Monitor 2
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        window.open(`/projector?account=${currentAccountId}`, "_blank");
                        setShowProjectionDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-600/30 hover:border-emerald-500/40 border border-transparent rounded-lg transition-all flex items-start gap-2.5 group cursor-pointer mt-1"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform shrink-0" />
                      <div>
                        <div className="text-[11px] font-black text-white group-hover:text-emerald-300 uppercase tracking-tight">
                          Buka di Tab Web
                        </div>
                        <div className="text-[9px] text-gray-400 leading-snug">
                          Tampilkan proyektor di tab baru
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#1C1C1F] border border-[#2A2A2E] hover:bg-[#2A2A2E] text-gray-400 hover:text-white rounded text-[10px] font-black uppercase tracking-widest transition-all"
                style={{ borderStyle: "groove", borderRadius: "40px" }}
              >
                <QrCode className="w-3 h-3" /> Mobile Share
              </button>
            </div>
          </div>
        </aside>
      </div>
      {/* Editing Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[250] bg-[#222224] flex flex-col text-gray-200 font-sans select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex flex-col overflow-hidden bg-[#2D2D30] border-4 border-[#1E1E1E] shadow-2xl relative"
            >
              {/* 1. EASYWORSHIP 7 TOPBAR / WINDOW HEADER */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#1E1E1F] border-b border-[#111112] select-none">
                {/* Left: Window Title Card and Input Box */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-black/45 border border-zinc-700/60 rounded px-2.5 py-1 max-w-[320px]">
                    <span className="text-[10px] font-bold text-gray-400 font-mono tracking-tight uppercase">
                      Judul:
                    </span>
                    <input
                      type="text"
                      value={editingItem.title}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          title: e.target.value,
                        })
                      }
                      placeholder="A Mighty Fortress Is Our God"
                      className="bg-transparent border-none text-white text-xs font-semibold focus:outline-none min-w-[200px] select-all placeholder-zinc-600"
                    />
                  </div>
                </div>

                {/* Center/Right: Core Quick Buttons from EW7 */}
                <div className="flex items-center gap-1">
                  <div className="h-6 w-[1px] bg-zinc-700 mx-1"></div>

                  {/* Logo overlay button */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditorActiveMenu(
                        editorActiveMenu === "logo_overlay"
                          ? null
                          : "logo_overlay",
                      )
                    }
                    className={`flex flex-col items-center justify-center px-4 py-1 rounded hover:bg-zinc-700/50 transition-all ${editorActiveMenu === "logo_overlay" ? "bg-red-600/20 text-red-400 border border-red-500/30" : "text-gray-300 border border-transparent"}`}
                    title="Tambahkan logo pada slide presentasi (Atas Kanan atau Atas Kiri)"
                  >
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Logo
                    </span>
                  </button>

                  {/* Text Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem({
                        ...editingItem,
                        textBold: editingItem.textBold === false ? true : false,
                      });
                    }}
                    className="flex flex-col items-center justify-center px-4 py-1 rounded hover:bg-zinc-700/50 text-gray-300 transition-all border border-transparent"
                  >
                    <span className="text-sm font-black leading-none font-sans text-blue-400">
                      T
                    </span>
                    <span className="text-[9px] font-bold tracking-tight">
                      Text
                    </span>
                  </button>

                  {/* Scripture Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const show =
                        editorActiveMenu === "scripture" ? null : "scripture";
                      setEditorActiveMenu(show);
                      if (show) {
                        fetchEditorScripturePreview(
                          editorScripBook,
                          editorScripChapter,
                          editorScripVersion,
                        );
                      }
                    }}
                    className={`flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-zinc-700/50 transition-all border ${
                      editorActiveMenu === "scripture"
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                        : "text-gray-300 border-transparent"
                    }`}
                    title="Insert scripture verses dynamically as text slides"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Scripture
                    </span>
                  </button>

                  {/* Shape Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditorActiveMenu(
                        editorActiveMenu === "shape" ? null : "shape",
                      )
                    }
                    className={`flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-zinc-700/50 transition-all border ${
                      editorActiveMenu === "shape"
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                        : "text-gray-300 border-transparent"
                    }`}
                    title="Add layouts, frames, decorative brackets or overlay shapes"
                  >
                    <Square className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Shape
                    </span>
                  </button>

                  {/* Gambar Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveMenu(
                        editorActiveMenu === "gambar_bg" ? null : "gambar_bg",
                      );
                      setEditorMediaTab("static");
                    }}
                    className={`flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-zinc-700/50 transition-all border ${
                      editorActiveMenu === "gambar_bg"
                        ? "bg-red-600/20 text-red-400 border-red-500/40"
                        : "text-gray-300 border-transparent"
                    }`}
                    title="Atur latar belakang gambar statis dan warna solid"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Gambar
                    </span>
                  </button>

                  {/* Video Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorActiveMenu(
                        editorActiveMenu === "video_bg" ? null : "video_bg",
                      );
                      setEditorMediaTab("video");
                    }}
                    className={`flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-zinc-700/50 transition-all border ${
                      editorActiveMenu === "video_bg"
                        ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                        : "text-gray-300 border-transparent"
                    }`}
                    title="Atur latar belakang video motion loop"
                  >
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Video
                    </span>
                  </button>

                  {/* Arrange Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditorActiveMenu(
                        editorActiveMenu === "arrange" ? null : "arrange",
                      )
                    }
                    className={`flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-zinc-700/50 transition-all border ${
                      editorActiveMenu === "arrange"
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                        : "text-gray-300 border-transparent"
                    }`}
                    title="Reorder, duplicate, add, delete, or clean presentation slides"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Arrange
                    </span>
                  </button>

                  {/* Inspector Button (EW7 Style Sidebar Display toggle) */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditorTab(
                        editorTab === "styles" ? "content" : "styles",
                      )
                    }
                    className={`flex flex-col items-center justify-center px-4 py-1 rounded hover:bg-[#3E3E42] transition-colors ${editorTab === "styles" ? "bg-[#3E3E42] text-white animate-pulse" : "text-gray-300"}`}
                  >
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold font-mono">
                      i
                    </div>
                    <span className="text-[9px] font-bold tracking-tight mt-0.5">
                      Inspector
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. FORMATTING TOOLBAR (SECOND ROW) */}
              <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#1E1E1E]/85 overflow-x-auto text-[11px] text-gray-200 select-none no-scrollbar">
                <div className="flex items-center gap-1.5 py-0.5">
                  {/* Font Dropdown (Combobox style) */}
                  <select
                    value={editingItem.fontFamily || "Sans / Inter"}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        fontFamily: e.target.value,
                      })
                    }
                    className="bg-[#3E3E42] border border-[#2D2D30] text-[11px] font-semibold text-white rounded px-2 py-0.5 hover:bg-[#4E4E52] focus:outline-none cursor-pointer w-32"
                  >
                    <option value="Sans / Inter">Inter / Default</option>
                    <option value="Tahoma">Tahoma</option>
                    <option value="Cinzel">Cinzel</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Outfit">Outfit</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                  </select>

                  {/* Font Size Mode Selection */}
                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-2 select-none">
                    Size Mode:
                  </label>
                  <select
                    value={editingItem.fontSizeMode || "auto"}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        fontSizeMode: e.target.value as any,
                      })
                    }
                    className="bg-[#3E3E42] border border-[#2D2D30] text-[11px] font-semibold text-white rounded px-1.5 py-0.5 hover:bg-[#4E4E52] focus:outline-none cursor-pointer"
                  >
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>

                  {/* Size Value Incrementer Buttons */}
                  <div className="flex items-center bg-[#3E3E42] rounded border border-[#2D2D30] overflow-hidden ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const currentSize = editingItem.fontSize || 60;
                        setEditingItem({
                          ...editingItem,
                          fontSizeMode: "manual",
                          fontSize: Math.max(10, currentSize - 4),
                        });
                      }}
                      className="px-2 py-0.5 text-gray-300 hover:bg-[#4E4E52] active:bg-zinc-800 text-[10px] font-bold transition-colors"
                      title="Shrink text sizes"
                    >
                      A-
                    </button>
                    <span className="px-2 text-[10px] font-mono text-white border-x border-[#2D2D30] font-bold">
                      {editingItem.fontSizeMode === "auto"
                        ? "Auto"
                        : `${editingItem.fontSize || 60}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentSize = editingItem.fontSize || 60;
                        setEditingItem({
                          ...editingItem,
                          fontSizeMode: "manual",
                          fontSize: Math.min(200, currentSize + 4),
                        });
                      }}
                      className="px-2 py-0.5 text-gray-300 hover:bg-[#4E4E52] active:bg-zinc-800 text-[10px] font-bold transition-colors"
                      title="Enlarge text sizes"
                    >
                      A+
                    </button>
                  </div>

                  <div className="w-[1px] h-4 bg-zinc-750 mx-1.5"></div>

                  {/* Color box picker (Visual Square Color Button) */}
                  <div className="flex items-center gap-1">
                    <div
                      className="w-5 h-5 rounded border border-white/20 cursor-pointer hover:border-white shadow-sm flex items-center justify-center relative overflow-hidden"
                      style={{
                        backgroundColor: editingItem.textColor || "#ffffff",
                      }}
                    >
                      <input
                        type="color"
                        value={editingItem.textColor || "#ffffff"}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            textColor: e.target.value,
                          })
                        }
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold tracking-tighter text-zinc-400 uppercase select-all">
                      {editingItem.textColor || "#ffffff"}
                    </span>
                  </div>

                  <div className="w-[1px] h-4 bg-zinc-750 mx-1.5"></div>

                  {/* Character Styles Trigger Toggles (B, I, U, S, O Buttons) */}
                  <div className="flex items-center bg-[#1E1E1F] rounded p-0.5 border border-zinc-800">
                    {/* BOLD */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          textBold:
                            editingItem.textBold === false ? true : false,
                        })
                      }
                      className={`w-6 h-5 rounded text-xs font-bold font-sans transition-colors ${editingItem.textBold !== false ? "bg-blue-600 text-white shadow font-black" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                    >
                      B
                    </button>
                    {/* ITALIC */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          textItalic: !editingItem.textItalic,
                        })
                      }
                      className={`w-6 h-5 rounded text-xs italic font-serif transition-colors ${editingItem.textItalic ? "bg-blue-600 text-white shadow" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                    >
                      I
                    </button>
                    {/* UNDERLINE / Aa Change capitalization toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem({
                          ...editingItem,
                          textTransform:
                            (editingItem.textTransform || "uppercase") ===
                            "uppercase"
                              ? "none"
                              : "uppercase",
                        });
                      }}
                      className={`w-6 h-5 rounded text-xs font-mono transition-colors flex items-center justify-center ${(editingItem.textTransform || "uppercase") === "uppercase" ? "bg-[#3E3E42] text-yellow-400" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
                      title="Toggle ALL CAPS / Normal Mode"
                    >
                      Aa
                    </button>
                    {/* SHADOW */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          textShadow:
                            editingItem.textShadow === false ? true : false,
                        })
                      }
                      className={`w-6 h-5 rounded text-xs font-semibold font-sans transition-colors flex items-center justify-center relative ${editingItem.textShadow !== false ? "bg-blue-600 text-white shadow" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                      style={{ textShadow: "1px 1px 1px black" }}
                      title="Text Drop Shadow"
                    >
                      S
                    </button>
                    {/* OUTLINE */}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          textOutline: !editingItem.textOutline,
                        })
                      }
                      className={`w-6 h-5 rounded text-xs font-sans transition-colors flex items-center justify-center border-0 ${editingItem.textOutline ? "bg-blue-600 text-white shadow" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                      title="Text Contrast Stroke Outline"
                    >
                      <span className="inline-block px-0.5 border border-current font-bold text-[8px] leading-none uppercase">
                        O
                      </span>
                    </button>
                  </div>

                  <div className="w-[1px] h-4 bg-zinc-750 mx-1.5"></div>

                  {/* Horizontal Alignment Toggles */}
                  <div className="flex bg-[#1E1E1F] rounded p-0.5 border border-zinc-800">
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() =>
                          setEditingItem({ ...editingItem, textAlign: align })
                        }
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter transition-all ${
                          (editingItem.textAlign || "center") === align
                            ? "bg-blue-600 text-white shadow"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {align === "left"
                          ? "Kiri"
                          : align === "right"
                            ? "Kanan"
                            : "Tengah"}
                      </button>
                    ))}
                  </div>

                  <div className="w-[1px] h-4 bg-zinc-750 mx-1.5"></div>

                  {/* Vertical Alignment Toggles */}
                  <div className="flex bg-[#1E1E1F] rounded p-0.5 border border-zinc-800">
                    {(["top", "center", "bottom"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          setEditingItem({ ...editingItem, textPosition: pos })
                        }
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter transition-all ${
                          (editingItem.textPosition || "center") === pos
                            ? "bg-blue-600 text-white shadow"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {pos === "top"
                          ? "Atas"
                          : pos === "bottom"
                            ? "Bawah"
                            : "Tengah"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem({
                        ...editingItem,
                        fontFamily: "Sans / Inter",
                        textColor: "#ffffff",
                        fontSizeMode: "auto",
                        fontSize: 60,
                        textBold: true,
                        textItalic: false,
                        textShadow: true,
                        textOutline: false,
                        textOutlineColor: "#000000",
                        textAlign: "center",
                        textPosition: "center",
                        textTransform: "uppercase",
                        textSpacing: "normal",
                        textTracking: "normal",
                      });
                    }}
                    className="text-red-400 hover:text-red-300 font-bold text-[9px] uppercase hover:underline cursor-pointer"
                  >
                    Reset Styles
                  </button>
                </div>
              </div>

              {/* SPECIAL MENU TOOLS PANELS (Scripture, Shape, Media, Arrange) */}
              <AnimatePresence>
                {false && editorActiveMenu && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="bg-[#1E1E1F] border-b border-[#111112] overflow-hidden flex flex-col shrink-0 select-none text-zinc-350"
                  >
                    <div className="p-1 px-1.5 bg-[#111112]/45 border-t border-zinc-800 flex flex-col gap-1 relative">
                      {/* Close button inside panel */}
                      <button
                        type="button"
                        onClick={() => setEditorActiveMenu(null)}
                        className="absolute top-1 right-1 px-1 py-0.5 bg-[#2D2D30]/80 hover:bg-[#3E3E42]/90 text-zinc-400 hover:text-white rounded text-[8px] uppercase font-extrabold border border-zinc-800"
                      >
                        ✕ Close
                      </button>
                      {editorActiveMenu === "shape" && (
                        <div className="flex flex-col gap-1 text-left text-[10px]">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1">
                            {[
                              { id: "none", label: "Klasik" },
                              { id: "bottom-bar", label: "Lower Third" },
                              { id: "left-accent", label: "Left Accent" },
                              { id: "brackets", label: "Deluxe Brackets" },
                              { id: "thin-frame", label: "Classic Inset" },
                              { id: "glow-rect", label: "Glow Backdrop" },
                            ].map((shape) => {
                              const isSelected =
                                (editingItem.shapeDecoration || "none") ===
                                shape.id;
                              return (
                                <button
                                  key={shape.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingItem({
                                      ...editingItem,
                                      shapeDecoration: shape.id,
                                    });
                                  }}
                                  className={`p-1 px-2 rounded border text-center h-7 flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-cyan-950/85 border-cyan-500 text-cyan-200 text-[10px] font-black"
                                      : "bg-[#1C1C1E] hover:bg-[#2F2F32] border-zinc-800 text-zinc-400 text-[9px] font-bold"
                                  }`}
                                >
                                  {shape.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* C. GAMBAR BACKGROUNDS PANEL */}
                      {editorActiveMenu === "gambar_bg" && (
                        <div className="flex flex-col gap-1 text-left">
                          {/* Selection Grid (Optimized thin rows) */}
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1 max-h-[70px] overflow-y-auto pr-1">
                            {[
                              { name: "Tanpa", url: "", type: "color" },
                              {
                                name: "Solid Hitam",
                                url: "#000000",
                                type: "color",
                              },
                              { name: "Cerah", url: "#F5F5F0", type: "color" },
                              {
                                name: "Purple",
                                url: "linear-gradient(135deg, #1A0D32 0%, #05020C 100%)",
                                type: "color",
                              },
                              ...BACKGROUNDS.map((bg, bIdx) => ({
                                name: `BG ${bIdx + 1}`,
                                url: bg,
                                type: "image",
                              })),
                              ...customBackgrounds.map((bg, cbIdx) => ({
                                name: `Kustom ${cbIdx + 1}`,
                                url: bg,
                                type: "image",
                              })),
                            ].map((media, mIdx) => {
                              const isSelected =
                                editingItem.backgroundOverride === media.url;
                              return (
                                <button
                                  key={mIdx}
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      backgroundOverride: media.url,
                                    })
                                  }
                                  className={`rounded border text-left overflow-hidden h-7 flex flex-col justify-end p-0.5 relative transition-all cursor-pointer ${
                                    isSelected
                                      ? "border-purple-500 ring-1 ring-purple-600/50 shadow-md font-black"
                                      : "border-zinc-800 hover:border-zinc-500"
                                  }`}
                                  style={{
                                    background:
                                      media.type === "color" && media.url
                                        ? media.url
                                        : media.type === "color"
                                          ? "#18181B"
                                          : undefined,
                                  }}
                                >
                                  {media.type === "image" && (
                                    <img
                                      src={resolveMedia(media.url)}
                                      className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                                      referrerPolicy="no-referrer"
                                      alt=""
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
                                  <span className="text-[7.5px] font-black text-white line-clamp-1 relative z-10 leading-none">
                                    {media.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Compact control bar */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-855 text-[10px]">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase shrink-0">
                              Tautan:
                            </span>
                            <input
                              type="text"
                              value={editingItem.backgroundOverride || ""}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  backgroundOverride: e.target.value,
                                })
                              }
                              placeholder="URL Gambar..."
                              className="flex-1 min-w-[120px] bg-[#1e1e1f] border border-zinc-800 rounded px-1.5 py-0.5 text-[9.5px] text-white placeholder-zinc-650 focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => bgFileInputRef.current?.click()}
                              className="px-2 py-0.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded text-[9px] font-bold uppercase text-purple-300 hover:text-white transition cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <FolderOpen className="w-2.5 h-2.5 text-purple-400" />
                              <span>Upload</span>
                            </button>
                            <div className="h-3.5 w-[1px] bg-zinc-800 shrink-0" />
                            <span className="text-[9px] text-zinc-500 font-bold uppercase shrink-0">
                              Gaya:
                            </span>
                            <div className="flex gap-0.5 shrink-0">
                              {(["cover", "contain", "fill"] as const).map(
                                (fit) => (
                                  <button
                                    key={fit}
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        bgFit: fit,
                                      })
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-colors border ${
                                      (editingItem.bgFit || "cover") === fit
                                        ? "bg-purple-950/50 text-purple-300 border-purple-500 font-black"
                                        : "bg-[#1E1E20] border-zinc-800 text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    {fit === "cover"
                                      ? "Isi"
                                      : fit === "contain"
                                        ? "Fit"
                                        : "Stretch"}
                                  </button>
                                ),
                              )}
                            </div>
                            {editingItem.backgroundOverride && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingItem({
                                    ...editingItem,
                                    backgroundOverride: "",
                                  })
                                }
                                className="px-2 py-0.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/60 rounded text-[8.5px] font-extrabold text-red-500 uppercase transition cursor-pointer shrink-0 ml-auto"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* C2. VIDEO BACKGROUNDS PANEL */}
                      {editorActiveMenu === "video_bg" && (
                        <div className="flex flex-col gap-1 text-left">
                          {/* Selection Grid (Optimized thin rows) */}
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1 max-h-[70px] overflow-y-auto pr-1">
                            {customVideoBackgrounds.length === 0 ? (
                              <div className="col-span-full py-1 text-center text-zinc-500 text-[9px] bg-[#171718] rounded border border-dashed border-zinc-800/70">
                                Belum ada kustom video. Unggah MP4 di bawah.
                              </div>
                            ) : (
                              customVideoBackgrounds.map((bg, cvbIdx) => {
                                const isSelected =
                                  editingItem.backgroundOverride === bg;
                                return (
                                  <button
                                    key={cvbIdx}
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        backgroundOverride: bg,
                                      })
                                    }
                                    className={`rounded border text-left overflow-hidden h-7 flex flex-col justify-end p-0.5 relative transition-all bg-black cursor-pointer ${
                                      isSelected
                                        ? "border-indigo-500 ring-1 ring-indigo-500/50 shadow-md"
                                        : "border-zinc-800 hover:border-zinc-500"
                                    }`}
                                  >
                                    <div className="absolute inset-0 flex items-center justify-center opacity-60 pointer-events-none z-10">
                                      <Video className="w-3 h-3 text-indigo-400" />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
                                    <span className="text-[7.5px] font-black text-white line-clamp-1 relative z-10 leading-none">
                                      Video {cvbIdx + 1}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Control bar */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-850 text-[10px]">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase shrink-0">
                              MP4:
                            </span>
                            <input
                              type="text"
                              value={editingItem.backgroundOverride || ""}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  backgroundOverride: e.target.value,
                                })
                              }
                              placeholder="URL Video MP4..."
                              className="flex-1 min-w-[120px] bg-[#1e1e1f] border border-zinc-800 rounded px-1.5 py-0.5 text-[9.5px] text-white placeholder-zinc-650 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => bgFileInputRef.current?.click()}
                              className="px-2 py-0.5 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700/50 rounded text-[9px] font-bold uppercase text-indigo-300 hover:text-white transition cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <FolderOpen className="w-2.5 h-2.5 text-indigo-455" />
                              <span>Upload</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingItem({
                                  ...editingItem,
                                  bgScale: 100,
                                  bgPositionX: 0,
                                  bgPositionY: 0,
                                  bgFit: "cover",
                                })
                              }
                              className="px-2 py-0.5 bg-[#1E1E20] hover:bg-zinc-800 border border-zinc-800 text-[8px] font-black uppercase text-zinc-300 hover:text-white rounded transition cursor-pointer shrink-0"
                            >
                              Reset Posisi
                            </button>
                            {editingItem.backgroundOverride && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingItem({
                                    ...editingItem,
                                    backgroundOverride: "",
                                  })
                                }
                                className="px-2 py-0.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/60 rounded text-[8.5px] font-extrabold text-red-400 uppercase transition cursor-pointer shrink-0 ml-auto"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* D. ARRANGE PANEL */}
                      {editorActiveMenu === "arrange" && (
                        <div className="flex flex-col gap-1 text-left">
                          <div className="flex flex-wrap items-center gap-1 text-[10px] py-0.5">
                            {/* Move Up */}
                            <button
                              type="button"
                              onClick={() => {
                                if (editorPreviewIdx <= 0) return;
                                const newVerses = [...editingItem.verses];
                                const newLabels = [
                                  ...(editingItem.verseLabels || []),
                                ];

                                const vTemp = newVerses[editorPreviewIdx];
                                newVerses[editorPreviewIdx] =
                                  newVerses[editorPreviewIdx - 1];
                                newVerses[editorPreviewIdx - 1] = vTemp;

                                const lTemp = newLabels[editorPreviewIdx];
                                newLabels[editorPreviewIdx] =
                                  newLabels[editorPreviewIdx - 1];
                                newLabels[editorPreviewIdx - 1] = lTemp;

                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                  verseLabels: newLabels,
                                });
                                setEditorPreviewIdx(editorPreviewIdx - 1);
                              }}
                              disabled={editorPreviewIdx <= 0}
                              className="px-2 py-1 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white disabled:opacity-30 border border-zinc-800 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              ↑ Naik
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  editorPreviewIdx >=
                                  editingItem.verses.length - 1
                                )
                                  return;
                                const newVerses = [...editingItem.verses];
                                const newLabels = [
                                  ...(editingItem.verseLabels || []),
                                ];

                                const vTemp = newVerses[editorPreviewIdx];
                                newVerses[editorPreviewIdx] =
                                  newVerses[editorPreviewIdx + 1];
                                newVerses[editorPreviewIdx + 1] = vTemp;

                                const lTemp = newLabels[editorPreviewIdx];
                                newLabels[editorPreviewIdx] =
                                  newLabels[editorPreviewIdx + 1];
                                newLabels[editorPreviewIdx + 1] = lTemp;

                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                  verseLabels: newLabels,
                                });
                                setEditorPreviewIdx(editorPreviewIdx + 1);
                              }}
                              disabled={
                                editorPreviewIdx >=
                                editingItem.verses.length - 1
                              }
                              className="px-2 py-1 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white disabled:opacity-30 border border-zinc-800 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              ↓ Turun
                            </button>

                            <div className="h-3.5 w-[1px] bg-zinc-800 mx-0.5"></div>

                            {/* Duplicate Slide */}
                            <button
                              type="button"
                              onClick={() => {
                                const newVerses = [...editingItem.verses];
                                const isBible =
                                  editingItem.id?.startsWith("bible-") ||
                                  editingItem.type === "bible";
                                const originalLabels = editingItem.verseLabels
                                  ? [...editingItem.verseLabels]
                                  : editingItem.verses.map((_, idx) =>
                                      isBible
                                        ? `Ayat ${idx + 1}`
                                        : `Verse ${idx + 1}`,
                                    );
                                const originalLabel =
                                  originalLabels[editorPreviewIdx] || "";

                                newVerses.splice(
                                  editorPreviewIdx + 1,
                                  0,
                                  newVerses[editorPreviewIdx],
                                );
                                const tempLabels = [...originalLabels];
                                tempLabels.splice(
                                  editorPreviewIdx + 1,
                                  0,
                                  originalLabel,
                                );

                                const newLabels = regenerateSlideLabels(
                                  newVerses,
                                  tempLabels,
                                  isBible,
                                );

                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                  verseLabels: newLabels,
                                });
                                setEditorPreviewIdx(editorPreviewIdx + 1);
                              }}
                              className="px-2.5 py-1 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white border border-zinc-800 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              Duplikasi
                            </button>

                            {/* Add Slide */}
                            <button
                              type="button"
                              onClick={() => {
                                const newVerses = [...editingItem.verses];
                                const isBible =
                                  editingItem.id?.startsWith("bible-") ||
                                  editingItem.type === "bible";
                                const originalLabels = editingItem.verseLabels
                                  ? [...editingItem.verseLabels]
                                  : editingItem.verses.map((_, idx) =>
                                      isBible
                                        ? `Ayat ${idx + 1}`
                                        : `Verse ${idx + 1}`,
                                    );

                                newVerses.splice(editorPreviewIdx + 1, 0, "");
                                const tempLabels = [...originalLabels];
                                tempLabels.splice(
                                  editorPreviewIdx + 1,
                                  0,
                                  isBible ? "Ayat Baru" : "Verse Baru",
                                );

                                const newLabels = regenerateSlideLabels(
                                  newVerses,
                                  tempLabels,
                                  isBible,
                                );

                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                  verseLabels: newLabels,
                                });
                                setEditorPreviewIdx(editorPreviewIdx + 1);
                              }}
                              className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Tambah Baru
                            </button>

                            <div className="h-3.5 w-[1px] bg-zinc-800 mx-0.5"></div>

                            {/* Clear Current */}
                            <button
                              type="button"
                              onClick={() => {
                                const newVerses = [...editingItem.verses];
                                newVerses[editorPreviewIdx] = "";
                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                });
                              }}
                              className="px-2 py-1 bg-[#2D2D30] hover:bg-[#3E3E42] text-yellow-500 border border-zinc-800 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              Hapus Teks
                            </button>

                            {/* Delete Slide */}
                            <button
                              type="button"
                              onClick={() => {
                                if (editingItem.verses.length <= 1) return;
                                const newVerses = [...editingItem.verses];
                                const isBible =
                                  editingItem.id?.startsWith("bible-") ||
                                  editingItem.type === "bible";
                                const originalLabels = editingItem.verseLabels
                                  ? [...editingItem.verseLabels]
                                  : editingItem.verses.map((_, idx) =>
                                      isBible
                                        ? `Ayat ${idx + 1}`
                                        : `Verse ${idx + 1}`,
                                    );

                                newVerses.splice(editorPreviewIdx, 1);
                                const tempLabels = [...originalLabels];
                                if (tempLabels.length > editorPreviewIdx) {
                                  tempLabels.splice(editorPreviewIdx, 1);
                                }

                                const newLabels = regenerateSlideLabels(
                                  newVerses,
                                  tempLabels,
                                  isBible,
                                );

                                setEditingItem({
                                  ...editingItem,
                                  verses: newVerses,
                                  verseLabels: newLabels,
                                });
                                setEditorPreviewIdx(
                                  Math.max(0, editorPreviewIdx - 1),
                                );
                              }}
                              disabled={editingItem.verses.length <= 1}
                              className="px-2 py-1 bg-red-950/45 hover:bg-red-950/70 text-red-400 disabled:opacity-30 border border-red-900/40 rounded text-[9px] font-semibold uppercase tracking-wide transition flex items-center gap-1 cursor-pointer"
                            >
                              <Trash className="w-2.5 h-2.5" />
                              Hapus Slide
                            </button>
                          </div>
                        </div>
                      )}

                      {/* E. LOGO OVERLAY PANEL */}
                      {editorActiveMenu === "logo_overlay" && (
                        <div className="flex flex-col gap-1 text-left bg-[#131314]/50 p-1.5 rounded border border-zinc-850 shadow-lg">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-1 mb-1">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">
                              TARGET LOGO SLIDE
                            </span>
                            <div className="flex items-center gap-1.5">
                              {editingItem.logoLeftUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      logoLeftUrl: undefined,
                                    })
                                  }
                                  className="text-[8.5px] font-black text-red-400 hover:text-red-300 transition-colors uppercase cursor-pointer bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/40"
                                >
                                  Clear Kiri
                                </button>
                              )}
                              {editingItem.logoRightUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      logoRightUrl: undefined,
                                    })
                                  }
                                  className="text-[8.5px] font-black text-red-400 hover:text-red-300 transition-colors uppercase cursor-pointer bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/40"
                                >
                                  Clear Kanan
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Choose Logo Slot Selector Row */}
                          <div className="flex flex-wrap items-center gap-2 bg-black/35 p-1 rounded border border-zinc-900 text-[10px]">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase shrink-0">
                              Slot:
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditorLogoSlot("left")}
                                className={`px-2 py-0.5 rounded text-[8.5px] font-black transition uppercase ${
                                  editorLogoSlot === "left"
                                    ? "bg-purple-600 text-white font-black shadow"
                                    : "bg-[#2D2D30] text-zinc-400 hover:text-white_400"
                                }`}
                              >
                                ← Kiri Atas
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditorLogoSlot("right")}
                                className={`px-2 py-0.5 rounded text-[8.5px] font-black transition uppercase ${
                                  editorLogoSlot === "right"
                                    ? "bg-purple-600 text-white font-black shadow"
                                    : "bg-[#2D2D30] text-zinc-400 hover:text-white_400"
                                }`}
                              >
                                Kanan Atas →
                              </button>
                            </div>
                            <span className="text-[8px] text-zinc-500 ml-auto italic leading-none shrink-0">
                              {editorLogoSlot === "left"
                                ? "Klik di bawah untuk Kiri"
                                : "Klik di bawah untuk Kanan"}
                            </span>
                          </div>

                          <div className="space-y-1 mt-1">
                            {/* Scrollable list of media images (highly compact list max-h-16) */}
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1 max-h-[64px] overflow-y-auto pr-1">
                              {[...BACKGROUNDS, ...customBackgrounds].map(
                                (bg, idx) => {
                                  const isColor =
                                    bg.startsWith("#") ||
                                    bg.startsWith("rgb") ||
                                    bg.startsWith("linear-gradient") ||
                                    bg === "transparent";
                                  if (isColor) return null; // Only use images as logos

                                  const isLeft = editingItem.logoLeftUrl === bg;
                                  const isRight =
                                    editingItem.logoRightUrl === bg;
                                  const isSelected =
                                    (editorLogoSlot === "left" && isLeft) ||
                                    (editorLogoSlot === "right" && isRight);

                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (editorLogoSlot === "left") {
                                          setEditingItem({
                                            ...editingItem,
                                            logoLeftUrl: bg,
                                          });
                                        } else {
                                          setEditingItem({
                                            ...editingItem,
                                            logoRightUrl: bg,
                                          });
                                        }
                                      }}
                                      className={`relative aspect-square rounded overflow-hidden border transition-all hover:scale-105 h-8 w-8 mx-auto ${
                                        isSelected
                                          ? "border-purple-500 ring-1 ring-purple-500/40 shadow"
                                          : "border-zinc-800 opacity-70 hover:opacity-100"
                                      }`}
                                    >
                                      <img
                                        src={resolveMedia(bg)}
                                        alt={`Media ${idx}`}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      {isLeft && (
                                        <div className="absolute top-0.5 left-0.5 bg-blue-600 text-white text-[6px] px-0.5 rounded-sm font-black uppercase text-center leading-none py-0.5">
                                          L
                                        </div>
                                      )}
                                      {isRight && (
                                        <div className="absolute bottom-0.5 right-0.5 bg-purple-600 text-white text-[6px] px-0.5 rounded-sm font-black uppercase text-center leading-none py-0.5">
                                          R
                                        </div>
                                      )}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 3. CORE EDITING WORKSPACE PANEL (SPLIT IN TWO) */}
              <div
                id="editor-workspace-container"
                className="flex-1 overflow-hidden flex relative bg-[#1E1E1F]"
              >
                {/* A. LEFT SIDEBAR PANEL: WORKSHEET (Words, Slides, Masters) */}
                <div
                  style={{ width: `${editorSidebarWidth}%` }}
                  className="border-r border-[#151516] flex flex-col overflow-hidden bg-[#252526] shrink-0"
                >
                  {/* Miniature Tabs Bar resembling EW7 on left side */}
                  <div className="flex border-b border-[#1E1E1F] bg-[#1E1E1F]">
                    {(["words", "slides", "masters"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          if (tab === "words") setEditorTab("content");
                          else if (tab === "slides") setEditorTab("styles");
                          else if (tab === "masters") setEditorTab("masters");
                        }}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors border-r border-[#2C2C2E] ${
                          (editorTab === "content" && tab === "words") ||
                          (editorTab === "styles" && tab === "slides") ||
                          (editorTab === "masters" && tab === "masters")
                            ? "bg-[#252526] text-white border-t-2 border-t-blue-500 font-black"
                            : "bg-[#1E1E1F] text-zinc-500 hover:text-zinc-400 font-bold"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                    <div className="flex-1 bg-[#1E1E1F]"></div>
                  </div>

                  {/* LEFT TAB DIRECT PANEL CONTAINER */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#171718] p-3 space-y-4">
                    {editorTab === "content" ? (
                      <>
                        {/* Slide Blocks Stack matching EasyWorship 7 exactly */}
                        {editingItem.verses.map((v, i) => {
                          const labelValue =
                            editingItem.verseLabels?.[i] !== undefined
                              ? editingItem.verseLabels[i]
                              : `Verse ${i + 1}`;
                          const isChorus = labelValue
                            .toLowerCase()
                            .includes("chorus");
                          const isBridge = labelValue
                            .toLowerCase()
                            .includes("bridge");
                          const isEnding =
                            labelValue.toLowerCase().includes("ending") ||
                            labelValue.toLowerCase().includes("outro");

                          // EasyWorship tag coloring
                          const tagBgClass =
                            labelValue === ""
                              ? "bg-zinc-700/80 border-zinc-650"
                              : isChorus
                                ? "bg-[#82213e] border-[#9e274a]"
                                : isBridge
                                  ? "bg-[#a37910] border-[#c08d13]"
                                  : isEnding
                                    ? "bg-[#106d48] border-[#138255]"
                                    : "bg-[#214392] border-[#2954b5]"; // standard Verse

                          return (
                            <div
                              key={i}
                              onClick={() => setEditorPreviewIdx(i)}
                              className={`flex rounded border transition-all ${
                                editorPreviewIdx === i
                                  ? "border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/20"
                                  : "border-[#2C2C2E] hover:border-[#3E3E42]"
                              } bg-[#1E1E20] group overflow-hidden`}
                            >
                              {/* Left Margin Gutter with Index details */}
                              <div className="w-8 flex flex-col items-center justify-start bg-[#1C1C1E] border-r border-[#2A2A2D] py-1.5 shrink-0 select-none text-zinc-500 cursor-pointer">
                                <span className="text-[10px] font-black font-mono leading-none">
                                  {i + 1}
                                </span>
                                <div className="mt-1.5 opacity-60">
                                  <Monitor className="w-3 h-3 text-zinc-600" />
                                </div>
                              </div>

                              {/* Main block containing banner header & textarea */}
                              <div className="flex-1 flex flex-col min-w-0">
                                {/* Slide Section Banner Color Input */}
                                <div
                                  className={`flex items-center justify-between border-b ${tagBgClass} py-0.5 px-2 text-white font-semibold text-[10px] tracking-wide`}
                                >
                                  <input
                                    type="text"
                                    value={labelValue}
                                    onChange={(e) => {
                                      const newLabels = editingItem.verseLabels
                                        ? [...editingItem.verseLabels]
                                        : editingItem.verses.map(
                                            (_, idx) => `Verse ${idx + 1}`,
                                          );
                                      newLabels[i] = e.target.value;
                                      setEditingItem({
                                        ...editingItem,
                                        verseLabels: newLabels,
                                      });
                                    }}
                                    placeholder="Sambungan Verse..."
                                    className="bg-transparent border-none text-white font-bold placeholder-white/50 focus:outline-none focus:bg-black/25 uppercase font-sans tracking-wider py-0.5 px-1 rounded text-[10px] w-40 text-left"
                                  />

                                  {/* Fast tag switch dropdown */}
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newLabels =
                                          editingItem.verseLabels
                                            ? [...editingItem.verseLabels]
                                            : editingItem.verses.map(
                                                (_, idx) => `Verse ${idx + 1}`,
                                              );
                                        newLabels[i] = isChorus
                                          ? `Verse ${i + 1}`
                                          : "Chorus 1";
                                        setEditingItem({
                                          ...editingItem,
                                          verseLabels: newLabels,
                                        });
                                      }}
                                      className="px-1.5 py-0.5 bg-black/35 hover:bg-black/50 rounded text-[7px] font-black uppercase transition-colors"
                                      title="Toggle Chorus"
                                    >
                                      Toggle {isChorus ? "Verse" : "Chorus"}
                                    </button>
                                  </div>
                                </div>

                                {/* Slide Block Text Content textarea */}
                                <div className="p-2 relative bg-[#121213]">
                                  <textarea
                                    value={v}
                                    onFocus={() => setEditorPreviewIdx(i)}
                                    onChange={(e) => {
                                      const newVerses = [...editingItem.verses];
                                      newVerses[i] = e.target.value;
                                      setEditingItem({
                                        ...editingItem,
                                        verses: newVerses,
                                      });
                                    }}
                                    className="w-full bg-[#121213] text-white text-[11px] font-medium leading-relaxed resize-none h-[72px] focus:outline-none focus:bg-[#1a1a1c] scrollbar-thin transition-colors"
                                    placeholder="Enter verse lines here..."
                                  />

                                  {/* Float Tool Overlays */}
                                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    {/* Smart Split Box */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newVerses = [
                                          ...editingItem.verses,
                                        ];
                                        const isBible =
                                          editingItem.id?.startsWith(
                                            "bible-",
                                          ) || editingItem.type === "bible";

                                        const originalLabels =
                                          editingItem.verseLabels
                                            ? [...editingItem.verseLabels]
                                            : editingItem.verses.map(
                                                (_, idx) =>
                                                  isBible
                                                    ? `Ayat ${idx + 1}`
                                                    : `Verse ${idx + 1}`,
                                              );
                                        const originalLabel =
                                          originalLabels[i] !== undefined
                                            ? originalLabels[i]
                                            : isBible
                                              ? `Ayat ${i + 1}`
                                              : `Verse ${i + 1}`;

                                        const words = v.split("\n");
                                        if (words.length > 2) {
                                          const half = Math.ceil(
                                            words.length / 2,
                                          );
                                          const v1 = words
                                            .slice(0, half)
                                            .join("\n");
                                          const v2 = words
                                            .slice(half)
                                            .join("\n");

                                          newVerses.splice(i, 1, v1, v2);
                                          const tempLabels = [
                                            ...originalLabels,
                                          ];
                                          tempLabels.splice(
                                            i,
                                            1,
                                            originalLabel,
                                            "",
                                          );
                                          const newLabels =
                                            regenerateSlideLabels(
                                              newVerses,
                                              tempLabels,
                                              isBible,
                                            );
                                          const updatedItem = {
                                            ...editingItem,
                                            verses: newVerses,
                                            verseLabels: newLabels,
                                          };

                                          setEditingItem(updatedItem);
                                          setEditorPreviewIdx(i);

                                          // Real-time synchronization to main screen view
                                          if (
                                            selectedSong &&
                                            selectedSong.id === updatedItem.id
                                          ) {
                                            setSelectedSong(updatedItem as any);
                                          }
                                          const newSched = schedule.map((s) =>
                                            s.id === updatedItem.id
                                              ? updatedItem
                                              : s,
                                          );
                                          setSchedule(newSched);
                                          localStorage.setItem(
                                            "cp_last_schedule",
                                            JSON.stringify(newSched),
                                          );
                                        } else {
                                          const spaceSplit = v.split(" ");
                                          if (spaceSplit.length > 4) {
                                            const half = Math.ceil(
                                              spaceSplit.length / 2,
                                            );
                                            const v1 = spaceSplit
                                              .slice(0, half)
                                              .join(" ");
                                            const v2 = spaceSplit
                                              .slice(half)
                                              .join(" ");

                                            newVerses.splice(i, 1, v1, v2);
                                            const tempLabels = [
                                              ...originalLabels,
                                            ];
                                            tempLabels.splice(
                                              i,
                                              1,
                                              originalLabel,
                                              "",
                                            );
                                            const newLabels =
                                              regenerateSlideLabels(
                                                newVerses,
                                                tempLabels,
                                                isBible,
                                              );
                                            const updatedItem = {
                                              ...editingItem,
                                              verses: newVerses,
                                              verseLabels: newLabels,
                                            };

                                            setEditingItem(updatedItem);
                                            setEditorPreviewIdx(i);

                                            // Real-time synchronization to main screen view
                                            if (
                                              selectedSong &&
                                              selectedSong.id === updatedItem.id
                                            ) {
                                              setSelectedSong(
                                                updatedItem as any,
                                              );
                                            }
                                            const newSched = schedule.map(
                                              (s) =>
                                                s.id === updatedItem.id
                                                  ? updatedItem
                                                  : s,
                                            );
                                            setSchedule(newSched);
                                            localStorage.setItem(
                                              "cp_last_schedule",
                                              JSON.stringify(newSched),
                                            );
                                          } else {
                                            alert(
                                              "Teks terlalu pendek untuk dipecah menjadi dua.",
                                            );
                                          }
                                        }
                                      }}
                                      className="p-1 bg-[#252526] border border-[#3E3E42] text-xs text-blue-400 hover:text-white rounded"
                                      title="Split this slide evenly into two"
                                    >
                                      <Scissors className="w-2.5 h-2.5" />
                                    </button>

                                    {/* Duplicate Slide Block */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newVerses = [
                                          ...editingItem.verses,
                                        ];
                                        const isBible =
                                          editingItem.id?.startsWith(
                                            "bible-",
                                          ) || editingItem.type === "bible";

                                        newVerses.splice(i + 1, 0, v);
                                        const originalLabels =
                                          editingItem.verseLabels
                                            ? [...editingItem.verseLabels]
                                            : editingItem.verses.map(
                                                (_, idx) =>
                                                  isBible
                                                    ? `Ayat ${idx + 1}`
                                                    : `Verse ${idx + 1}`,
                                              );
                                        const originalLabel =
                                          originalLabels[i] || "";
                                        const tempLabels = [...originalLabels];
                                        tempLabels.splice(
                                          i + 1,
                                          0,
                                          originalLabel,
                                        );

                                        const newLabels = regenerateSlideLabels(
                                          newVerses,
                                          tempLabels,
                                          isBible,
                                        );
                                        const updatedItem = {
                                          ...editingItem,
                                          verses: newVerses,
                                          verseLabels: newLabels,
                                        };

                                        setEditingItem(updatedItem);
                                        setEditorPreviewIdx(i + 1);

                                        // Real-time synchronization to main screen view
                                        if (
                                          selectedSong &&
                                          selectedSong.id === updatedItem.id
                                        ) {
                                          setSelectedSong(updatedItem as any);
                                        }
                                        const newSched = schedule.map((s) =>
                                          s.id === updatedItem.id
                                            ? updatedItem
                                            : s,
                                        );
                                        setSchedule(newSched);
                                        localStorage.setItem(
                                          "cp_last_schedule",
                                          JSON.stringify(newSched),
                                        );
                                      }}
                                      className="p-1 bg-[#252526] border border-[#3E3E42] text-xs text-amber-400 hover:text-white rounded"
                                      title="Duplicate this slide"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>

                                    {/* Trash Box */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editingItem.verses.length <= 1) {
                                          alert(
                                            "Presentasi harus memiliki minimal satu slide!",
                                          );
                                          return;
                                        }
                                        const newVerses =
                                          editingItem.verses.filter(
                                            (_, idx) => idx !== i,
                                          );
                                        const isBible =
                                          editingItem.id?.startsWith(
                                            "bible-",
                                          ) || editingItem.type === "bible";
                                        const originalLabels =
                                          editingItem.verseLabels
                                            ? [...editingItem.verseLabels]
                                            : editingItem.verses.map(
                                                (_, idx) =>
                                                  isBible
                                                    ? `Ayat ${idx + 1}`
                                                    : `Verse ${idx + 1}`,
                                              );
                                        const tempLabels =
                                          originalLabels.filter(
                                            (_, idx) => idx !== i,
                                          );
                                        const newLabels = regenerateSlideLabels(
                                          newVerses,
                                          tempLabels,
                                          isBible,
                                        );
                                        const updatedItem = {
                                          ...editingItem,
                                          verses: newVerses,
                                          verseLabels: newLabels,
                                        };

                                        setEditingItem(updatedItem);
                                        setEditorPreviewIdx(Math.max(0, i - 1));

                                        // Real-time synchronization to main screen view
                                        if (
                                          selectedSong &&
                                          selectedSong.id === updatedItem.id
                                        ) {
                                          setSelectedSong(updatedItem as any);
                                        }
                                        const newSched = schedule.map((s) =>
                                          s.id === updatedItem.id
                                            ? updatedItem
                                            : s,
                                        );
                                        setSchedule(newSched);
                                        localStorage.setItem(
                                          "cp_last_schedule",
                                          JSON.stringify(newSched),
                                        );
                                      }}
                                      className="p-1 bg-[#252526] border border-[#3E3E42] text-xs text-red-400 hover:text-white rounded"
                                      title="Remove slide"
                                    >
                                      <Trash className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Appending New Slide block */}
                        <button
                          type="button"
                          onClick={() => {
                            const newVerses = [
                              ...editingItem.verses,
                              "Teks lirik baru",
                            ];
                            const isBible =
                              editingItem.id?.startsWith("bible-") ||
                              editingItem.type === "bible";
                            const originalLabels = editingItem.verseLabels
                              ? [...editingItem.verseLabels]
                              : editingItem.verses.map((_, idx) =>
                                  isBible
                                    ? `Ayat ${idx + 1}`
                                    : `Verse ${idx + 1}`,
                                );
                            const tempLabels = [
                              ...originalLabels,
                              isBible ? "Ayat Baru" : "Verse Baru",
                            ];
                            const newLabels = regenerateSlideLabels(
                              newVerses,
                              tempLabels,
                              isBible,
                            );
                            const updatedItem = {
                              ...editingItem,
                              verses: newVerses,
                              verseLabels: newLabels,
                            };

                            setEditingItem(updatedItem);
                            setEditorPreviewIdx(newVerses.length - 1);

                            // Real-time synchronization to main screen view
                            if (
                              selectedSong &&
                              selectedSong.id === updatedItem.id
                            ) {
                              setSelectedSong(updatedItem as any);
                            }
                            const newSched = schedule.map((s) =>
                              s.id === updatedItem.id ? updatedItem : s,
                            );
                            setSchedule(newSched);
                            localStorage.setItem(
                              "cp_last_schedule",
                              JSON.stringify(newSched),
                            );
                          }}
                          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-[#3E3E42] hover:border-gray-500 rounded text-[10px] font-bold text-gray-300 hover:text-white uppercase transition-colors flex items-center justify-center gap-1 cursor-pointer select-none"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Blok Slide
                          Baru
                        </button>
                      </>
                    ) : editorTab === "styles" ? (
                      // Tab styles configuration inside Left column
                      <div className="space-y-4 text-xs text-gray-300 bg-[#1e1e1f] p-4 rounded border border-zinc-800">
                        <div className="text-white font-bold text-[10px] uppercase tracking-widest border-b border-zinc-800 pb-1 mb-2">
                          Display Preferences
                        </div>

                        {/* Font list */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">
                            Font Family:
                          </label>
                          <select
                            value={editingItem.fontFamily || "Sans / Inter"}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                fontFamily: e.target.value,
                              })
                            }
                            className="bg-[#3E3E42] border border-[#2D2D30] text-[11px] font-semibold text-white rounded w-full p-2"
                          >
                            <option value="Sans / Inter">
                              Sans-Serif (Default Inter)
                            </option>
                            <option value="Tahoma">
                              Tahoma (Classic Windows)
                            </option>
                            <option value="Cinzel">
                              Cinzel (Classic Serif)
                            </option>
                            <option value="Space Grotesk">
                              Space Grotesk (Tech)
                            </option>
                            <option value="Outfit">
                              Outfit (Round Display)
                            </option>
                            <option value="Playfair Display">
                              Playfair Display (Elegant)
                            </option>
                            <option value="JetBrains Mono">
                              JetBrains Mono (Technical)
                            </option>
                          </select>
                        </div>

                        {/* Transition selections */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">
                            Slide Transition:
                          </label>
                          <select
                            value={editingItem.slideTransition || "fade"}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                slideTransition: e.target.value,
                              })
                            }
                            className="bg-[#3E3E42] border border-[#2D2D30] text-[11px] font-semibold text-white rounded w-full p-2"
                          >
                            <option value="fade">Fade Out & In</option>
                            <option value="slide">Slide Up Scroll</option>
                            <option value="zoom">Zoom Pop Entry</option>
                            <option value="none">Immediate Cut</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-400 block uppercase">
                              Word Spacing
                            </label>
                            <select
                              value={editingItem.textSpacing || "normal"}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  textSpacing: e.target.value,
                                })
                              }
                              className="bg-[#3E3E42] border border-[#2D2D30] text-[10px] font-semibold text-white rounded w-full p-1.5"
                            >
                              <option value="snug">Padat</option>
                              <option value="normal">Normal</option>
                              <option value="relaxed">Relaxed</option>
                              <option value="loose">Loose</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-400 block uppercase">
                              Letter Spacing
                            </label>
                            <select
                              value={editingItem.textTracking || "normal"}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  textTracking: e.target.value,
                                })
                              }
                              className="bg-[#3E3E42] border border-[#2D2D30] text-[10px] font-semibold text-white rounded w-full p-1.5"
                            >
                              <option value="tighter">Rapat</option>
                              <option value="normal">Normal</option>
                              <option value="wide">Lebar</option>
                            </select>
                          </div>
                        </div>

                        {/* Background override inside Styles Tab */}
                        <div className="space-y-1 pt-2 border-t border-zinc-800">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">
                            Override Background (Opsional):
                          </label>
                          <input
                            type="text"
                            value={editingItem.backgroundOverride || ""}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                backgroundOverride: e.target.value,
                              })
                            }
                            placeholder="Contoh: #000000 atau URL Gambar"
                            className="bg-[#121213] border border-zinc-800 text-white rounded p-2 text-xs w-full focus:outline-none placeholder-zinc-600 font-mono"
                          />
                          <p className="text-[9px] text-zinc-500 leading-normal">
                            Kosongkan kolom ini agar presentasi menggunakan
                            latar belakang aktif utama. Anda bisa memasukkan hex
                            warna solid (contoh: #1a1a1a) atau URL gambar
                            eksternal.
                          </p>
                        </div>

                        {/* Background Adjustments configuration */}
                        <div className="space-y-3 pt-3 border-t border-zinc-800 text-left">
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                            Pengaturan Detil Gambar Latar Belakang
                          </span>

                          {/* Opacity slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase">
                              <span>Transparansi (Opacity)</span>
                              <span className="font-mono text-[10px] text-zinc-300">
                                {editingItem.bgOpacity !== undefined
                                  ? editingItem.bgOpacity
                                  : 80}
                                %
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={
                                editingItem.bgOpacity !== undefined
                                  ? editingItem.bgOpacity
                                  : 80
                              }
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  bgOpacity: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-[#121213] rounded appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>

                          {/* Brightness slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase">
                              <span>Kecerahan (Brightness)</span>
                              <span className="font-mono text-[10px] text-zinc-300">
                                {editingItem.bgBrightness !== undefined
                                  ? editingItem.bgBrightness
                                  : 75}
                                %
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="150"
                              value={
                                editingItem.bgBrightness !== undefined
                                  ? editingItem.bgBrightness
                                  : 75
                              }
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  bgBrightness: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-[#121213] rounded appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>

                          {/* Blur slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase">
                              <span>Efek Buram (Blur)</span>
                              <span className="font-mono text-[10px] text-zinc-300">
                                {editingItem.bgBlur !== undefined
                                  ? editingItem.bgBlur
                                  : 0}
                                px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="30"
                              value={
                                editingItem.bgBlur !== undefined
                                  ? editingItem.bgBlur
                                  : 0
                              }
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  bgBlur: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-[#121213] rounded appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>

                          {/* Scale Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 uppercase">
                              <span>Skala / Ukuran (Zoom)</span>
                              <span className="font-mono text-[10px] text-zinc-300">
                                {editingItem.bgScale !== undefined
                                  ? editingItem.bgScale
                                  : 100}
                                %
                              </span>
                            </div>
                            <input
                              type="range"
                              min="40"
                              max="200"
                              value={
                                editingItem.bgScale !== undefined
                                  ? editingItem.bgScale
                                  : 100
                              }
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  bgScale: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1 bg-[#121213] rounded appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>

                          {/* Scale Fit Select buttons */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-400 block uppercase">
                              Mode Skala (Scale Fit):
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              {(["cover", "contain", "fill"] as const).map(
                                (fit) => (
                                  <button
                                    key={fit}
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        bgFit: fit,
                                      })
                                    }
                                    className={`py-1 rounded text-[9px] font-black uppercase tracking-wide transition-colors border ${
                                      (editingItem.bgFit || "cover") === fit
                                        ? "bg-purple-950/60 text-purple-300 border-purple-500"
                                        : "bg-[#2D2D30] border-zinc-800 text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    {fit === "cover"
                                      ? "Isi Penuh"
                                      : fit === "contain"
                                        ? "Fit Tengah"
                                        : "Regangkan"}
                                  </button>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Tab masters configuration inside Left column
                      <div className="space-y-4">
                        <div className="bg-[#1e1e1f] p-4 rounded border border-zinc-800 space-y-4">
                          <div className="text-white font-bold text-[10px] uppercase tracking-widest border-b border-zinc-800 pb-1">
                            Master Themes Catalog
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-normal">
                            Klik tema master di bawah ini untuk menerapkan skema
                            gaya, font, warna, bayangan, posisi teks, dan
                            dekorasi latar belakang secara instan pada slide
                            lirik Anda.
                          </p>

                          <div className="grid grid-cols-1 gap-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {MASTER_THEMES.map((theme, tIdx) => {
                              const isSolid =
                                theme.background.startsWith("#") ||
                                theme.background === "transparent";
                              return (
                                <button
                                  key={tIdx}
                                  type="button"
                                  onClick={() => {
                                    setEditingItem({
                                      ...editingItem,
                                      backgroundOverride: theme.background,
                                      fontFamily: theme.fontFamily,
                                      textAlign: theme.textAlign,
                                      textPosition: theme.textPosition,
                                      textBold: theme.textBold,
                                      textItalic: theme.textItalic,
                                      textShadow: theme.textShadow,
                                      textOutline: theme.textOutline,
                                      textOutlineColor: theme.textOutlineColor,
                                      textColor: theme.textColor,
                                      bgOpacity: theme.bgOpacity,
                                      bgBrightness: theme.bgBrightness,
                                      bgBlur: theme.bgBlur,
                                      bgScale: theme.bgScale,
                                      bgFit: theme.bgFit,
                                      bgPositionX: theme.bgPositionX,
                                      bgPositionY: theme.bgPositionY,
                                    });
                                    showToast(
                                      `Master "${theme.name}" berhasil diterapkan!`,
                                      "success",
                                    );
                                  }}
                                  className="w-full text-left rounded bg-[#252526] border border-zinc-800/80 hover:border-purple-500/80 p-2.5 flex gap-2.5 transition-all hover:bg-zinc-800/30 relative overflow-hidden group cursor-pointer"
                                >
                                  {/* Thumbnail Preview Area */}
                                  <div
                                    className="w-14 h-9 rounded border border-zinc-700/60 shrink-0 relative overflow-hidden flex items-center justify-center bg-black"
                                    style={{
                                      background: isSolid
                                        ? theme.background
                                        : undefined,
                                    }}
                                  >
                                    {!isSolid && (
                                      <img
                                        src={theme.background}
                                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                                        referrerPolicy="no-referrer"
                                        alt=""
                                      />
                                    )}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-0.5 z-10">
                                      <span
                                        style={{
                                          fontFamily: theme.fontFamily,
                                          color: theme.textColor,
                                        }}
                                        className="text-[6px] font-black tracking-tighter uppercase scale-90"
                                      >
                                        MUSIC
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-white leading-normal truncate group-hover:text-purple-300 transition-colors">
                                      {theme.name}
                                    </p>
                                    <p className="text-[9px] text-zinc-500 leading-tight line-clamp-2">
                                      {theme.desc}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Informative master control settings reminder */}
                        <div className="p-3 bg-purple-950/20 rounded border border-purple-900/30 text-[10px] text-zinc-400 space-y-1.5 leading-normal">
                          <p className="font-bold text-purple-400 uppercase tracking-wider text-[8px]">
                            💡 EW7 Pro Tips:
                          </p>
                          <p>
                            Tema Master bertindak sebagai cetak biru visual
                            utama. Setelah menerapkan Tema Master, Anda dapat
                            menyempurnakan bagian teks, warna, transparansi,
                            ukuran gambar latar di tab{" "}
                            <span className="text-zinc-200">Styles</span> secara
                            individual.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drag Handle for the resizable text column */}
                <div
                  className="w-1.5 cursor-col-resize hover:bg-purple-500 bg-[#151516] active:bg-purple-600 transition-all h-full select-none flex-shrink-0 relative z-40 group flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const container = document.getElementById(
                        "editor-workspace-container",
                      );
                      if (container) {
                        const rect = container.getBoundingClientRect();
                        const relativeX = moveEvent.clientX - rect.left;
                        let percentage = (relativeX / rect.width) * 100;
                        // Constraint between 15% and 65%
                        if (percentage < 15) percentage = 15;
                        if (percentage > 65) percentage = 65;
                        setEditorSidebarWidth(percentage);
                      }
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener(
                        "mousemove",
                        handleMouseMove,
                      );
                      document.removeEventListener("mouseup", handleMouseUp);
                    };
                    document.addEventListener("mousemove", handleMouseMove);
                    document.addEventListener("mouseup", handleMouseUp);
                  }}
                >
                  <div className="w-[2px] h-8 bg-zinc-700 group-hover:bg-purple-400 rounded transition-colors" />
                </div>

                {/* B. MIDDLE SPLIT: ACTIVE SPECIAL MENUS PANEL (Preserves Slide Visibility) */}
                <AnimatePresence mode="wait">
                  {editorActiveMenu && (
                    <motion.div
                      key={editorActiveMenu}
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "31%", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="w-[31%] border-r border-[#151516] flex flex-col overflow-hidden bg-[#1E1E1F] select-none text-zinc-350 shrink-0 border-l border-[#151516]"
                    >
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 flex flex-col h-full bg-[#18181A]">
                        {/* Title bar with Close toggle button */}
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                          <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            {editorActiveMenu === "shape" && "🎨 Shape Frame"}
                            {editorActiveMenu === "gambar_bg" &&
                              "🖼️ Background Image"}
                            {editorActiveMenu === "video_bg" &&
                              "🎬 Background Video"}
                            {editorActiveMenu === "arrange" && "🔄 Susun Slide"}
                            {editorActiveMenu === "logo_overlay" &&
                              "🛡️ Logo Overlay"}
                            {editorActiveMenu === "scripture" &&
                              "📖 Sisipkan Alkitab"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditorActiveMenu(null)}
                            className="px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded text-[8.5px] uppercase font-black border border-zinc-750 transition-all cursor-pointer"
                          >
                            ✕ Tutup
                          </button>
                        </div>
                        {editorActiveMenu === "shape" && (
                          <div className="flex flex-col gap-2.5 text-left text-[10.5px]">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                              Pilih Bingkai Slide Dekoratif
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "none", label: "Klasik" },
                                { id: "bottom-bar", label: "Lower Third" },
                                { id: "left-accent", label: "Left Accent" },
                                { id: "brackets", label: "Deluxe Brackets" },
                                { id: "thin-frame", label: "Classic Inset" },
                                { id: "glow-rect", label: "Glow Backdrop" },
                              ].map((shape) => {
                                const isSelected =
                                  (editingItem.shapeDecoration || "none") ===
                                  shape.id;
                                return (
                                  <button
                                    key={shape.id}
                                    type="button"
                                    onClick={() => {
                                      setEditingItem({
                                        ...editingItem,
                                        shapeDecoration: shape.id,
                                      });
                                    }}
                                    className={`p-2 px-3 rounded border text-center h-11 flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-cyan-950 border-cyan-500 text-cyan-200 text-[10px] font-black"
                                        : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 text-[9.5px] font-bold"
                                    }`}
                                  >
                                    {shape.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* C. GAMBAR BACKGROUNDS PANEL */}
                        {editorActiveMenu === "gambar_bg" && (
                          <div className="flex flex-col gap-3 text-left">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                              Pustaka Gambar & Warna Latar
                            </span>

                            {/* Selection Grid (Optimized thin rows) */}
                            <div className="grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                              {[
                                { name: "Tanpa", url: "", type: "color" },
                                {
                                  name: "Solid Hitam",
                                  url: "#000000",
                                  type: "color",
                                },
                                {
                                  name: "Cerah",
                                  url: "#F5F5F0",
                                  type: "color",
                                },
                                {
                                  name: "Purple Gradient",
                                  url: "linear-gradient(135deg, #1A0D32 0%, #05020C 100%)",
                                  type: "color",
                                },
                                ...BACKGROUNDS.map((bg, bIdx) => ({
                                  name: `BG ${bIdx + 1}`,
                                  url: bg,
                                  type: "image",
                                })),
                                ...customBackgrounds.map((bg, cbIdx) => ({
                                  name: `Kustom ${cbIdx + 1}`,
                                  url: bg,
                                  type: "image",
                                })),
                              ].map((media, mIdx) => {
                                const isSelected =
                                  editingItem.backgroundOverride === media.url;
                                return (
                                  <button
                                    key={mIdx}
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        backgroundOverride: media.url,
                                      })
                                    }
                                    className={`rounded border text-center overflow-hidden h-14 flex flex-col justify-end p-1.5 relative transition-all cursor-pointer ${
                                      isSelected
                                        ? "border-purple-500 ring-1 ring-purple-600/50 shadow-md font-black bg-purple-950/30"
                                        : "border-zinc-800 hover:border-zinc-500 bg-[#161618]"
                                    }`}
                                    style={{
                                      background:
                                        media.type === "color" && media.url
                                          ? media.url
                                          : undefined,
                                    }}
                                  >
                                    {media.type === "image" && (
                                      <img
                                        src={resolveMedia(media.url)}
                                        className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                                        referrerPolicy="no-referrer"
                                        alt=""
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
                                    <span className="text-[8px] font-black text-white line-clamp-1 relative z-10 leading-none">
                                      {media.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Control block */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-805 text-[10px]">
                              <div className="space-y-1">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase block">
                                  Tautan Gambar:
                                </span>
                                <input
                                  type="text"
                                  value={editingItem.backgroundOverride || ""}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      backgroundOverride: e.target.value,
                                    })
                                  }
                                  placeholder="Masukkan URL Gambar..."
                                  className="w-full bg-[#1e1e1f] border border-zinc-700 rounded px-2.5 py-1.5 text-[10.5px] text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    bgFileInputRef.current?.click()
                                  }
                                  className="flex-1 py-1.5 bg-purple-900/35 hover:bg-purple-900/50 border border-purple-750 rounded text-[9px] font-black uppercase text-purple-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Unggah Gambar</span>
                                </button>
                                {editingItem.backgroundOverride && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        backgroundOverride: "",
                                      })
                                    }
                                    className="px-2.5 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/60 rounded text-[9px] font-extrabold text-red-500 uppercase transition cursor-pointer shrink-0"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <div className="space-y-1 mt-1">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase block">
                                  Gaya Tampilan Background:
                                </span>
                                <div className="grid grid-cols-3 gap-1">
                                  {(["cover", "contain", "fill"] as const).map(
                                    (fit) => (
                                      <button
                                        key={fit}
                                        type="button"
                                        onClick={() =>
                                          setEditingItem({
                                            ...editingItem,
                                            bgFit: fit,
                                          })
                                        }
                                        className={`py-1.5 rounded text-[8.5px] font-black uppercase transition-colors border ${
                                          (editingItem.bgFit || "cover") === fit
                                            ? "bg-purple-950 text-purple-300 border-purple-550 font-black"
                                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                                        }`}
                                      >
                                        {fit === "cover"
                                          ? "Solid"
                                          : fit === "contain"
                                            ? "Fit"
                                            : "Stretch"}
                                      </button>
                                    ),
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      bgScale: 100,
                                      bgPositionX: 0,
                                      bgPositionY: 0,
                                      bgFit: "cover",
                                    })
                                  }
                                  className="w-full mt-2.5 py-2 bg-[#202022] hover:bg-[#2F2F32] border border-zinc-700/60 text-[9px] font-black uppercase text-zinc-300 hover:text-white rounded transition cursor-pointer"
                                >
                                  Reset Posisi & Zoom Foto
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* C2. VIDEO BACKGROUNDS PANEL */}
                        {editorActiveMenu === "video_bg" && (
                          <div className="flex flex-col gap-3 text-left">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block font-sans">
                              Koleksi Video Latar MP4
                            </span>

                            <div className="grid grid-cols-3 gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                              {customVideoBackgrounds.length === 0 ? (
                                <div className="col-span-full py-4 text-center text-zinc-500 text-[10px] bg-[#111112] rounded border border-dashed border-zinc-800">
                                  Belum ada kustom video. Unggah MP4 di bawah.
                                </div>
                              ) : (
                                customVideoBackgrounds.map((bg, cvbIdx) => {
                                  const isSelected =
                                    editingItem.backgroundOverride === bg;
                                  return (
                                    <button
                                      key={cvbIdx}
                                      type="button"
                                      onClick={() =>
                                        setEditingItem({
                                          ...editingItem,
                                          backgroundOverride: bg,
                                        })
                                      }
                                      className={`rounded border text-center overflow-hidden h-14 flex flex-col justify-end p-1.5 relative transition-all bg-black cursor-pointer ${
                                        isSelected
                                          ? "border-indigo-500 ring-1 ring-indigo-505 shadow-md bg-indigo-950/30"
                                          : "border-zinc-800 hover:border-zinc-500"
                                      }`}
                                    >
                                      <div className="absolute inset-0 flex items-center justify-center opacity-60 pointer-events-none z-10">
                                        <Video className="w-5 h-5 text-indigo-400" />
                                      </div>
                                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-[1]" />
                                      <span className="text-[8px] font-black text-white line-clamp-1 relative z-10 leading-none">
                                        Video {cvbIdx + 1}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>

                            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800 text-[10px]">
                              <div className="space-y-1">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase block">
                                  Tautan Video MP4:
                                </span>
                                <input
                                  type="text"
                                  value={editingItem.backgroundOverride || ""}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      backgroundOverride: e.target.value,
                                    })
                                  }
                                  placeholder="https://example.com/slide-bg.mp4"
                                  className="w-full bg-[#1e1e1f] border border-zinc-700 rounded px-2 text-[10px] py-1.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    bgFileInputRef.current?.click()
                                  }
                                  className="flex-1 py-1.5 bg-indigo-900/35 hover:bg-indigo-900/50 border border-indigo-750 rounded text-[9px] font-black uppercase text-indigo-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Unggah MP4</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      ...editingItem,
                                      bgScale: 100,
                                      bgPositionX: 0,
                                      bgPositionY: 0,
                                      bgFit: "cover",
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-[#1E1E20] hover:bg-zinc-800 border border-zinc-700 text-[8px] font-black uppercase text-zinc-350 hover:text-white rounded transition cursor-pointer shrink-0"
                                >
                                  Reset
                                </button>
                                {editingItem.backgroundOverride && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        backgroundOverride: "",
                                      })
                                    }
                                    className="px-2.5 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/60 rounded text-[9px] font-extrabold text-red-500 uppercase transition cursor-pointer shrink-0"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* D. ARRANGE PANEL */}
                        {editorActiveMenu === "arrange" && (
                          <div className="flex flex-col gap-2 text-left">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block font-sans mb-1">
                              Struktur Navigasi Slide
                            </span>
                            <div className="flex flex-col gap-2 text-[10.5px]">
                              {/* Move Up */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (editorPreviewIdx <= 0) return;
                                  const newVerses = [...editingItem.verses];
                                  const vTemp = newVerses[editorPreviewIdx];
                                  newVerses[editorPreviewIdx] =
                                    newVerses[editorPreviewIdx - 1];
                                  newVerses[editorPreviewIdx - 1] = vTemp;

                                  const isBible =
                                    editingItem.id?.startsWith("bible-") ||
                                    editingItem.type === "bible";
                                  const originalLabels = editingItem.verseLabels
                                    ? [...editingItem.verseLabels]
                                    : editingItem.verses.map((_, idx) =>
                                        isBible
                                          ? `Ayat ${idx + 1}`
                                          : `Verse ${idx + 1}`,
                                      );
                                  const tempLabels = [...originalLabels];
                                  const lTemp = tempLabels[editorPreviewIdx];
                                  tempLabels[editorPreviewIdx] =
                                    tempLabels[editorPreviewIdx - 1];
                                  tempLabels[editorPreviewIdx - 1] = lTemp;

                                  const newLabels = regenerateSlideLabels(
                                    newVerses,
                                    tempLabels,
                                    isBible,
                                  );
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                    verseLabels: newLabels,
                                  };

                                  setEditingItem(updatedItem);
                                  setEditorPreviewIdx(editorPreviewIdx - 1);

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                disabled={editorPreviewIdx <= 0}
                                className="w-full py-2 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white disabled:opacity-30 border border-zinc-750 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                ↑ Naikkan Slide
                              </button>

                              {/* Move Down */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    editorPreviewIdx >=
                                    editingItem.verses.length - 1
                                  )
                                    return;
                                  const newVerses = [...editingItem.verses];
                                  const vTemp = newVerses[editorPreviewIdx];
                                  newVerses[editorPreviewIdx] =
                                    newVerses[editorPreviewIdx + 1];
                                  newVerses[editorPreviewIdx + 1] = vTemp;

                                  const isBible =
                                    editingItem.id?.startsWith("bible-") ||
                                    editingItem.type === "bible";
                                  const originalLabels = editingItem.verseLabels
                                    ? [...editingItem.verseLabels]
                                    : editingItem.verses.map((_, idx) =>
                                        isBible
                                          ? `Ayat ${idx + 1}`
                                          : `Verse ${idx + 1}`,
                                      );
                                  const tempLabels = [...originalLabels];
                                  const lTemp = tempLabels[editorPreviewIdx];
                                  tempLabels[editorPreviewIdx] =
                                    tempLabels[editorPreviewIdx + 1];
                                  tempLabels[editorPreviewIdx + 1] = lTemp;

                                  const newLabels = regenerateSlideLabels(
                                    newVerses,
                                    tempLabels,
                                    isBible,
                                  );
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                    verseLabels: newLabels,
                                  };

                                  setEditingItem(updatedItem);
                                  setEditorPreviewIdx(editorPreviewIdx + 1);

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                disabled={
                                  editorPreviewIdx >=
                                  editingItem.verses.length - 1
                                }
                                className="w-full py-2 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white disabled:opacity-30 border border-zinc-750 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                ↓ Turunkan Slide
                              </button>

                              <div className="h-px bg-zinc-850 my-1"></div>

                              {/* Duplicate Slide */}
                              <button
                                type="button"
                                onClick={() => {
                                  const newVerses = [...editingItem.verses];
                                  const isBible =
                                    editingItem.id?.startsWith("bible-") ||
                                    editingItem.type === "bible";
                                  const originalLabels = editingItem.verseLabels
                                    ? [...editingItem.verseLabels]
                                    : editingItem.verses.map((_, idx) =>
                                        isBible
                                          ? `Ayat ${idx + 1}`
                                          : `Verse ${idx + 1}`,
                                      );
                                  const originalLabel =
                                    originalLabels[editorPreviewIdx] || "";

                                  newVerses.splice(
                                    editorPreviewIdx + 1,
                                    0,
                                    newVerses[editorPreviewIdx],
                                  );
                                  const tempLabels = [...originalLabels];
                                  tempLabels.splice(
                                    editorPreviewIdx + 1,
                                    0,
                                    originalLabel,
                                  );

                                  const newLabels = regenerateSlideLabels(
                                    newVerses,
                                    tempLabels,
                                    isBible,
                                  );
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                    verseLabels: newLabels,
                                  };

                                  setEditingItem(updatedItem);
                                  setEditorPreviewIdx(editorPreviewIdx + 1);

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                className="w-full py-2 bg-[#2D2D30] hover:bg-[#3E3E42] text-zinc-300 hover:text-white border border-zinc-750 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                Duplikasi Slide
                              </button>

                              {/* Add Slide */}
                              <button
                                type="button"
                                onClick={() => {
                                  const newVerses = [...editingItem.verses];
                                  const isBible =
                                    editingItem.id?.startsWith("bible-") ||
                                    editingItem.type === "bible";
                                  const originalLabels = editingItem.verseLabels
                                    ? [...editingItem.verseLabels]
                                    : editingItem.verses.map((_, idx) =>
                                        isBible
                                          ? `Ayat ${idx + 1}`
                                          : `Verse ${idx + 1}`,
                                      );

                                  newVerses.splice(
                                    editorPreviewIdx + 1,
                                    0,
                                    "Teks lirik baru",
                                  );
                                  const tempLabels = [...originalLabels];
                                  tempLabels.splice(
                                    editorPreviewIdx + 1,
                                    0,
                                    isBible ? "Ayat Baru" : "Verse Baru",
                                  );

                                  const newLabels = regenerateSlideLabels(
                                    newVerses,
                                    tempLabels,
                                    isBible,
                                  );
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                    verseLabels: newLabels,
                                  };

                                  setEditingItem(updatedItem);
                                  setEditorPreviewIdx(editorPreviewIdx + 1);

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                className="w-full py-2 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Tambah Baru
                              </button>

                              <div className="h-px bg-zinc-850 my-1"></div>

                              {/* Clear Current */}
                              <button
                                type="button"
                                onClick={() => {
                                  const newVerses = [...editingItem.verses];
                                  newVerses[editorPreviewIdx] = "";
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                  };
                                  setEditingItem(updatedItem);

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                className="w-full py-2 bg-[#2D2D30] hover:bg-[#3E3E42] text-yellow-500 border border-zinc-750 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                Hapus Teks Slide
                              </button>

                              {/* Delete Slide */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingItem.verses.length <= 1) return;
                                  const newVerses = [...editingItem.verses];
                                  newVerses.splice(editorPreviewIdx, 1);

                                  const isBible =
                                    editingItem.id?.startsWith("bible-") ||
                                    editingItem.type === "bible";
                                  const originalLabels = editingItem.verseLabels
                                    ? [...editingItem.verseLabels]
                                    : editingItem.verses.map((_, idx) =>
                                        isBible
                                          ? `Ayat ${idx + 1}`
                                          : `Verse ${idx + 1}`,
                                      );
                                  const tempLabels = [...originalLabels];
                                  if (tempLabels.length > editorPreviewIdx) {
                                    tempLabels.splice(editorPreviewIdx, 1);
                                  }

                                  const newLabels = regenerateSlideLabels(
                                    newVerses,
                                    tempLabels,
                                    isBible,
                                  );
                                  const updatedItem = {
                                    ...editingItem,
                                    verses: newVerses,
                                    verseLabels: newLabels,
                                  };

                                  setEditingItem(updatedItem);
                                  setEditorPreviewIdx(
                                    Math.max(0, editorPreviewIdx - 1),
                                  );

                                  if (
                                    selectedSong &&
                                    selectedSong.id === updatedItem.id
                                  ) {
                                    setSelectedSong(updatedItem as any);
                                  }
                                  const newSched = schedule.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s,
                                  );
                                  setSchedule(newSched);
                                  localStorage.setItem(
                                    "cp_last_schedule",
                                    JSON.stringify(newSched),
                                  );
                                }}
                                disabled={editingItem.verses.length <= 1}
                                className="w-full py-2 bg-red-950/45 hover:bg-red-900/60 text-red-400 disabled:opacity-30 border border-red-900/40 rounded font-semibold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                Hapus Slide
                              </button>
                            </div>
                          </div>
                        )}

                        {/* E. LOGO OVERLAY PANEL */}
                        {editorActiveMenu === "logo_overlay" && (
                          <div className="flex flex-col gap-3 text-left">
                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block font-sans">
                              Slide Logo Overlay Settings
                            </span>

                            {/* Slot Toggle Selector */}
                            <div className="flex bg-black/35 rounded-lg p-0.5 border border-zinc-800 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditorLogoSlot("left")}
                                className={`flex-1 py-1.5 rounded text-[9px] font-black transition uppercase ${
                                  editorLogoSlot === "left"
                                    ? "bg-purple-650 text-white font-black shadow"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                ← Kiri Atas
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditorLogoSlot("right")}
                                className={`flex-1 py-1.5 rounded text-[9px] font-black transition uppercase ${
                                  editorLogoSlot === "right"
                                    ? "bg-purple-650 text-white font-black shadow"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                Kanan Atas →
                              </button>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase">
                                Logo Saat Ini:
                              </span>
                              <div className="flex gap-1.5">
                                {editingItem.logoLeftUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        logoLeftUrl: undefined,
                                      })
                                    }
                                    className="text-[8.5px] font-black text-red-500 hover:text-red-400 transition-colors uppercase cursor-pointer bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/40"
                                  >
                                    Cari Kiri
                                  </button>
                                )}
                                {editingItem.logoRightUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingItem({
                                        ...editingItem,
                                        logoRightUrl: undefined,
                                      })
                                    }
                                    className="text-[8.5px] font-black text-red-500 hover:text-red-400 transition-colors uppercase cursor-pointer bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/40"
                                  >
                                    Cari Kanan
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1 mt-1">
                              <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                                Pilih Gambar Media untuk Logo:
                              </span>
                              {/* Scrollable list of media images */}
                              <div className="grid grid-cols-4 gap-2 max-h-[190px] overflow-y-auto pr-1">
                                {[...BACKGROUNDS, ...customBackgrounds].map(
                                  (bg, idx) => {
                                    const isColor =
                                      bg.startsWith("#") ||
                                      bg.startsWith("rgb") ||
                                      bg.startsWith("linear-gradient") ||
                                      bg === "transparent";
                                    if (isColor) return null; // Only use images as logos

                                    const isLeft =
                                      editingItem.logoLeftUrl === bg;
                                    const isRight =
                                      editingItem.logoRightUrl === bg;
                                    const isSelected =
                                      (editorLogoSlot === "left" && isLeft) ||
                                      (editorLogoSlot === "right" && isRight);

                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          if (editorLogoSlot === "left") {
                                            setEditingItem({
                                              ...editingItem,
                                              logoLeftUrl: bg,
                                            });
                                          } else {
                                            setEditingItem({
                                              ...editingItem,
                                              logoRightUrl: bg,
                                            });
                                          }
                                        }}
                                        className={`relative aspect-square rounded overflow-hidden border transition-all hover:scale-105 h-11 w-11 mx-auto ${
                                          isSelected
                                            ? "border-purple-500 ring-1 ring-purple-500/45 bg-purple-950"
                                            : "border-zinc-800 opacity-70 hover:opacity-100"
                                        }`}
                                      >
                                        <img
                                          src={resolveMedia(bg)}
                                          alt={`Media ${idx}`}
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                        {isLeft && (
                                          <div className="absolute top-0.5 left-0.5 bg-blue-600 text-white text-[7px] px-0.5 rounded-sm font-black uppercase text-center leading-none py-0.5">
                                            L
                                          </div>
                                        )}
                                        {isRight && (
                                          <div className="absolute bottom-0.5 right-0.5 bg-purple-600 text-white text-[7px] px-0.5 rounded-sm font-black uppercase text-center leading-none py-0.5">
                                            R
                                          </div>
                                        )}
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* F. SCRIPTURE SELECT PANEL */}
                        {editorActiveMenu === "scripture" && (
                          <div className="flex flex-col gap-3 text-left">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block font-sans">
                              Pilih Kitab & Cari Ayat
                            </span>

                            {/* Version Select */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-sans">
                                Versi Alkitab
                              </label>
                              <select
                                value={editorScripVersion}
                                onChange={(e) => {
                                  setEditorScripVersion(e.target.value);
                                  fetchEditorScripturePreview(
                                    editorScripBook,
                                    editorScripChapter,
                                    e.target.value,
                                  );
                                }}
                                className="w-full text-xs bg-[#111112] border border-[#2A2A2E] text-zinc-200 rounded p-1.5 focus:outline-none"
                              >
                                <option value="tb">
                                  Alkitab Terjemahan Baru (TB)
                                </option>
                                <option value="toba">
                                  Alkitab Batak Toba (Batak)
                                </option>
                                <option value="gntd">
                                  Good News Translation (GNTD)
                                </option>
                                {customBibles.map((cb) => (
                                  <option key={cb.id} value={cb.id}>
                                    {cb.name} (Custom)
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Book Selection */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-sans">
                                  Kitab
                                </label>
                                <select
                                  value={editorScripBook}
                                  onChange={(e) => {
                                    setEditorScripBook(e.target.value);
                                    fetchEditorScripturePreview(
                                      e.target.value,
                                      editorScripChapter,
                                      editorScripVersion,
                                    );
                                  }}
                                  className="w-full text-xs bg-[#111112] border border-[#2A2A2E] text-zinc-200 rounded p-1.5 focus:outline-none h-8"
                                >
                                  {getEditorAvailableBooks().map((bookName) => (
                                    <option key={bookName} value={bookName}>
                                      {bookName}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-sans">
                                  Pasal
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editorScripChapter}
                                  onChange={(e) => {
                                    const val = Math.max(
                                      1,
                                      parseInt(e.target.value) || 1,
                                    );
                                    setEditorScripChapter(val);
                                    fetchEditorScripturePreview(
                                      editorScripBook,
                                      val,
                                      editorScripVersion,
                                    );
                                  }}
                                  className="w-full text-xs bg-[#111112] border border-[#2A2A2E] text-zinc-200 rounded p-1.5 focus:outline-none h-8 text-center"
                                />
                              </div>
                            </div>

                            {/* Loading state or verses preview */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-sans">
                                Pratinjau Ayat di Pasal {editorScripChapter}
                              </label>

                              {editorIsFetchingScrip ? (
                                <div className="p-4 bg-black/25 text-center text-zinc-500 text-xs rounded border border-zinc-800 animate-pulse font-bold">
                                  Menghubungkan & Memuat Alkitab...
                                </div>
                              ) : editorScripError ? (
                                <div className="p-3 bg-red-950/20 text-red-400 text-[10px] rounded border border-red-900/40 text-center font-bold">
                                  {editorScripError}
                                </div>
                              ) : editorScripPreviewList.length === 0 ? (
                                <div className="p-4 bg-black/25 text-center text-zinc-500 text-xs rounded border border-zinc-800 font-bold">
                                  Tidak ada ayat yang termuat. Silakan pilih
                                  Kitab lain.
                                </div>
                              ) : (
                                <div className="border border-[#2A2A2E] rounded bg-black/25 max-h-[160px] overflow-y-auto custom-scrollbar p-1 text-left space-y-1">
                                  {editorScripPreviewList.map((v) => {
                                    const isSelected =
                                      v.vNum >= editorScripStartVerse &&
                                      v.vNum <= editorScripEndVerse;
                                    return (
                                      <button
                                        key={v.vNum}
                                        type="button"
                                        onClick={() => {
                                          if (
                                            editorScripStartVerse === v.vNum &&
                                            editorScripEndVerse === v.vNum
                                          ) {
                                            setEditorScripStartVerse(0);
                                            setEditorScripEndVerse(0);
                                          } else if (
                                            editorScripStartVerse === 0 ||
                                            v.vNum < editorScripStartVerse
                                          ) {
                                            setEditorScripStartVerse(v.vNum);
                                            setEditorScripEndVerse(v.vNum);
                                          } else {
                                            setEditorScripEndVerse(v.vNum);
                                          }
                                        }}
                                        className={`w-full text-left p-1.5 rounded text-[10px] leading-tight transition-colors flex gap-1.5 items-start cursor-pointer ${
                                          isSelected
                                            ? "bg-emerald-950/45 text-emerald-300 border-l-2 border-emerald-500 font-black"
                                            : "hover:bg-zinc-800 text-zinc-400 font-bold"
                                        }`}
                                      >
                                        <span className="font-extrabold text-[9px] text-zinc-500">
                                          {v.vNum}
                                        </span>
                                        <span className="flex-1 text-left">
                                          {v.content}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Range Selection Details */}
                            {editorScripPreviewList.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 p-2 bg-[#141416]/40 rounded border border-[#2A2A2E]/60 text-[10px]">
                                <div>
                                  <span className="text-[8.5px] text-zinc-500 uppercase font-bold tracking-wider block mb-1 font-sans">
                                    Mulai Ayat
                                  </span>
                                  <select
                                    value={editorScripStartVerse}
                                    onChange={(e) =>
                                      setEditorScripStartVerse(
                                        parseInt(e.target.value) || 1,
                                      )
                                    }
                                    className="w-full text-[10.5px] bg-[#111112] border border-[#2A2A2E] rounded p-1 text-zinc-200"
                                  >
                                    <option value={0}>- Pilih -</option>
                                    {editorScripPreviewList.map((v) => (
                                      <option key={v.vNum} value={v.vNum}>
                                        Ayat {v.vNum}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <span className="text-[8.5px] text-zinc-500 uppercase font-bold tracking-wider block mb-1 font-sans">
                                    Sampai Ayat
                                  </span>
                                  <select
                                    value={editorScripEndVerse}
                                    onChange={(e) =>
                                      setEditorScripEndVerse(
                                        parseInt(e.target.value) || 1,
                                      )
                                    }
                                    className="w-full text-[10.5px] bg-[#111112] border border-[#2A2A2E] rounded p-1 text-zinc-200"
                                  >
                                    <option value={0}>- Pilih -</option>
                                    {editorScripPreviewList.map((v) => (
                                      <option
                                        key={v.vNum}
                                        value={v.vNum}
                                        disabled={
                                          v.vNum < editorScripStartVerse
                                        }
                                      >
                                        Ayat {v.vNum}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {/* Actions Buttons for inserting into Editor */}
                            <div className="grid grid-cols-2 gap-2 pt-1 font-black">
                              <button
                                type="button"
                                disabled={
                                  editorScripStartVerse <= 0 ||
                                  editorScripEndVerse <= 0
                                }
                                onClick={() => insertScriptureToEditor(true)}
                                className="py-2 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800/60 rounded text-[9px] uppercase tracking-wider transition disabled:opacity-40 cursor-pointer"
                                title="Sisipkan setiap ayat yang dipilih sebagai slide baru yang berbeda"
                              >
                                Per Ayat (Slide Terpisah)
                              </button>

                              <button
                                type="button"
                                disabled={
                                  editorScripStartVerse <= 0 ||
                                  editorScripEndVerse <= 0
                                }
                                onClick={() => insertScriptureToEditor(false)}
                                className="py-2 bg-[#10b981] text-white hover:bg-emerald-600 rounded text-[9px] uppercase tracking-wider transition disabled:opacity-40 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                                title="Sisipkan semua ayat yang dipilih tergabung dalam satu slide"
                              >
                                Gabung Satu Slide
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* B. RIGHT PREVIEW MONITOR AREA: DETAILED HIGH-CONTRAST PREVIEW CANVAS */}
                <div className="flex-1 bg-[#1E1E1F] flex flex-col items-center justify-between p-4 overflow-hidden relative">
                  {/* Subtle vector grid lines background */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none z-0">
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage:
                          "radial-gradient(ellipse at center, #ffffff 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                      }}
                    ></div>
                  </div>

                  {/* Real-time scaling container based on Zoom Value */}
                  <div className="flex-1 w-full flex items-center justify-center relative select-none z-10 overflow-hidden">
                    <div
                      className="transition-all duration-200"
                      style={{ width: `${editorZoom}%` }}
                    >
                      {(() => {
                        const bg =
                          editingItem.backgroundOverride !== undefined &&
                          editingItem.backgroundOverride !== ""
                            ? editingItem.backgroundOverride
                            : activeBackground;
                        const isLight = isLightBg(bg);

                        const baseTextColor =
                          editingItem.textColor || "#ffffff";
                        const textColor =
                          isLight &&
                          (baseTextColor.toLowerCase() === "#ffffff" ||
                            baseTextColor.toLowerCase() === "white")
                            ? "#111827"
                            : baseTextColor;

                        const fontSizeMode = editingItem.fontSizeMode || "auto";
                        const fontSize = editingItem.fontSize || 60;
                        const textAlign = editingItem.textAlign || "center";
                        const textPosition =
                          editingItem.textPosition || "center";
                        const textBold = editingItem.textBold !== false;
                        const textItalic = editingItem.textItalic || false;
                        const textShadow = editingItem.textShadow !== false;

                        const alignClass =
                          textAlign === "left"
                            ? "text-left items-start justify-start"
                            : textAlign === "right"
                              ? "text-right items-end justify-end"
                              : "text-center items-center justify-center";
                        const posClass =
                          textPosition === "top"
                            ? "items-start pt-8"
                            : textPosition === "bottom"
                              ? "items-end pb-8"
                              : "items-center justify-center";
                        const weightClass = textBold
                          ? "font-bold"
                          : "font-normal";
                        const italicClass = textItalic
                          ? "italic"
                          : "not-italic";

                        const textOutline = editingItem.textOutline || false;
                        const textOutlineColor =
                          editingItem.textOutlineColor || "#000000";

                        const shadowValue = (() => {
                          const list = [];
                          if (textShadow) {
                            if (isLight) {
                              list.push(
                                "0 1px 3px rgba(0,0,0,0.15)",
                                "0 1px 2px rgba(0,0,0,0.1)",
                              );
                            } else {
                              list.push(
                                "0 4px 16px rgba(0,0,0,0.95)",
                                "0 2px 4px rgba(0,0,0,0.95)",
                              );
                            }
                          }
                          if (textOutline) {
                            list.push(
                              `0.5px 0.5px 0px ${textOutlineColor}`,
                              `-0.5px -0.5px 0px ${textOutlineColor}`,
                              `0.5px -0.5px 0px ${textOutlineColor}`,
                              `-0.5px 0.5px 0px ${textOutlineColor}`,
                              `0px 0.5px 0px ${textOutlineColor}`,
                              `0px -0.5px 0px ${textOutlineColor}`,
                              `0.5px 0px 0px ${textOutlineColor}`,
                              `-0.5px 0px 0px ${textOutlineColor}`,
                            );
                          }
                          return list.length > 0 ? list.join(", ") : undefined;
                        })();

                        // Fonts Mapping
                        const fontMapping: { [key: string]: string } = {
                          Cinzel: "font-cinzel",
                          "Space Grotesk": "font-space",
                          Outfit: "font-outfit",
                          "Playfair Display": "font-playfair",
                          "JetBrains Mono": "font-mono",
                          "Sans / Inter": "font-sans",
                          Tahoma: "font-sans",
                        };
                        const activeFontFamily =
                          globalFontFamily !== "Default"
                            ? globalFontFamily
                            : editingItem.fontFamily || "Sans / Inter";
                        const fontClass =
                          fontMapping[activeFontFamily] || "font-sans";

                        // Trackings Mapping
                        const trackingMapping = {
                          tighter: "tracking-tighter",
                          tight: "tracking-tight",
                          normal: "tracking-normal",
                          wide: "tracking-wide",
                          widest: "tracking-widest",
                        };
                        const trackingClass =
                          trackingMapping[
                            editingItem.textTracking || "normal"
                          ] || "tracking-normal";

                        // Spacing Mapping
                        const spacingMapping = {
                          relaxed: "leading-relaxed",
                          snug: "leading-snug",
                          normal: "leading-normal",
                          loose: "leading-loose",
                        };
                        const spacingClass =
                          spacingMapping[editingItem.textSpacing || "normal"] ||
                          "leading-normal";

                        const activeTextTransform =
                          globalTextTransform !== "Default"
                            ? globalTextTransform
                            : editingItem.textTransform || "uppercase";
                        const transformClass =
                          activeTextTransform === "none"
                            ? "normal-case"
                            : activeTextTransform === "lower-case"
                              ? "lowercase"
                              : activeTextTransform === "capitalize"
                                ? "capitalize"
                                : "uppercase";

                        const scaleMultiplier = globalFontSizeScale / 100;

                        const textContent =
                          editingItem.verses[editorPreviewIdx] ||
                          editingItem.verses[0] ||
                          "CONTENT";
                        const charCount = textContent.length;
                        const lineCount = textContent.split("\n").length;

                        let baseAutoCqw = 5.6; // Default starting auto cqw size (which scales nicely)

                        if (editingItem.type === "lyrics") {
                          if (charCount > 300 || lineCount > 7) {
                            baseAutoCqw = 2.4;
                          } else if (charCount > 180 || lineCount > 5) {
                            baseAutoCqw = 3.2;
                          } else if (charCount > 100 || lineCount > 4) {
                            baseAutoCqw = 3.9;
                          } else if (charCount > 50 || lineCount > 3) {
                            baseAutoCqw = 4.6;
                          }
                        } else if (editingItem.type === "scripture") {
                          if (charCount > 305 || lineCount > 7) {
                            baseAutoCqw = 2.2;
                          } else if (charCount > 180 || lineCount > 5) {
                            baseAutoCqw = 3.0;
                          } else if (charCount > 100 || lineCount > 4) {
                            baseAutoCqw = 3.8;
                          } else if (charCount > 50 || lineCount > 3) {
                            baseAutoCqw = 4.5;
                          }
                        } else if (editingItem.type === "announcement") {
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
                          textShadow: shadowValue,
                          fontFamily:
                            activeFontFamily === "Tahoma"
                              ? "Tahoma, Arial, sans-serif"
                              : undefined,
                          fontSize:
                            fontSizeMode === "manual"
                              ? `calc(${fontSize / 19.2}cqw * ${scaleMultiplier})`
                              : `calc(${baseAutoCqw}cqw * ${scaleMultiplier})`,
                          lineHeight: "1.25",
                        };

                        const bgGradient = isLight
                          ? "from-white/10 via-transparent to-white/5"
                          : "from-black/80 via-transparent";

                        const isEditBgActive =
                          editorActiveMenu === "gambar_bg" ||
                          editorActiveMenu === "video_bg";

                        return (
                          <div
                            ref={previewCanvasRef}
                            className={`w-full aspect-video bg-black rounded-lg border-2 p-6 flex flex-col shadow-2xl relative overflow-hidden @container select-none ${
                              isEditBgActive
                                ? "border-purple-600/90 cursor-move shadow-purple-500/10 ring-2 ring-purple-500/20"
                                : "border-zinc-950 cursor-text"
                            }`}
                            style={{ containerType: "inline-size" }}
                            onClick={(e) => {
                              if (!isEditBgActive) {
                                editorTextareaRef.current?.focus();
                              }
                            }}
                            onMouseDown={(e) => {
                              if (isEditBgActive)
                                handleBgMouseDown(e, "pan", null);
                            }}
                            onMouseMove={(e) => {
                              if (isEditBgActive) {
                                handleBgMouseMove(e);
                              } else if (isDraggingTextColumn) {
                                handleTextMouseMove(e);
                              }
                            }}
                            onMouseUp={() => {
                              if (isEditBgActive) {
                                handleBgMouseUp();
                              } else if (isDraggingTextColumn) {
                                handleTextMouseUp();
                              }
                            }}
                            onMouseLeave={() => {
                              if (isEditBgActive) {
                                handleBgMouseUp();
                              } else if (isDraggingTextColumn) {
                                handleTextMouseUp();
                              }
                            }}
                          >
                            {/* Floating button on the slide to change or select background image/video */}

                            {/* Slide Latar Belakang (Render background) */}
                            {bg &&
                              (() => {
                                const isColor =
                                  bg.startsWith("#") ||
                                  bg.startsWith("rgb") ||
                                  bg.startsWith("linear-gradient") ||
                                  bg === "transparent";
                                if (isColor) {
                                  return (
                                    <div
                                      style={{ background: bg }}
                                      className="absolute inset-0 w-full h-full z-0 pointer-events-none"
                                    />
                                  );
                                }
                                const bgOpacityVal =
                                  editingItem.bgOpacity !== undefined
                                    ? editingItem.bgOpacity / 100
                                    : 0.8;
                                const bgBrightnessVal =
                                  editingItem.bgBrightness !== undefined
                                    ? editingItem.bgBrightness / 100
                                    : 0.75;
                                const bgBlurVal =
                                  editingItem.bgBlur !== undefined
                                    ? editingItem.bgBlur
                                    : 0;
                                const bgFitVal = editingItem.bgFit || "cover";
                                const bgScaleVal =
                                  editingItem.bgScale !== undefined
                                    ? editingItem.bgScale / 100
                                    : 1;
                                const bgPositionXVal =
                                  editingItem.bgPositionX !== undefined
                                    ? editingItem.bgPositionX
                                    : 0;
                                const bgPositionYVal =
                                  editingItem.bgPositionY !== undefined
                                    ? editingItem.bgPositionY
                                    : 0;

                                const widthPct = bgScaleVal * 100;
                                const heightPct = bgScaleVal * 100;
                                const leftPct =
                                  50 + bgPositionXVal - widthPct / 2;
                                const topPct =
                                  50 + bgPositionYVal - heightPct / 2;

                                const mediaComponent = isVideo(bg) ? (
                                  <video
                                    src={resolveMedia(bg)}
                                    muted
                                    autoPlay
                                    loop
                                    playsInline
                                    className={
                                      isEditBgActive
                                        ? "w-full h-full object-cover"
                                        : "absolute inset-0 w-full h-full z-0 pointer-events-none"
                                    }
                                    style={
                                      isEditBgActive
                                        ? {}
                                        : {
                                            opacity: bgOpacityVal,
                                            objectFit: bgFitVal as any,
                                            objectPosition: `${50 + bgPositionXVal}% ${50 + bgPositionYVal}%`,
                                            filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                                            transform: `scale(${bgScaleVal})`,
                                          }
                                    }
                                  />
                                ) : (
                                  <img
                                    src={resolveMedia(bg)}
                                    alt="bg"
                                    className={
                                      isEditBgActive
                                        ? "w-full h-full object-cover"
                                        : "absolute inset-0 w-full h-full z-0 pointer-events-none"
                                    }
                                    style={
                                      isEditBgActive
                                        ? {}
                                        : {
                                            opacity: bgOpacityVal,
                                            objectFit: bgFitVal as any,
                                            objectPosition: `${50 + bgPositionXVal}% ${50 + bgPositionYVal}%`,
                                            filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                                            transform: `scale(${bgScaleVal})`,
                                          }
                                    }
                                    referrerPolicy="no-referrer"
                                  />
                                );

                                if (isEditBgActive) {
                                  return (
                                    <div
                                      style={{
                                        width: `${widthPct}%`,
                                        height: `${heightPct}%`,
                                        left: `${leftPct}%`,
                                        top: `${topPct}%`,
                                        opacity: bgOpacityVal,
                                        filter: `brightness(${bgBrightnessVal}) blur(${bgBlurVal}px)`,
                                        position: "absolute" as const,
                                        zIndex: 0,
                                        border: "2px dashed #FFF000",
                                        boxShadow: "0 0 12px rgba(0,0,0,0.6)",
                                      }}
                                      className="pointer-events-none select-none"
                                    >
                                      {mediaComponent}

                                      {/* 8 yellow control handles as requested */}
                                      {/* Top left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "tl")
                                        }
                                        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Top center */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "tc")
                                        }
                                        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-ns-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Top right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "tr")
                                        }
                                        className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Middle right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "mr")
                                        }
                                        className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-ew-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Bottom right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "br")
                                        }
                                        className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-nwse-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Bottom center */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "bc")
                                        }
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-ns-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Bottom left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "bl")
                                        }
                                        className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-nesw-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />
                                      {/* Middle left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleBgMouseDown(e, "scale", "ml")
                                        }
                                        className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFF000] border border-black rounded pointer-events-auto cursor-ew-resize hover:scale-125 transition-transform z-50 shadow-md"
                                      />

                                      {/* Rotate stick handler matching screenshot */}
                                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 flex flex-col items-center">
                                        <div className="w-0.5 h-3 bg-[#FFF000]" />
                                        <div
                                          className="w-4 h-4 bg-[#FFF000] border border-black rounded-full pointer-events-auto cursor-pointer flex items-center justify-center hover:scale-125 transition-transform shadow-md"
                                          title="Putar"
                                        >
                                          <span className="text-[8px] text-black font-extrabold">
                                            ↻
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return mediaComponent;
                              })()}
                            <div
                              className={`absolute inset-0 bg-gradient-to-t ${bgGradient} pointer-events-none z-[1]`}
                            />

                            {/* Shape Decorations Overlay */}
                            {editingItem.shapeDecoration === "bottom-bar" && (
                              <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md border border-zinc-700/50 rounded h-11 z-[5] pointer-events-none" />
                            )}
                            {editingItem.shapeDecoration === "left-accent" && (
                              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-cyan-500 z-[5] pointer-events-none" />
                            )}
                            {editingItem.shapeDecoration === "brackets" && (
                              <>
                                <div className="absolute left-3 top-3 bottom-3 w-3 border-t border-b border-l border-cyan-400 z-[5] pointer-events-none opacity-80" />
                                <div className="absolute right-3 top-3 bottom-3 w-3 border-t border-b border-r border-cyan-400 z-[5] pointer-events-none opacity-80" />
                              </>
                            )}
                            {editingItem.shapeDecoration === "thin-frame" && (
                              <div className="absolute inset-2.5 border border-zinc-500/40 z-[5] pointer-events-none" />
                            )}
                            {editingItem.shapeDecoration === "glow-rect" && (
                              <div className="absolute inset-x-8 inset-y-6 bg-zinc-950/60 blur-md rounded-lg z-[2] pointer-events-none" />
                            )}

                            {editingItem.logoLeftUrl && (
                              <div className="absolute top-4 left-4 z-[15] pointer-events-none">
                                <img
                                  src={resolveMedia(editingItem.logoLeftUrl)}
                                  alt="Left Logo"
                                  className="w-14 h-14 object-contain rounded-md drop-shadow"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {editingItem.logoRightUrl && (
                              <div className="absolute top-4 right-4 z-[15] pointer-events-none">
                                <img
                                  src={resolveMedia(editingItem.logoRightUrl)}
                                  alt="Right Logo"
                                  className="w-14 h-14 object-contain rounded-md drop-shadow"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            {!editingItem.logoLeftUrl &&
                              !editingItem.logoRightUrl &&
                              editingItem.logoUrl && (
                                <div
                                  className={`absolute top-4 z-[15] pointer-events-none ${editingItem.logoPosition === "left" ? "left-4" : "right-4"}`}
                                >
                                  <img
                                    src={resolveMedia(editingItem.logoUrl)}
                                    alt="Slide Logo"
                                    className="w-14 h-14 object-contain rounded-md drop-shadow"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}

                            {/* Centered lyrics display workspace with direct inline-editable textarea */}
                            {(() => {
                              const activeTextVal =
                                editingItem.verses[editorPreviewIdx] !==
                                undefined
                                  ? editingItem.verses[editorPreviewIdx]
                                  : editingItem.verses[0] || "";
                              const rowCountVal = Math.max(
                                1,
                                activeTextVal.split("\n").length,
                              );

                              const textWidth =
                                editingItem.textWidth !== undefined
                                  ? editingItem.textWidth
                                  : 92;
                              const textHeight =
                                editingItem.textHeight !== undefined
                                  ? editingItem.textHeight
                                  : 78;
                              const textLeft =
                                editingItem.textLeft !== undefined
                                  ? editingItem.textLeft
                                  : (100 - textWidth) / 2;
                              const textTop =
                                editingItem.textTop !== undefined
                                  ? editingItem.textTop
                                  : (100 - textHeight) / 2;

                              // Auto-align centering padding to make column height identical and fill container
                              const lineSizeCqw =
                                fontSizeMode === "manual"
                                  ? (fontSize / 19.2) * scaleMultiplier
                                  : baseAutoCqw * scaleMultiplier;

                              const totalTextHeightCqw =
                                rowCountVal * lineSizeCqw * 1.25;
                              const containerHeightCqw =
                                38.5 * (textHeight / 78); // Adjusted dynamically for manual box height
                              const remainingSpaceCqw = Math.max(
                                0.5,
                                containerHeightCqw - totalTextHeightCqw,
                              );

                              let paddingTopCqw = remainingSpaceCqw / 2;
                              let paddingBottomCqw = remainingSpaceCqw / 2;

                              if (textPosition === "top") {
                                paddingTopCqw = 1.0;
                                paddingBottomCqw = remainingSpaceCqw - 1.0;
                              } else if (textPosition === "bottom") {
                                paddingTopCqw = remainingSpaceCqw - 1.0;
                                paddingBottomCqw = 1.0;
                              }

                              return (
                                <div
                                  style={{
                                    width: `${textWidth}%`,
                                    height: `${textHeight}%`,
                                    left: `${textLeft}%`,
                                    top: `${textTop}%`,
                                    position: "absolute",
                                  }}
                                  onMouseDown={(e) => {
                                    // If clicking around the text elements within bounding container, enable drag/pan
                                    if (e.target === e.currentTarget) {
                                      handleTextMouseDown(e, "pan", null);
                                    }
                                  }}
                                  className={`z-10 flex flex-col p-3 rounded-lg border-2 border-dashed ${
                                    isDraggingTextColumn
                                      ? "border-purple-500 bg-purple-950/10"
                                      : "border-indigo-500/25 hover:border-indigo-500/70 focus-within:border-blue-500/70"
                                  } hover:bg-white/[0.01] focus-within:bg-black/25 transition-all justify-center ${alignClass}`}
                                >
                                  <textarea
                                    ref={editorTextareaRef}
                                    value={activeTextVal}
                                    onChange={(e) => {
                                      const newVerses = [...editingItem.verses];
                                      const targetIdx =
                                        editingItem.verses[editorPreviewIdx] !==
                                        undefined
                                          ? editorPreviewIdx
                                          : 0;
                                      newVerses[targetIdx] = e.target.value;
                                      setEditingItem({
                                        ...editingItem,
                                        verses: newVerses,
                                      });
                                    }}
                                    placeholder="Klik untuk mengetik lirik langsung di sini..."
                                    style={{
                                      ...customStyle,
                                      textAlign: textAlign as any,
                                      height: "100%",
                                      paddingTop: `${paddingTopCqw}cqw`,
                                      paddingBottom: `${paddingBottomCqw}cqw`,
                                      boxSizing: "border-box",
                                    }}
                                    className={`w-full bg-transparent border-none rounded text-center outline-none resize-none overflow-hidden scrollbar-none transition-all px-2 ${fontClass} ${weightClass} ${italicClass} ${transformClass} ${trackingClass} ${spacingClass}`}
                                    title="Ketik teks langsung di slide ini"
                                  />

                                  {/* EasyWorship 7 styled 8 resize anchors */}
                                  {!isEditBgActive && (
                                    <>
                                      {/* Top left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "tl")
                                        }
                                        className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Top center */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "tc")
                                        }
                                        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-ns-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Top right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "tr")
                                        }
                                        className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Middle right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "mr")
                                        }
                                        className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-ew-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Bottom right */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "br")
                                        }
                                        className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Bottom center */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "bc")
                                        }
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-ns-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Bottom left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "bl")
                                        }
                                        className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                      {/* Middle left */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleTextMouseDown(e, "resize", "ml")
                                        }
                                        className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full cursor-ew-resize hover:scale-125 transition-transform z-50 shadow-lg"
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })()}

                            {/* EasyWorship 7 styled bottom-left credentials text block */}
                            <div className="absolute bottom-2.5 left-4 z-20 pointer-events-none select-none text-left leading-normal text-white">
                              <p className="text-[8px] font-sans font-bold uppercase tracking-wide text-white drop-shadow">
                                {editingItem.title}
                              </p>
                              {editingItem.artist &&
                                editingItem.artist !== "Manual" &&
                                editingItem.artist !== "Manual Entry" && (
                                  <p className="text-[7px] text-white/70 font-sans tracking-wide drop-shadow-sm -mt-0.5">
                                    Composer / Artist: {editingItem.artist}
                                  </p>
                                )}
                            </div>

                            {/* Floating overlay HUD indicators for direct drag-and-drop EasyWorship interactivity */}
                            {isEditBgActive && (
                              <div className="absolute top-3.5 right-3.5 z-50 flex items-center gap-1.5 bg-black/85 backdrop-blur-md border border-zinc-700/80 rounded px-2.5 py-1.5 text-[10px] text-zinc-300 font-sans shadow-2xl select-none">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isDraggingBg ? "bg-red-500 animate-ping" : "bg-purple-500"}`}
                                />
                                <span className="font-extrabold text-[9px] uppercase text-zinc-100 tracking-wider">
                                  {editorActiveMenu === "gambar_bg"
                                    ? "GAMBAR HUD"
                                    : "VIDEO HUD"}
                                </span>
                                <span className="text-[8.5px] font-mono text-zinc-400">
                                  X:
                                  {editingItem.bgPositionX !== undefined
                                    ? editingItem.bgPositionX
                                    : 0}
                                  % Y:
                                  {editingItem.bgPositionY !== undefined
                                    ? editingItem.bgPositionY
                                    : 0}
                                  % | Z:
                                  {editingItem.bgScale !== undefined
                                    ? editingItem.bgScale
                                    : 100}
                                  %
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setEditingItem({
                                      ...editingItem,
                                      bgScale: 100,
                                      bgPositionX: 0,
                                      bgPositionY: 0,
                                      bgFit: "cover",
                                    });
                                  }}
                                  className="ml-2 px-1.5 py-0.5 bg-zinc-805 hover:bg-zinc-700 rounded text-[8px] font-black uppercase text-zinc-300 hover:text-white transition-all cursor-pointer"
                                  title="Reset Posisi & Zoom"
                                >
                                  Reset
                                </button>
                              </div>
                            )}

                            {/* Center drag crosshair indicator on-drag */}
                            {isDraggingBg && (
                              <div className="absolute inset-0 z-40 bg-purple-500/5 pointer-events-none border border-purple-500/20 flex items-center justify-center">
                                <div className="w-10 h-10 border border-purple-400/20 rounded-full flex items-center justify-center">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full" />
                                </div>
                              </div>
                            )}

                            {/* Floating bottom workspace editor toolbar removed for slide cleanliness */}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* BOTTOM ZOOM BAR CONTROLS REPLICATING SCREENSHOT */}
                  <div className="w-full flex items-center justify-between px-4 py-2 bg-[#2D2D30] border border-[#1E1E1F] rounded-lg text-zinc-400 select-none text-[11px] font-bold">
                    <span className="text-zinc-350">Zoom: {editorZoom}%</span>
                    <div className="flex items-center gap-3 w-1/2">
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={editorZoom}
                        onChange={(e) =>
                          setEditorZoom(parseInt(e.target.value))
                        }
                        className="flex-1 h-1 bg-[#1E1E1F] rounded appearance-none cursor-pointer accent-blue-500"
                        title="Slide preview zoom"
                      />
                      <button
                        type="button"
                        onClick={() => setEditorZoom(63)}
                        className="px-2 py-0.5 bg-[#3E3E42] text-[10px] text-zinc-300 hover:text-white rounded border border-[#2D2D30] transition-colors"
                      >
                        Reset (63%)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. BOTTOM ACTION CONTROL BANNER - EW7 STYLE */}
              <div className="px-5 py-3 border-t border-[#111112] bg-[#222224] flex justify-end items-center gap-3.5 select-none shrink-0 border-zinc-900 border-2">
                <button
                  type="button"
                  onClick={() => {
                    // APPLY: Save current modifications, but leave editor modal open
                    const newSchedule = schedule.map((s) =>
                      s.id === editingItem.id ? editingItem : s,
                    );
                    setSchedule(newSchedule);
                    localStorage.setItem(
                      "cp_last_schedule",
                      JSON.stringify(newSchedule),
                    );

                    if (editingItem.type === "song") {
                      const exists = librarySongs.some(
                        (ls) => ls.id === editingItem.id,
                      );
                      let updatedSongsList = [];
                      if (exists) {
                        updatedSongsList = librarySongs.map((ls) =>
                          ls.id === editingItem.id
                            ? { ...ls, ...editingItem, updatedAt: Date.now() }
                            : ls,
                        );
                      } else {
                        updatedSongsList = [
                          {
                            ...editingItem,
                            artist: editingItem.artist || "Manual Entry",
                            updatedAt: Date.now(),
                          } as any,
                          ...librarySongs,
                        ];
                      }
                      setLibrarySongs(updatedSongsList);
                      savePersistentSongs(currentAccountId, updatedSongsList);
                      syncSongsToBackend(updatedSongsList);
                    }
                    if (selectedSong?.id === editingItem.id)
                      setSelectedSong(editingItem as any);

                    const isBibleEditing =
                      editingItem.id?.startsWith("bible-") ||
                      editingItem.type === "bible";

                    if (previewSlide?.parentId === editingItem.id) {
                      const targetIdx =
                        previewSlide.slideIdx !== undefined &&
                        previewSlide.slideIdx < editingItem.verses.length
                          ? previewSlide.slideIdx
                          : 0;
                      const labels = editingItem.verseLabels || [];
                      const bibleVerseNum = getBibleVerseLabel(labels, targetIdx);
                      const displayContent = isBibleEditing
                        ? `${bibleVerseNum}. ${editingItem.verses[targetIdx] || editingItem.verses[0] || ""}`
                        : (editingItem.verses[targetIdx] || editingItem.verses[0] || "");

                      setPreviewSlide({
                        ...previewSlide,
                        ...editingItem,
                        content: displayContent,
                        background:
                          editingItem.backgroundOverride !== undefined &&
                          editingItem.backgroundOverride !== ""
                            ? editingItem.backgroundOverride
                            : activeBackground,
                      });
                    }
                    if (
                      currentSlide &&
                      currentSlide.parentId === editingItem.id
                    ) {
                      const targetIdx =
                        currentSlide.slideIdx !== undefined &&
                        currentSlide.slideIdx < editingItem.verses.length
                          ? currentSlide.slideIdx
                          : 0;
                      const labels = editingItem.verseLabels || [];
                      const bibleVerseNum = getBibleVerseLabel(labels, targetIdx);
                      const displayContent = isBibleEditing
                        ? `${bibleVerseNum}. ${editingItem.verses[targetIdx] || editingItem.verses[0] || ""}`
                        : (editingItem.verses[targetIdx] || editingItem.verses[0] || "");

                      changeSlide({
                        ...currentSlide,
                        ...editingItem,
                        content: displayContent,
                        background:
                          editingItem.backgroundOverride !== undefined &&
                          editingItem.backgroundOverride !== ""
                            ? editingItem.backgroundOverride
                            : activeBackground,
                      });
                    }
                    showToast(
                      "Perubahan berhasil di-Apply dan disimpan secara permanen!",
                      "success",
                    );
                  }}
                  className="px-5 py-1 text-[11px] font-bold bg-[#3A3A3D] hover:bg-[#4E4E52] text-gray-200 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded transition-colors cursor-pointer"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // OK: Save & Exit
                    const newSchedule = schedule.map((s) =>
                      s.id === editingItem.id ? editingItem : s,
                    );
                    setSchedule(newSchedule);
                    localStorage.setItem(
                      "cp_last_schedule",
                      JSON.stringify(newSchedule),
                    );

                    if (editingItem.type === "song") {
                      const exists = librarySongs.some(
                        (ls) => ls.id === editingItem.id,
                      );
                      let updatedSongsList = [];
                      if (exists) {
                        updatedSongsList = librarySongs.map((ls) =>
                          ls.id === editingItem.id
                            ? { ...ls, ...editingItem, updatedAt: Date.now() }
                            : ls,
                        );
                      } else {
                        updatedSongsList = [
                          {
                            ...editingItem,
                            artist: editingItem.artist || "Manual Entry",
                            updatedAt: Date.now(),
                          } as any,
                          ...librarySongs,
                        ];
                      }
                      setLibrarySongs(updatedSongsList);
                      savePersistentSongs(currentAccountId, updatedSongsList);
                      syncSongsToBackend(updatedSongsList);
                    }
                    if (selectedSong?.id === editingItem.id)
                      setSelectedSong(editingItem as any);

                    const isBibleEditing =
                      editingItem.id?.startsWith("bible-") ||
                      editingItem.type === "bible";

                    if (previewSlide?.parentId === editingItem.id) {
                      const targetIdx =
                        previewSlide.slideIdx !== undefined &&
                        previewSlide.slideIdx < editingItem.verses.length
                          ? previewSlide.slideIdx
                          : 0;
                      const labels = editingItem.verseLabels || [];
                      const bibleVerseNum = getBibleVerseLabel(labels, targetIdx);
                      const displayContent = isBibleEditing
                        ? `${bibleVerseNum}. ${editingItem.verses[targetIdx] || editingItem.verses[0] || ""}`
                        : (editingItem.verses[targetIdx] || editingItem.verses[0] || "");

                      setPreviewSlide({
                        ...previewSlide,
                        ...editingItem,
                        content: displayContent,
                        background:
                          editingItem.backgroundOverride !== undefined &&
                          editingItem.backgroundOverride !== ""
                            ? editingItem.backgroundOverride
                            : activeBackground,
                      });
                    }
                    if (
                      currentSlide &&
                      currentSlide.parentId === editingItem.id
                    ) {
                      const targetIdx =
                        currentSlide.slideIdx !== undefined &&
                        currentSlide.slideIdx < editingItem.verses.length
                          ? currentSlide.slideIdx
                          : 0;
                      const labels = editingItem.verseLabels || [];
                      const bibleVerseNum = getBibleVerseLabel(labels, targetIdx);
                      const displayContent = isBibleEditing
                        ? `${bibleVerseNum}. ${editingItem.verses[targetIdx] || editingItem.verses[0] || ""}`
                        : (editingItem.verses[targetIdx] || editingItem.verses[0] || "");

                      changeSlide({
                        ...currentSlide,
                        ...editingItem,
                        content: displayContent,
                        background:
                          editingItem.backgroundOverride !== undefined &&
                          editingItem.backgroundOverride !== ""
                            ? editingItem.backgroundOverride
                            : activeBackground,
                      });
                    }
                    showToast("Perubahan disimpan secara permanen!", "success");
                    setEditingItem(null);
                  }}
                  className="px-6 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast(
                      "Pengeditan dibatalkan. Perubahan yang belum di-Apply diabaikan.",
                      "info",
                    );
                    setEditingItem(null);
                  }}
                  className="px-5 py-1 text-[11px] font-bold bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded transition-colors border border-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center"
            >
              <div className="mb-6 flex flex-col items-center">
                <div className="p-4 bg-white rounded-xl mb-4">
                  <QRCodeSVG value={projectorUrl} size={180} level="H" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Live Mobile View
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  Scan QR code ini untuk melihat slide langsung di handphone
                </p>
              </div>
              <div className="bg-[#0A0A0B] p-3 rounded border border-[#2A2A2E] mb-6 select-all cursor-copy">
                <p className="text-[10px] font-mono text-blue-400 break-all">
                  {projectorUrl}
                </p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs uppercase tracking-widest transition-all"
              >
                Close Window
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Project Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowSaveModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
            >
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                Save Project File
              </h3>
              <p className="text-xs text-gray-400 mb-6 font-medium">
                Simpan seluruh susunan acara/jadwal aktif ke dalam file
                presentasi <code className="text-blue-400">.chr</code>
              </p>

              {/* Dynamic Card showcasing the App Logo inside the CHR file representation */}
              <div className="border border-zinc-800 p-6 rounded-2xl bg-zinc-950/40 relative flex flex-col items-center mb-6 group transition-all hover:bg-zinc-950/60">
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-[8px] font-black text-blue-400 rounded-full uppercase tracking-widest">
                  .CHR App File
                </span>

                {/* Visual File Icon with AppLogo! */}
                <div className="w-16 h-16 bg-[#161619] rounded-2xl flex items-center justify-center border border-[#2A2A2E] group-hover:border-blue-500/40 shadow-xl transition-all relative">
                  <AppLogo
                    className="w-12 h-12"
                    bgWhiteSquare={true}
                    showText={false}
                  />
                  <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-400/20 text-white text-[7px] px-1.5 py-0.5 font-black uppercase tracking-widest rounded-md shadow-md">
                    CHR
                  </span>
                </div>

                <h4 className="text-xs font-black text-white mt-4 break-all max-w-xs px-2 text-center select-all">
                  {saveFileName.trim()
                    ? saveFileName.endsWith(".chr")
                      ? saveFileName
                      : `${saveFileName}.chr`
                    : "jadwal_ibadah.chr"}
                </h4>
                <p className="text-[9px] text-gray-400 font-bold mt-1 bg-blue-950/40 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  ✨ Logo aplikasi disematkan dalam berkas (.chr)
                </p>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  Church Presenter Format &bull; {schedule.length} Items
                </p>
              </div>

              {/* Input field */}
              <div className="text-left space-y-2 mb-6">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                  Nama File
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={saveFileName}
                    onChange={(e) =>
                      setSaveFileName(
                        e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ""),
                      )
                    }
                    placeholder="nama_file"
                    className="w-full bg-[#0A0A0B] border border-[#2A2A2E] focus:border-blue-500 rounded px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 font-black">
                    .chr
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-gray-400 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    const finalName = saveFileName.trim()
                      ? saveFileName.endsWith(".chr")
                        ? saveFileName
                        : `${saveFileName}.chr`
                      : "jadwal_ibadah.chr";
                    
                    let base64Logo = logoUrl;
                    try {
                      const res = await fetch(logoUrl);
                      if (res.ok) {
                        const blob = await res.blob();
                        base64Logo = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.readAsDataURL(blob);
                        });
                      }
                    } catch (e) {
                      console.error("Failed to embed logo as base64", e);
                    }

                    const dataStr = JSON.stringify(
                      {
                        format: "church-presenter",
                        version: "7v2.4",
                        timestamp: new Date().toISOString(),
                        appLogo: base64Logo,
                        appLogoUrl: base64Logo,
                        brand: "Church Presenter",
                        schedule: schedule,
                      },
                      null,
                      2,
                    );

                    const blob = new Blob([dataStr], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = finalName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setShowSaveModal(false);
                    showToast(
                      "Berkas proyek berhasil diunduh dengan logo aplikasi!",
                      "success",
                    );
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10"
                >
                  Download File
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Presentation Modal */}
      <AnimatePresence>
        {showPresentationModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowPresentationModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
            >
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4">
                Simpan Jadwal Presentasi
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Simpan item yang sedang diedit ke daftar presentasi.
              </p>
              
              <input
                type="text"
                value={presentationName}
                onChange={(e) => setPresentationName(e.target.value)}
                placeholder="Nama Presentasi"
                className="w-full bg-[#1e1e1f] border border-zinc-700 rounded px-3 py-2 text-white mb-4 text-sm"
              />
              <button
                onClick={() => {
                  if (!presentationName.trim()) return;
                  
                  // Use editingItem if available, otherwise fallback to schedule
                  let versesToSave: string[] = [];
                  let labelsToSave: string[] = [];
                  
                  if (editingItem) {
                    versesToSave = [...editingItem.verses];
                    labelsToSave = editingItem.verseLabels ? [...editingItem.verseLabels] : [];
                  } else {
                    showToast("Pilih atau buat presentasi terlebih dahulu untuk disimpan", "warn");
                    return;
                  }

                  const newSong: Song = {
                    id: `presentation-${Date.now()}`,
                    title: presentationName,
                    verses: versesToSave,
                    verseLabels: labelsToSave,
                  };
                  setLibraryPresentations(prev => [newSong, ...prev]);
                  setPresentationName("");
                  setShowPresentationModal(false);
                  showToast("Presentasi berhasil disimpan!", "success");
                  setActiveTab("presentations");
                }}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded font-bold text-xs uppercase tracking-widest transition-all mb-3"
              >
                Simpan
              </button>
              <button
                onClick={() => setShowPresentationModal(false)}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-xs uppercase tracking-widest transition-all"
              >
                Batal
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Open Project Modal */}
      <AnimatePresence>
        {showOpenModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowOpenModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
            >
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                Open Project File
              </h3>
              <p className="text-xs text-gray-400 mb-6 font-medium">
                Unggah file jadwal <code className="text-blue-400 font-bold">.chr</code>, presentasi <code className="text-blue-400 font-bold">.pptx</code>, atau jadwal EasyWorship <code className="text-blue-400 font-bold">.ewsx</code> Anda.
              </p>

              {/* Upload Drop Zone, decorated with folder indicator and AppLogo! */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (isUploadingSchedule) return;
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    const nameLower = file.name.toLowerCase();
                    if (
                      nameLower.endsWith(".chr") ||
                      nameLower.endsWith(".pptx") ||
                      nameLower.endsWith(".ewsx")
                    ) {
                      handleUploadScheduleFile(file);
                    } else {
                      alert("Hanya format file .chr, .pptx, atau .ewsx yang didukung!");
                    }
                  }
                }}
                onClick={() => {
                  if (!isUploadingSchedule) {
                    document.getElementById("chr-file-selector")?.click();
                  }
                }}
                className="border-2 border-dashed border-[#2A2A2E] hover:border-blue-500/50 p-8 rounded-2xl bg-zinc-950/20 flex flex-col items-center justify-center cursor-pointer transition-all group mb-6 min-h-[220px]"
              >
                {isUploadingSchedule ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="w-10 h-10 border-4 border-blue-500/15 border-t-blue-500 rounded-full animate-spin mb-4" />
                    <h4 className="text-xs font-bold text-gray-300">
                      Sedang Membuka File...
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-[200px] text-center">
                      Mohon bersabar
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Logo and Icon overlap decoration */}
                    <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-blue-500/5 rounded-full filter blur-md p-6 group-hover:bg-blue-500/10 transition-colors" />
                      <div className="w-14 h-14 bg-[#141416]/90 rounded-2xl flex items-center justify-center border border-[#2A2A2E] group-hover:border-blue-500/30 group-hover:scale-105 transition-all">
                        <AppLogo
                          className="w-10 h-10 opacity-70 group-hover:opacity-100 transition-opacity"
                          bgWhiteSquare={true}
                          showText={false}
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center border border-[#2A2A2E] shadow-md">
                        <FolderOpen className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-gray-300 group-hover:text-blue-400 transition-colors">
                      Pilih atau Taruh File Project
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal max-w-[220px] text-center">
                      Tarik & lepas file .chr, .pptx, atau .ewsx di sini, atau klik untuk memilih dari folder Anda.
                    </p>
                  </>
                )}

                {/* Hidden Real File Input */}
                <input
                  id="chr-file-selector"
                  type="file"
                  accept=".chr,.pptx,.ewsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadScheduleFile(file);
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOpenModal(false);
                  }}
                  disabled={isUploadingSchedule}
                  className="px-6 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-gray-400 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {songToDelete && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSongToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-red-500/25 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center"
            >
              <div className="flex flex-col items-center mb-4">
                <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-3 border border-red-500/20">
                  <Trash className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  Hapus Lagu
                </h3>
                <p className="text-[10px] text-gray-400 mt-2">
                  Apakah Anda yakin ingin menghapus lagu{" "}
                  <span className="text-red-400 font-bold">
                    "{songToDelete.title}"
                  </span>{" "}
                  dari perpustakaan permanen? Tindakan ini tidak dapat
                  dibatalkan.
                </p>
              </div>

              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => setSongToDelete(null)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteSong}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-600/10 hover:shadow-red-700/20 transition-all flex-1"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {batchSongsToDelete && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setBatchSongsToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-red-500/25 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center"
            >
              <div className="flex flex-col items-center mb-4">
                <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-3 border border-red-500/20">
                  <Trash className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  Hapus Banyak Lagu
                </h3>
                <p className="text-[10px] text-gray-400 mt-2">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="text-red-400 font-bold">
                    {batchSongsToDelete.length} lagu
                  </span>{" "}
                  yang dipilih dari perpustakaan secara permanen? Tindakan ini
                  tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => setBatchSongsToDelete(null)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteBatchSongs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-600/10 hover:shadow-red-700/20 transition-all flex-1"
                >
                  Ya, Hapus Semua
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-lg w-full text-left"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-500 animate-spin-slow" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                      System Settings
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Konfigurasi kecepatan transisi, rasio aspek, dan
                      presentasi
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-800 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Section 1: Slide Progression & Transitions */}
                <div className="space-y-4 bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-xl">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" /> Kecepatan
                    & Transisi Slide
                  </h4>
                  <div className="h-px bg-[#2A2A2E]" />

                  {/* Slide Auto-Play Timer Interval */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">
                        Interval Auto-Play (Kecepatan Slide)
                      </span>
                      <span className="text-blue-400 font-bold font-mono">
                        {slideSpeed} Detik
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="2"
                        max="30"
                        value={slideSpeed}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSlideSpeed(val);
                          localStorage.setItem(
                            "cp_settings_slide_speed",
                            val.toString(),
                          );
                        }}
                        className="flex-1 accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <input
                        type="number"
                        min="2"
                        max="30"
                        value={slideSpeed}
                        onChange={(e) => {
                          const val = Math.max(
                            2,
                            Math.min(30, parseInt(e.target.value, 10) || 5),
                          );
                          setSlideSpeed(val);
                          localStorage.setItem(
                            "cp_settings_slide_speed",
                            val.toString(),
                          );
                        }}
                        className="w-14 bg-zinc-900 border border-[#2A2A2E] text-white rounded px-2 py-0.5 text-center font-mono text-xs"
                      />
                    </div>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Interval pergantian slide otomatis saat tombol "Auto Play"
                      diaktifkan.
                    </p>
                  </div>

                  {/* Slide Transition Speed Duration */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">
                        Durasi Transisi Slide (Fade/Zoom/Slide)
                      </span>
                      <span className="text-blue-400 font-bold font-mono">
                        {transitionDuration} Detik
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0.0"
                        max="3.0"
                        step="0.05"
                        value={transitionDuration}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setTransitionDuration(val);
                          localStorage.setItem(
                            "cp_settings_transition_duration",
                            val.toString(),
                          );
                        }}
                        className="flex-1 accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0.0"
                        max="3.0"
                        step="0.1"
                        value={transitionDuration}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(3, parseFloat(e.target.value) || 0.3),
                          );
                          setTransitionDuration(val);
                          localStorage.setItem(
                            "cp_settings_transition_duration",
                            val.toString(),
                          );
                        }}
                        className="w-14 bg-zinc-900 border border-[#2A2A2E] text-white rounded px-2 py-0.5 text-center font-mono text-xs"
                      />
                    </div>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Kecepatan animasi pergeseran/memudar dari satu
                      bahasa/slide ke slide berikutnya di jendela projector.
                    </p>
                  </div>
                </div>

                {/* Section 2: Output Setup */}
                <div className="space-y-4 bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-xl">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Monitor className="w-3.5 h-3.5 text-blue-400" /> Pengaturan
                    Output & Tampilan
                  </h4>
                  <div className="h-px bg-[#2A2A2E]" />

                  {/* Output Display Aspect Ratio */}
                  <div className="space-y-2">
                    <span className="text-xs text-gray-300 font-medium block">
                      Rasio Aspek Layar Proyektor
                    </span>
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <button
                        onClick={() => {
                          setOutputResolution("16:9");
                          localStorage.setItem(
                            "cp_settings_output_resolution",
                            "16:9",
                          );
                        }}
                        className={`py-2 px-4 rounded-lg text-xs font-bold transition-all uppercase flex flex-col items-center gap-1 relative overflow-hidden ${
                          outputResolution === "16:9"
                            ? "bg-blue-600/10 border-blue-500 text-blue-400 border-2"
                            : "bg-zinc-900 border-[#2A2A2E] border text-gray-400 hover:text-white hover:bg-zinc-850"
                        }`}
                      >
                        <span className="text-sm font-black">16:9</span>
                        <span className="text-[9px] font-medium opacity-50 font-sans">
                          Layar Lebar (Widescreen)
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setOutputResolution("4:3");
                          localStorage.setItem(
                            "cp_settings_output_resolution",
                            "4:3",
                          );
                        }}
                        className={`py-2 px-4 rounded-lg text-xs font-bold transition-all uppercase flex flex-col items-center gap-1 relative overflow-hidden ${
                          outputResolution === "4:3"
                            ? "bg-blue-600/10 border-blue-500 text-blue-400 border-2"
                            : "bg-zinc-900 border-[#2A2A2E] border text-gray-400 hover:text-white hover:bg-zinc-850"
                        }`}
                      >
                        <span className="text-sm font-black">4:3</span>
                        <span className="text-[9px] font-medium opacity-50 font-sans">
                          Layar Standar (Box / CRT)
                        </span>
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Mengubah bentuk rasio monitor output agar sesuai dengan
                      aspek proyektor gereja Anda.
                    </p>
                  </div>

                  {/* Show Logo when standby/clear is pressed */}
                  <div className="flex items-center justify-between pb-1 pt-2">
                    <div className="space-y-0.5">
                      <span className="text-xs text-gray-300 font-medium block">
                        Tampilkan Logo Saat "Clear"
                      </span>
                      <p className="text-[9px] text-gray-500 max-w-[280px]">
                        Menampilkan Logo Presenter saat mode "Clear" ditekan,
                        bukan layar kosong hitam biasa.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const val = !showLogoOnClear;
                        setShowLogoOnClear(val);
                        localStorage.setItem(
                          "cp_settings_show_logo_on_clear",
                          val.toString(),
                        );
                      }}
                      className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-all ${showLogoOnClear ? "bg-blue-600 justify-end" : "bg-zinc-800 justify-start"}`}
                    >
                      <motion.div
                        layout
                        className="w-4 h-4 rounded-full bg-white shadow-md"
                      />
                    </button>
                  </div>
                </div>

                {/* Section 3: Global Text Style Override */}
                <div className="space-y-4 bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-xl">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> Override
                    Gaya Teks Global
                  </h4>
                  <div className="h-px bg-[#2A2A2E]" />

                  {/* Font Family selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-medium block">
                      Font Default Proskor
                    </label>
                    <select
                      value={globalFontFamily}
                      onChange={(e) => {
                        setGlobalFontFamily(e.target.value);
                        localStorage.setItem(
                          "cp_settings_font_family",
                          e.target.value,
                        );
                      }}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] rounded px-3 py-1.5 text-white text-xs font-sans outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="Default">
                        Gunakan Sesuai Tema Lagu (Default)
                      </option>
                      <option value="Sans / Inter">
                        Inter (Sans-Serif Elegan)
                      </option>
                      <option value="Space Grotesk">
                        Space Grotesk (Tech Modern)
                      </option>
                      <option value="Outfit">Outfit (Clean Geometric)</option>
                      <option value="Playfair Display">
                        Playfair Display (Serif Klasik)
                      </option>
                      <option value="Cinzel">Cinzel (Editorial Mewah)</option>
                      <option value="JetBrains Mono">
                        JetBrains Mono (Monospace)
                      </option>
                    </select>
                  </div>

                  {/* Text Transform / Capitalization */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-medium block">
                      Kapitalisasi Teks
                    </label>
                    <select
                      value={globalTextTransform}
                      onChange={(e) => {
                        setGlobalTextTransform(e.target.value);
                        localStorage.setItem(
                          "cp_settings_text_transform",
                          e.target.value,
                        );
                      }}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] rounded px-3 py-1.5 text-white text-xs font-sans outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="Default">
                        Gunakan Sesuai Tema (Default)
                      </option>
                      <option value="uppercase">
                        SANGAT BESAR (HURUF KAPITAL)
                      </option>
                      <option value="lower-case">huruf kecil semua</option>
                      <option value="capitalize">
                        Huruf Besar Di Awal Kata
                      </option>
                      <option value="none">Normal (Sesuai Ketikan Asli)</option>
                    </select>
                  </div>

                  {/* Text Drop Shadow style Choice */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-medium block">
                      Gaya Efek Bayangan (Drop Shadow)
                    </label>
                    <select
                      value={globalTextShadowStyle}
                      onChange={(e) => {
                        setGlobalTextShadowStyle(e.target.value);
                        localStorage.setItem(
                          "cp_settings_text_shadow_style",
                          e.target.value,
                        );
                      }}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] rounded px-3 py-1.5 text-white text-xs font-sans outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="Default">Default (Otomatis)</option>
                      <option value="Soft High-Contrast">
                        Glow High-Contrast (Lembut)
                      </option>
                      <option value="Heavy">
                        Bayangan Tebal / Sinema (Sangat Kontras)
                      </option>
                      <option value="None">Tanpa Bayangan</option>
                    </select>
                  </div>
                </div>

                {/* Section 4: Streaming & Scale Setup */}
                <div className="space-y-5 bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <Video className="w-3.5 h-3.5 text-blue-400" /> Integrasi
                      Live Stream (OBS / vMix)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[8px] font-mono font-bold tracking-wider uppercase">
                      Instant Sync
                    </span>
                  </div>
                  <div className="h-px bg-[#2A2A2E]" />

                  {/* Instant Copy Link Button */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">
                      1-Klik Link Proyektor (Browser Source OBS)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getPublicUrl("/projector")}
                        className="flex-1 bg-zinc-900 border border-[#2A2A2E] text-blue-400 rounded px-3 py-1.5 select-all font-mono text-[10px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = getPublicUrl("/projector");
                          navigator.clipboard.writeText(url);
                          showToast(
                            "Link proyeksi berhasil disalin ke clipboard!",
                            "success",
                          );
                        }}
                        className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Salin Link
                      </button>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-normal">
                      Copy link di atas, lalu tambahkan sebagai **Browser
                      Source** di OBS Anda. Sinkronisasi berjalan otomatis
                      secara instan.
                    </p>
                  </div>

                  {/* OBS/Server Connection Monitor Status */}
                  <div className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-[#2A2A2E] rounded-lg text-[10px] font-sans">
                    <div
                      className={`w-2 h-2 rounded-full ${clientCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-orange-500 animate-pulse"}`}
                    />
                    <div className="flex-grow text-gray-400">
                      Sinyal Sinkronisasi:{" "}
                      <span className="text-white font-bold">
                        {clientCount} Perangkat
                      </span>{" "}
                      terdeteksi aktif.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Push a custom calibration pattern
                        changeSlide({
                          id: "calibration-slide",
                          type: "lyrics" as any,
                          title: "OBS ALIGNMENT TEST",
                          content:
                            "[ TESTING OVERLAY PROYEKSI LIVE STREAMING ]\n====== GRID SAFE AREA ALIGNMENT ======\nKiri - Kanan - Atas - Bawah OK\nResolusi Standar Output: 1920 X 1080 (16:9)",
                          background: "#000000",
                          backgroundOverride: "transparent",
                          textColor: "#3b82f6",
                          fontSizeMode: "auto",
                          textAlign: "center",
                          textPosition: "center",
                          textBold: true,
                        });
                        showToast(
                          "Pola kalibrasi dikirim ke OBS & Proyektor!",
                          "success",
                        );
                      }}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded text-[9px] font-bold border border-zinc-700 transition-colors uppercase whitespace-nowrap"
                    >
                      Pola Kalibrasi
                    </button>
                    {currentSlide?.id === "calibration-slide" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMasterOverride(null);
                          changeSlide({
                            id: "clear-slide",
                            type: "lyrics" as any,
                            title: "CLEAR",
                            content: "",
                            background: "#000000",
                            backgroundOverride: "transparent",
                            textColor: "#ffffff",
                          });
                          showToast("Kalibrasi dimatikan.", "info");
                        }}
                        className="px-1.5 py-0.5 bg-red-950/40 hover:bg-red-900 border border-red-800/30 text-rose-400 rounded text-[9px] font-bold transition-colors uppercase"
                      >
                        Mati
                      </button>
                    )}
                  </div>

                  {/* Output Layout Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans block">
                      Gaya Tampilan Output
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLowerThirdMode(false);
                          localStorage.setItem(
                            "cp_settings_lower_third_mode",
                            "false",
                          );
                        }}
                        className={`p-2.5 rounded-lg border text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1.5 text-center cursor-pointer ${
                          !lowerThirdMode
                            ? "bg-blue-600/10 border-blue-500/80 text-blue-400 shadow-md"
                            : "bg-zinc-900/60 border-zinc-800 text-gray-400 hover:border-zinc-700 hover:text-gray-300"
                        }`}
                      >
                        <span className="font-extrabold text-white text-[11px]">
                          PROJECTOR PENUH (16:9)
                        </span>
                        <span className="text-[8px] font-medium opacity-70">
                          Lirik di tengah layar, cocok untuk dinding layar besar
                          gereja
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLowerThirdMode(true);
                          localStorage.setItem(
                            "cp_settings_lower_third_mode",
                            "true",
                          );
                        }}
                        className={`p-2.5 rounded-lg border text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1.5 text-center cursor-pointer ${
                          lowerThirdMode
                            ? "bg-blue-600/10 border-blue-500/80 text-blue-400 shadow-md"
                            : "bg-zinc-900/60 border-zinc-800 text-gray-400 hover:border-zinc-700 hover:text-gray-300"
                        }`}
                      >
                        <span className="font-extrabold text-blue-400 text-[11px]">
                          LOWER THIRD BAR (STREAM)
                        </span>
                        <span className="text-[8px] font-medium opacity-70">
                          Lirik di bagian bawah, ideal untuk overlay video OBS
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Chroma Key Back preference */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] text-gray-400 font-bold block uppercase font-sans tracking-wider">
                      Metode Tembus Pandang (Keying)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChromaKeyColor("transparent");
                          localStorage.setItem(
                            "cp_settings_chroma_key_color",
                            "transparent",
                          );
                        }}
                        className={`p-2 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          chromaKeyColor === "transparent"
                            ? "bg-blue-600/10 border-blue-500 text-blue-400"
                            : "bg-zinc-900/60 border-[#2A2A2E] text-gray-400"
                        }`}
                      >
                        <span className="font-bold">
                          TRANSPARAN (OBS DIRECT)
                        </span>
                        <span className="text-[7.5px] font-medium opacity-60">
                          Tidak perlu setting filter di OBS (Rekomendasi)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChromaKeyColor("green");
                          localStorage.setItem(
                            "cp_settings_chroma_key_color",
                            "green",
                          );
                        }}
                        className={`p-2 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          chromaKeyColor === "green"
                            ? "bg-green-600/10 border-green-500 text-green-400"
                            : "bg-zinc-900/60 border-[#2A2A2E] text-gray-400"
                        }`}
                      >
                        <span className="font-bold">
                          LAYAR HIJAU (CHROMA KEY)
                        </span>
                        <span className="text-[7.5px] font-medium opacity-60">
                          Gunakan filter kroma jika tangkap dari HDMI Capture
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Font Sizing scale factor */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span className="font-sans">
                        Skala Ukuran Teks (Global Scale)
                      </span>
                      <span className="text-blue-400 font-bold font-mono">
                        {globalFontSizeScale}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={globalFontSizeScale}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setGlobalFontSizeScale(val);
                          localStorage.setItem(
                            "cp_settings_font_size_scale",
                            val.toString(),
                          );
                        }}
                        className="flex-1 accent-blue-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                      />
                      <input
                        type="number"
                        min="50"
                        max="200"
                        value={globalFontSizeScale}
                        onChange={(e) => {
                          const val = Math.max(
                            50,
                            Math.min(200, parseInt(e.target.value, 10) || 100),
                          );
                          setGlobalFontSizeScale(val);
                          localStorage.setItem(
                            "cp_settings_font_size_scale",
                            val.toString(),
                          );
                        }}
                        className="w-14 bg-zinc-900 border border-[#2A2A2E] text-white rounded px-2 py-0.5 text-center font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Dynamic Help Guides Tab Panel */}
                  <div className="p-3 bg-zinc-950/60 border border-[#2A2A2E] rounded-xl space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                      <span className="text-[10px] font-black uppercase text-gray-400">
                        PANDUAN PEMASANGAN INSTAN
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setObsTabActive(true)}
                          className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            obsTabActive
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-900 text-gray-400"
                          }`}
                        >
                          OBS Studio
                        </button>
                        <button
                          type="button"
                          onClick={() => setObsTabActive(false)}
                          className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                            !obsTabActive
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-900 text-gray-400"
                          }`}
                        >
                          vMix
                        </button>
                      </div>
                    </div>

                    {obsTabActive ? (
                      <div className="space-y-1.5 text-[9px] text-gray-400 leading-normal font-sans">
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            1.
                          </span>
                          <span>Klik tombol **Salin Link** di atas.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            2.
                          </span>
                          <span>
                            Pada program **OBS Studio**, klik logo **`+`** di
                            menu Sources.
                          </span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            3.
                          </span>
                          <span>
                            Pilih **Browser**, beri nama misalnya "Lirik
                            Proyektor".
                          </span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            4.
                          </span>
                          <span>
                            Tempel/Paste link proyektor pada kolom URL.
                          </span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            5.
                          </span>
                          <span>
                            Atur **Width: 1920** dan **Height: 1080** agar
                            resolusinya tajam dan presisi.
                          </span>
                        </p>
                        <p className="mt-2 text-[8px] text-emerald-400/80 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">
                          💡 **Tips Tanpa Ribet**: Dengan mode **Transparan**,
                          latar belakang otomatis hilang secara jernih tanpa
                          perlu menyetel filter/kunci kroma tambahan lagi!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-[9px] text-gray-400 leading-normal font-sans">
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            1.
                          </span>
                          <span>Klik tombol **Salin Link** di atas.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            2.
                          </span>
                          <span>
                            Pada aplikasi **vMix**, klik **Add Input** di kiri
                            bawah.
                          </span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            3.
                          </span>
                          <span>
                            Pilih kategori **Web Browser** di daftar menu input.
                          </span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            4.
                          </span>
                          <span>Tempel/Paste link proyektor ke kolom URL.</span>
                        </p>
                        <p className="flex items-start gap-1">
                          <span className="text-blue-400 font-bold shrink-0">
                            5.
                          </span>
                          <span>
                            Setel **Resolution: 1920x1080** lalu klik **OK**.
                          </span>
                        </p>
                        <p className="mt-2 text-[8px] text-emerald-400/80 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">
                          💡 **Tips vMix**: Lirik output akan tersinkronisasi
                          secara instan dengan transisi lembut saat operator
                          berpindah baris/ayat.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 5: Cloud Hosting & Mobile Share Synchronization */}
                <div className="space-y-4 bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <Globe className="w-3.5 h-3.5 text-blue-400" /> Sinkronisasi Cloud & Hosting (Vercel / GitHub)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[8px] font-mono font-bold tracking-wider uppercase">
                      Cloud Sync Ready
                    </span>
                  </div>
                  <div className="h-px bg-[#2A2A2E]" />

                  <div className="space-y-2">
                    <label className="text-xs text-gray-300 font-medium block">
                      URL Backend Socket.io (Opsional untuk Vercel / GitHub Pages)
                    </label>
                    <input
                      type="text"
                      value={cloudServerUrl}
                      onChange={(e) => setCloudServerUrl(e.target.value)}
                      placeholder="Contoh: https://church-presenter.railway.app atau http://192.168.1.5:3000"
                      className="w-full bg-zinc-900 border border-[#2A2A2E] text-white rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-blue-500 transition-all placeholder:text-gray-600"
                    />
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-1">
                      <p className="text-[10px] text-blue-300 font-bold">
                        ℹ️ Informasi Hosting di Vercel / GitHub Pages:
                      </p>
                      <p className="text-[9px] text-gray-400 leading-relaxed font-sans">
                        Ketika aplikasi dihosting sebagai frontend statis di Vercel atau GitHub Pages, masukkan URL server backend Node/Socket.io Anda di sini. Link & QR Code Mobile Share akan secara otomatis menyertakan alamat server ini sehingga perangkat mobile jemaat yang memindai QR langsung terhubung tanpa konfigurasi manual!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end mt-8 pt-4 border-t border-[#2A2A2E]/50">
                <button
                  onClick={() => {
                    localStorage.setItem(
                      "cp_settings_slide_speed",
                      slideSpeed.toString(),
                    );
                    localStorage.setItem(
                      "cp_settings_transition_duration",
                      transitionDuration.toString(),
                    );
                    localStorage.setItem(
                      "cp_settings_output_resolution",
                      outputResolution,
                    );
                    localStorage.setItem(
                      "cp_settings_show_logo_on_clear",
                      showLogoOnClear.toString(),
                    );
                    localStorage.setItem(
                      "cp_settings_font_family",
                      globalFontFamily,
                    );
                    localStorage.setItem(
                      "cp_settings_text_transform",
                      globalTextTransform,
                    );
                    localStorage.setItem(
                      "cp_settings_lower_third_mode",
                      lowerThirdMode.toString(),
                    );
                    localStorage.setItem(
                      "cp_settings_font_size_scale",
                      globalFontSizeScale.toString(),
                    );
                    localStorage.setItem(
                      "cp_settings_text_shadow_style",
                      globalTextShadowStyle,
                    );
                    localStorage.setItem(
                      "cp_settings_chroma_key_color",
                      chromaKeyColor,
                    );
                    localStorage.setItem(
                      "cp_socket_server_url",
                      cloudServerUrl.trim(),
                    );

                    const prev = localStorage.getItem("cp_trigger_sync") || "0";
                    localStorage.setItem(
                      "cp_trigger_sync",
                      (parseInt(prev) + 1).toString(),
                    );

                    syncSettings({
                      outputResolution,
                      transitionDuration,
                      globalFontFamily,
                      globalTextTransform,
                      lowerThirdMode,
                      globalFontSizeScale,
                      globalTextShadowStyle,
                      chromaKeyColor,
                    });

                    setShowSettingsModal(false);
                    showToast("Pengaturan sistem & sinkronisasi berhasil disimpan.", "success");
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                >
                  Simpan & Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShiftModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShiftModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-8 rounded-2xl shadow-2xl max-w-lg w-full text-left"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                      Konfigurasi Shift Operator
                    </h3>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Batasi durasi akses Mobile Share jemaat demi efisiensi
                      server
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-800 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Active Switch */}
                <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-xs text-white font-bold uppercase tracking-wide">
                      Aktifkan Pembatasan Shift
                    </span>
                    <p className="text-[10px] text-gray-400">
                      Hubungkan alarm penutupan otomatis pada peramban mobile
                      share jemaat.
                    </p>
                  </div>
                  <button
                    onClick={() => setTempShiftActive(!tempShiftActive)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-all ${tempShiftActive ? "bg-emerald-600 justify-end" : "bg-zinc-800 justify-start"}`}
                  >
                    <motion.div
                      layout
                      className="w-4 h-4 rounded-full bg-white shadow-md"
                    />
                  </button>
                </div>

                {/* Input Fields */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-medium block">
                      Nama Shift / Sesi Ibadah
                    </label>
                    <input
                      type="text"
                      value={tempShiftName}
                      onChange={(e) => setTempShiftName(e.target.value)}
                      placeholder="Contoh: Ibadah I - Pagi"
                      disabled={!tempShiftActive}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] disabled:opacity-50 rounded px-3 py-2 text-white text-xs font-sans outline-none focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-300 font-medium block">
                      Waktu Selesai (Sesi Kunci Otomatis)
                    </label>
                    <input
                      type="time"
                      value={tempShiftEndTime}
                      onChange={(e) => setTempShiftEndTime(e.target.value)}
                      disabled={!tempShiftActive}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] disabled:opacity-50 rounded px-3 py-2 text-white text-xs font-mono outline-none focus:border-emerald-500 transition-all cursor-pointer font-medium"
                    />
                    <p className="text-[9px] text-gray-500 font-medium leading-normal">
                      Setelah jam ini dilewati, tampilan di HP jemaat akan
                      otomatis beralih ke layar penutupan untuk mencegah server
                      padat.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                    <label className="text-xs text-emerald-400 font-bold block uppercase tracking-wider">
                      Sistem QR-Code Cetak Aktif
                    </label>
                    <p className="text-[10px] text-gray-300 leading-relaxed font-semibold">
                      Sistem menggunakan format URL statis yang aman agar QR-code dapat dicetak sekali dan jemaat dapat langsung terhubung kapan saja ketika shift aktif tanpa memerlukan token yang berubah-ubah.
                    </p>
                  </div>
                </div>

                {/* Preset Options */}
                {tempShiftActive && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block font-sans">
                      Template Waktu
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setTempShiftName("Ibadah Pagi");
                          setTempShiftEndTime("09:30");
                        }}
                        className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-left rounded text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer"
                      >
                        <div className="font-bold text-emerald-400">Pagi</div>
                        <div className="font-mono text-[9px] opacity-60">
                          Mulai/Batas 09:30
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setTempShiftName("Ibadah Siang");
                          setTempShiftEndTime("12:00");
                        }}
                        className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-left rounded text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer"
                      >
                        <div className="font-bold text-emerald-400">Siang</div>
                        <div className="font-mono text-[9px] opacity-60">
                          Mulai/Batas 12:00
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setTempShiftName("Ibadah Tambahan");
                          setTempShiftEndTime("13:30");
                        }}
                        className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-left rounded text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer"
                      >
                        <div className="font-bold text-emerald-400">
                          Tambahan
                        </div>
                        <div className="font-mono text-[9px] opacity-60">
                          Mulai/Batas 13:30
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end mt-8 pt-4 border-t border-[#2A2A2E]/50">
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="px-5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-gray-400 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    const token = tempShiftActive
                      ? tempShiftToken.trim() ||
                        Math.random().toString(36).substring(2, 8).toUpperCase()
                      : "";
                    updateShift({
                      active: tempShiftActive,
                      name: tempShiftName,
                      endTime: tempShiftEndTime,
                      token,
                    });
                    setShowShiftModal(false);
                  }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
                >
                  Simpan & Terapkan Shift
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowAccountModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-6 rounded-2xl shadow-2xl max-w-lg w-full text-left"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                      Kabin Akun Operator
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Sesuaikan profil penayangan Anda dan perbarui tingkat
                      keamanan PIN sistem.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-800 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Card View */}
              <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Visual Identity Preview */}
                <div className="bg-zinc-950/40 border border-[#2A2A2E] p-4 rounded-2xl flex items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full filter blur-[40px] opacity-10 bg-indigo-500 pointer-events-none" />
                  <div
                    className={`w-14 h-14 rounded-full ${getAvatarColors(userAvatarColor).bg} border-2 ${getAvatarColors(userAvatarColor).border} flex items-center justify-center text-2xl font-black ${getAvatarColors(userAvatarColor).text} shadow-inner uppercase`}
                  >
                    {username ? username.charAt(0) : "O"}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider font-mono">
                      Kartu Identitas Aktif
                    </span>
                    <h4 className="text-base font-black text-white truncate max-w-[280px]">
                      {username || "Operator Utama"}
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-950/40 border border-blue-500/20 text-blue-400 rounded text-[9px] font-bold uppercase tracking-wider mt-1">
                      <Shield className="w-3 h-3" /> {userRole}
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">
                      Nama Lengkap Operator
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.slice(0, 30))}
                      placeholder="Masukkan nama operator..."
                      className="w-full bg-zinc-900 border border-[#2A2A2E] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 outline-none transition-all font-sans font-medium"
                    />
                  </div>

                  {/* Role Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">
                      Peran & Tanggung Jawab
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full bg-zinc-900 border border-[#2A2A2E] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-all cursor-pointer font-sans font-medium"
                    >
                      <option value="Administrator">
                        Administrator (Sistem Utama)
                      </option>
                      <option value="Tim Multimedia">
                        Tim Multimedia & Slide Operator
                      </option>
                      <option value="Song Leader">
                        Song Leader / Pemandu Lagu
                      </option>
                      <option value="Liturgis">
                        Liturgis / Majelis Jemaat
                      </option>
                      <option value="Sound Engineer">
                        Sound Engineer / Pad Controller
                      </option>
                    </select>
                  </div>

                  {/* Avatar Color Choice */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                      Warna Tema Profil
                    </label>
                    <div className="flex gap-2.5">
                      {(
                        [
                          "indigo",
                          "emerald",
                          "rose",
                          "amber",
                          "purple",
                          "blue",
                        ] as const
                      ).map((color) => {
                        const scheme = getAvatarColors(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setUserAvatarColor(color)}
                            className={`w-7 h-7 rounded-full ${scheme.bg} border-2 ${userAvatarColor === color ? "border-white scale-110 ring-4 ring-indigo-500/10" : scheme.border} hover:scale-105 transition-all flex items-center justify-center`}
                          >
                            <div
                              className={`w-3 h-3 rounded-full ${color === "indigo" ? "bg-indigo-500" : color === "emerald" ? "bg-emerald-500" : color === "rose" ? "bg-rose-500" : color === "amber" ? "bg-amber-500" : color === "purple" ? "bg-purple-500" : "bg-blue-500"}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PIN Form block */}
                  <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <div>
                        <span className="text-[10px] text-emerald-400 font-black tracking-wider uppercase block leading-none">
                          Pengaturan PIN Sistem
                        </span>
                        <span className="text-[8px] text-gray-500 mt-0.5 block leading-none">
                          Keamanan gerbang depan operator
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] text-gray-400 font-bold block uppercase">
                        PIN Akses Baru (4 Angka)
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          id="account-pin-input"
                          maxLength={4}
                          defaultValue={operatorPin}
                          placeholder="••••"
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            e.target.value = val;
                          }}
                          className="bg-zinc-900 border border-[#2A2A2E] tracking-[1em] text-center font-black text-sm rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-emerald-500/50 w-24"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(
                              "account-pin-input",
                            ) as HTMLInputElement;
                            if (el && el.value.length === 4) {
                              setOperatorPin(el.value);
                              localStorage.setItem("operator_pin", el.value);
                              showToast(
                                `PIN Akses berhasil diperbarui menjadi ${el.value}!`,
                                "success",
                              );
                            } else {
                              showToast(
                                "PIN harus terdiri dari tepat 4 angka!",
                                "warn",
                              );
                            }
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600/10 hover:bg-emerald-650 border border-emerald-500/25 hover:text-white text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Perbarui PIN Baru
                        </button>
                      </div>
                      <p className="text-[8px] text-gray-500 leading-normal">
                        Ubah PIN default{" "}
                        <strong className="text-blue-500">1234</strong> ke pin
                        kustom pilihan Anda. Perubahan akan langsung divalidasi
                        saat masuk dari halaman login.
                      </p>
                    </div>
                  </div>

                  {/* Metadata / Session details */}
                  <div className="bg-zinc-950/25 border border-[#2A2A2E]/50 p-3.5 rounded-xl text-[10px] space-y-1.5 font-bold">
                    <span className="text-gray-500 uppercase tracking-widest text-[9px] block mb-1">
                      Rincian Sesi Aktif
                    </span>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status Autentikasi:</span>
                      <span className="text-green-500 uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />{" "}
                        Live Logged In
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sessi Masuk Sejak:</span>
                      <span className="text-white font-mono">
                        {sessionStartTime} WIB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sistem Perangkat:</span>
                      <span className="text-white">
                        {navigator.userAgent.includes("Windows")
                          ? "Windows PC / workstation"
                          : navigator.userAgent.includes("Mac")
                            ? "Apple macOS"
                            : navigator.userAgent.includes("Android")
                              ? "Android Device"
                              : navigator.userAgent.includes("iPhone")
                                ? "Apple iPhone"
                                : "Linux Workstation / Web Container"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#2A2A2E]/50">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Apakah Anda yakin ingin keluar dari kabin penayangan operator?",
                      )
                    ) {
                      setShowAccountModal(false);
                      showToast(`Sesi ${username} telah ditutup.`, "info");
                      setTimeout(() => navigate("/"), 600);
                    }
                  }}
                  className="px-4 py-2 bg-rose-950/20 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Logout / Keluar Sesi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("cp_user_username", username);
                    localStorage.setItem("cp_user_role", userRole);
                    localStorage.setItem(
                      "cp_user_avatar_color",
                      userAvatarColor,
                    );
                    showToast("Profil Operator berhasil disimpan!", "success");
                    setShowAccountModal(false);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notifications */}
      <div
        id="toast-container"
        className="fixed bottom-12 right-6 z-[300] flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center space-x-3 pointer-events-auto max-w-sm ${
                toast.type === "success"
                  ? "bg-zinc-900 border-green-500/30 text-green-400"
                  : toast.type === "warn"
                    ? "bg-zinc-900 border-rose-500/30 text-rose-400"
                    : "bg-zinc-900 border-[#2A2A2E] text-blue-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${toast.type === "success" ? "bg-green-500" : toast.type === "warn" ? "bg-rose-500" : "bg-blue-500 animate-pulse"}`}
              />
              <span>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Media Library Dialog */}
      <AnimatePresence>
        {showMediaLibraryModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowMediaLibraryModal(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-6 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-[#2A2A2E]/50 mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Perpustakaan Media (Media Library)
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Pilih latar belakang visual, loop video rohani, atau
                      unggah aset media Anda sendiri.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMediaLibraryModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-850 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Library Grid */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6 custom-scrollbar">
                {/* 1. Guidance Callout */}
                <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-left">
                  <h4 className="text-[10px] font-black uppercase text-blue-400 mb-1 tracking-widest">
                    Folder Khusus Background (public/backgrounds/)
                  </h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                    Semua gambar &amp; video background disimpan dan dibaca langsung dari 1 folder khusus (<code className="text-blue-300">public/backgrounds/</code>) serta folder penyimpanan biner browser (tanpa ditulis menjadi kode). Letakkan file di folder tersebut sebelum deploy ke GitHub/Vercel, atau unggah langsung melalui tombol di bawah.
                  </p>
                </div>

                {/* 2. Drag-and-drop / Custom user uploads */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                      Media Unggahan Saya (Custom Uploads)
                    </h4>
                    <button
                      onClick={() => bgFileInputRef.current?.click()}
                      className="text-[9px] bg-emerald-650/25 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded text-emerald-400 font-bold uppercase tracking-wider transition-all"
                    >
                      Unggah File Baru
                    </button>
                  </div>

                  {[...customBackgrounds, ...customVideoBackgrounds].length ===
                  0 ? (
                    <div className="border border-dashed border-[#2A2A2E] p-8 rounded-xl bg-zinc-950/20 text-center">
                      <p className="text-xs text-gray-500">
                        Belum ada media kustom yang diunggah.
                      </p>
                      <p className="text-[10px] text-gray-650 mt-1">
                        Anda bisa menarik & menjatuhkan file gambar/video ke
                        panel kiri halaman dashboard, atau mengunggah lewat
                        tombol di atas.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {[...customBackgrounds, ...customVideoBackgrounds].map(
                        (bg, idx) => {
                          const isVid = isVideo(bg);
                          return (
                            <div
                              key={idx}
                              className="relative aspect-video group rounded-xl overflow-hidden border border-[#2A2A2E] bg-black"
                            >
                              {isVid ? (
                                <video
                                  src={resolveMedia(bg)}
                                  muted
                                  autoPlay
                                  loop
                                  playsInline
                                  className="w-full h-full object-cover opacity-80"
                                />
                              ) : (
                                <img
                                  src={resolveMedia(bg)}
                                  alt="custom"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setActiveBackground(bg);
                                    showToast(
                                      "Latar kustom diaktifkan",
                                      "success",
                                    );
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8px] font-black uppercase tracking-wider"
                                >
                                  Gunakan
                                </button>
                                <button
                                  onClick={() => {
                                    let nextImgs = customBackgrounds;
                                    let nextVids = customVideoBackgrounds;
                                    if (isVid) {
                                      nextVids = customVideoBackgrounds.filter((item) => item !== bg);
                                      setCustomVideoBackgrounds(nextVids);
                                    } else {
                                      nextImgs = customBackgrounds.filter((item) => item !== bg);
                                      setCustomBackgrounds(nextImgs);
                                    }

                                    savePersistentBackgrounds(currentAccountId, nextImgs, nextVids);

                                    // Clean up from browser OPFS/IndexedDB & dedicated backgrounds folder
                                    deleteMedia(bg);
                                    const cleanPath = extractMediaPath(bg);
                                    if (cleanPath) deleteMedia(cleanPath);
                                    const filename = bg.substring(bg.lastIndexOf("/") + 1);
                                    if (filename) deleteMedia(filename);

                                    if ((cleanPath || bg).includes("/backgrounds/")) {
                                      fetch(`/api/local-backgrounds?file=${encodeURIComponent(cleanPath || bg)}`, {
                                        method: "DELETE",
                                      }).catch(() => {});
                                    }

                                    showToast("Media berhasil dihapus", "info");
                                  }}
                                  className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[7px] font-bold text-gray-400">
                                {isVid ? "VIDEO" : "IMG"}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Close footer */}
              <div className="flex justify-end gap-2 pt-4 border-t border-[#2A2A2E]/50 mt-4">
                <button
                  onClick={() => setShowMediaLibraryModal(false)}
                  className="px-6 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-gray-450 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                >
                  Tutup Perpustakaan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Monitors & Sound Pad system Modal */}
      <AnimatePresence>
        {showAudioMonitorsModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowAudioMonitorsModal(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-6 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-[#2A2A2E]/50 mb-6">
                <div className="flex items-center gap-2.5">
                  <Mic2 className="w-5 h-5 text-blue-500 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                      Audio Monitor & Pad Konsol
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Pantau jaringan input audio aktif dan mainkan sound pad
                      suasana ibadah.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAudioMonitorsModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-850 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-5 gap-6">
                {/* Simulated VU Output meters */}
                <div className="col-span-2 bg-zinc-950/45 border border-[#2A2A2E] p-4 rounded-xl flex flex-col space-y-3">
                  <h4 className="text-[9px] font-black uppercase text-gray-400 tracking-wider">
                    Monitor Sinyal (VU Meters)
                  </h4>

                  {/* Channels list with bouncing anims */}
                  <div className="space-y-4">
                    {/* Channel 1 */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-450 uppercase">
                        <span>L/R Master Out</span>
                        <span className="font-mono text-blue-400">
                          -12.4 dB
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden flex gap-[1px]">
                        <div
                          className="h-full bg-blue-500 rounded-l"
                          style={{ width: "65%" }}
                        ></div>
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: "10%" }}
                        ></div>
                        <div
                          className="h-full bg-green-500 animate-pulse"
                          style={{ width: "5%" }}
                        ></div>
                      </div>
                    </div>

                    {/* Channel 2 */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-450 uppercase">
                        <span>Mik Pendeta (Mic-1)</span>
                        <span className="font-mono text-emerald-400 font-sans">
                          AKTIF
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 animate-pulse"
                          style={{ width: "38%" }}
                        ></div>
                      </div>
                    </div>

                    {/* Channel 3 */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-450 uppercase">
                        <span>Koor / Musik (Aux-1)</span>
                        <span className="font-mono text-gray-600">SENYAP</span>
                      </div>
                      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-750"
                          style={{ width: "5%" }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-[#2A2A2E] my-1" />

                  {/* Web Audio Context State */}
                  <div className="p-2 bg-zinc-950 rounded border border-white/5 flex items-center justify-between text-[8px] font-bold">
                    <span className="text-gray-500 uppercase">
                      Status Audio Engine:
                    </span>
                    <span className="text-emerald-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />{" "}
                      ONLINE
                    </span>
                  </div>
                </div>

                {/* Ambient Sound Pads player */}
                <div className="col-span-3 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">
                      Ambiance Church sound Pad
                    </h4>
                    <span className="text-[8px] text-gray-500 font-bold uppercase font-mono">
                      Pad Synthesizer
                    </span>
                  </div>

                  {/* Chord Options */}
                  <div className="grid grid-cols-4 gap-2">
                    {["C", "D", "E", "F", "G", "A", "B"].map((key) => (
                      <button
                        key={key}
                        onClick={() => playChurchPad(key)}
                        className={`py-3 rounded-lg border text-xs font-black uppercase tracking-wider transition-all duration-300 flex flex-col items-center justify-center ${
                          activePadKey === key
                            ? "bg-indigo-650 border-indigo-500 text-white shadow-lg shadow-indigo-650/35 ring-2 ring-indigo-500 scale-95"
                            : "bg-zinc-950/40 border-[#2A2A2E] hover:border-indigo-500/50 hover:text-white text-gray-400"
                        }`}
                      >
                        <span>{key} Major</span>
                        {activePadKey === key && (
                          <span className="flex justify-center gap-[2px] mt-1.5">
                            <span
                              className="w-[2px] h-2.5 bg-white rounded animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <span
                              className="w-[2px] h-2.5 bg-white rounded animate-bounce"
                              style={{ animationDelay: "0.3s" }}
                            />
                            <span
                              className="w-[2px] h-2.5 bg-white rounded animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Settings Row */}
                  <div className="p-3 bg-zinc-950/40 border border-[#2A2A2E] rounded-xl space-y-3">
                    {/* Volume Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-bold text-gray-450 uppercase">
                        <span>Volume Pad</span>
                        <span className="font-mono text-gray-400">
                          {Math.round(padVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={padVolume}
                        onChange={(e) =>
                          setPadVolume(parseFloat(e.target.value))
                        }
                        className="w-full accent-indigo-500 bg-zinc-850 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Pad styles choices */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-gray-450 uppercase tracking-wider block">
                        Gaya Suara (Tone Style)
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["Warm", "Cosmic", "Sub"] as const).map((style) => (
                          <button
                            key={style}
                            onClick={() => {
                              setPadStyle(style);
                              showToast(
                                `Gaya suara diset ke: ${style}`,
                                "info",
                              );
                            }}
                            className={`py-1 rounded text-[8px] font-black uppercase tracking-widest border transition-all ${
                              padStyle === style
                                ? "bg-indigo-600/15 border-indigo-500 text-indigo-400"
                                : "bg-zinc-900 border-[#2A2A2E] text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {style === "Warm"
                              ? "Warm Analog"
                              : style === "Cosmic"
                                ? "Cosmic Shimmer"
                                : "Sub Ambient"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pad control buttons */}
                  <div className="flex gap-2">
                    <button
                      disabled={!activePadKey}
                      onClick={() => stopChurchPad(true)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                        activePadKey
                          ? "bg-rose-950/20 text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white hover:border-rose-500"
                          : "bg-zinc-900 border-zinc-800/40 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Cinematic Fade-Out
                    </button>
                    <button
                      disabled={!activePadKey}
                      onClick={() => stopChurchPad(false)}
                      className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                        activePadKey
                          ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-gray-400"
                          : "bg-zinc-900 border-zinc-800/40 text-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Mati Seketika
                    </button>
                  </div>
                </div>
              </div>

              {/* Close Footer */}
              <div className="flex justify-end pt-4 mt-6 border-t border-[#2A2A2E]/50">
                <button
                  onClick={() => setShowAudioMonitorsModal(false)}
                  className="px-6 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-gray-450 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                >
                  Tutup Konsol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bible Database Modal */}
      <AnimatePresence>
        {showBibleDbModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowBibleDbModal(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-6 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden text-left"
            >
              <div className="flex justify-between items-center pb-4 border-b border-[#2A2A2E]/50 mb-4">
                <div className="flex items-center gap-2.5">
                  <Book className="w-5 h-5 text-red-500" />
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Database Alkitab (Bible Database)
                    </h3>
                    <p className="text-[10px] text-gray-500 text-left">
                      Impor terjemahan Alkitab kustom tipe JSON atau Teks Kustom Anda sendiri di sini.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBibleDbModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-850 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar text-xs">
                {/* Unified Import Section with beautiful Sub-tabs */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <h4 className="text-[10px] font-black uppercase text-red-500 tracking-widest text-left">
                      Metode Impor Alkitab
                    </h4>
                    <div className="flex flex-wrap gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                      <button
                        onClick={() => setBibleImportTab("text_raw")}
                        className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${bibleImportTab === "text_raw" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}
                      >
                        Teks Kustom
                      </button>
                      <button
                        onClick={() => setBibleImportTab("json")}
                        className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${bibleImportTab === "json" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"}`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

                  {/* 3. PLAIN TEXT / COPY PASTE */}
                  {bibleImportTab === "text_raw" && (
                    <div className="space-y-3 text-left">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">
                          Nama Alkitab Kustom
                        </label>
                        <input
                          id="text-bible-title-input"
                          type="text"
                          placeholder="misal: Alkitab Bahasa Batak"
                          className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-805 rounded-lg text-white font-extrabold focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-zinc-400 font-black uppercase tracking-wider flex justify-between">
                          <span>Tempel Teks Alkitab</span>
                          <span className="text-[8px] text-gray-500 font-bold normal-case">
                            Mendukung format 'Kitab Pasal:Ayat teks'
                          </span>
                        </label>
                        <textarea
                          id="text-bible-content-input"
                          placeholder="Yohanes 3:16 Karena begitu besar kasih Allah akan dunia ini...&#10;Yohanes 3:17 Sebab Allah mengutus Anak-Nya...&#10;Kejadian 1:1 Pada mulanya Allah menciptakan..."
                          rows={6}
                          className="w-full p-3 text-xs bg-zinc-900 border border-[#2A2A2E]/60 rounded-lg text-white font-mono leading-relaxed focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          const titleNode = document.getElementById(
                            "text-bible-title-input",
                          ) as HTMLInputElement;
                          const contentNode = document.getElementById(
                            "text-bible-content-input",
                          ) as HTMLTextAreaElement;
                          const title = titleNode?.value || "Kustom Teks";
                          const content = contentNode?.value || "";

                          if (!content.trim()) {
                            alert(
                              "Mohon tempel beberapa ayat Alkitab dalam format 'Kitab Pasal:Ayat Isi teks'.",
                            );
                            return;
                          }

                          const bibleObj = parseTextScripture(content, title);
                          if (bibleObj) {
                            const filtered = customBibles.filter(
                              (cb) => cb.id !== bibleObj.id,
                            );
                            const updated = [bibleObj, ...filtered];

                            const res = await fetch("/api/custom-bibles", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(updated),
                            });
                            if (res.ok) {
                              setCustomBibles(updated);
                              saveBiblesLocalStorage(updated);
                              setBibleVersion(bibleObj.id);
                              setShowBibleDbModal(false);
                              showToast(
                                `Alkitab Teks '${bibleObj.name}' sukses terpasang!`,
                                "success",
                              );
                            } else {
                              alert(
                                "Gagal mengunggah alkitab ke server database.",
                              );
                            }
                          } else {
                            alert(
                              "Format tidak cocok. Silakan tempel baris berformat: 'NamaKitab Pasal:Ayat Isi ayat' (Contoh: Kejadian 1:1 Pada mulanya...)",
                            );
                          }
                        }}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all"
                      >
                        Proses dan Pasang Alkitab Teks
                      </button>
                    </div>
                  )}

                  {/* 4. JSON RAW DATABASE IMPORT */}
                  {bibleImportTab === "json" && (
                    <div className="space-y-3">
                      <div
                        onClick={() => {
                          document
                            .getElementById("bible-db-upload-selector")
                            ?.click();
                        }}
                        className="border border-dashed border-[#2A2A2E] hover:border-red-500/30 p-6 rounded-2xl bg-[#141416]/20 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
                      >
                        <Book className="w-8 h-8 text-red-500/60 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-gray-300 text-xs">
                          Pilih atau Seret Berkas .json Alkitab
                        </span>
                        <p className="text-[9px] text-gray-500 mt-1 max-w-sm leading-normal">
                          Harus berupa objek JSON dengan struktur:{" "}
                          <code className="text-red-400 font-mono">
                            {
                              "{ id, name, books: { BookName: { ChapterNum: [Verses] } } }"
                            }
                          </code>
                        </p>
                        <input
                          id="bible-db-upload-selector"
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (event) => {
                                try {
                                  const text = event.target?.result as string;
                                  const parsedObj = tryParseAnyJsonBible(
                                    text,
                                    file.name,
                                  );
                                  if (parsedObj) {
                                    const cleanId = parsedObj.id
                                      .trim()
                                      .toLowerCase();
                                    const filtered = customBibles.filter(
                                      (cb) => cb.id !== cleanId,
                                    );
                                    const updated = [parsedObj, ...filtered];

                                    const res = await fetch(
                                      "/api/custom-bibles",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify(updated),
                                      },
                                    );
                                    if (res.ok) {
                                      setCustomBibles(updated);
                                      saveBiblesLocalStorage(updated);
                                      setBibleVersion(cleanId);
                                      setShowBibleDbModal(false);
                                      showToast(
                                        `Database Alkitab '${parsedObj.name}' sukses diimpor dan disesuaikan secara otomatis!`,
                                        "success",
                                      );
                                    } else {
                                      alert(
                                        "Gagal mengunggah alkitab ke server database.",
                                      );
                                    }
                                  } else {
                                    alert(
                                      "Format berkas JSON Alkitab tidak dikenal atau terstruktur salah. Pastikan minimal berisi nama-nama kitab, pasal, dan rangkaian ayat.",
                                    );
                                  }
                                } catch (err) {
                                  alert(
                                    "Gagal membaca atau mem-parsing file JSON Alkitab kustom.",
                                  );
                                }
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* List of Loaded Custom Databases */}
                {customBibles.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] font-black uppercase text-red-500 tracking-widest text-left">
                      Database Terpasang ({customBibles.length})
                    </h4>
                    <div className="space-y-2">
                      {customBibles.map((cb) => (
                        <div
                          key={cb.id}
                          className="flex justify-between items-center p-2.5 bg-[#141416]/50 rounded-lg border border-[#2A2A2E]/60 text-left"
                        >
                          <div className="text-left">
                            <p className="text-white font-extrabold text-xs text-left">
                              {cb.name}
                            </p>
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider text-left block">
                              KODE: {cb.id.toUpperCase()} •{" "}
                              {cb.bookNames
                                ? cb.bookNames.length
                                : cb.books
                                  ? Object.keys(cb.books).length
                                  : 0}{" "}
                              KITAB AKTIF
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const updated = customBibles.filter(
                                (item) => item.id !== cb.id,
                              );
                              setCustomBibles(updated);
                              saveBiblesLocalStorage(updated);
                              if (bibleVersion === cb.id) setBibleVersion("tb");
                              showToast(
                                `Database '${cb.name}' berhasil dihapus.`,
                                "success",
                              );
                            }}
                            className="p-1 hover:text-red-500 bg-red-500/10 text-red-400 rounded transition-colors"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t border-[#2A2A2E]/40 shrink-0">
                <button
                  onClick={() => setShowBibleDbModal(false)}
                  className="px-5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Song Database Modal */}
      <AnimatePresence>
        {showSongDbModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowSongDbModal(false)}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#111112] border border-[#2A2A2E] p-6 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden text-left"
            >
              <div className="flex justify-between items-center pb-4 border-b border-[#2A2A2E]/50 mb-3 text-left">
                <div className="flex items-center gap-2.5 text-left">
                  <ListMusic className="w-5 h-5 text-blue-500" />
                  <div className="text-left">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider text-left">
                      Database Nyanyian & Lagu (Song Database)
                    </h3>
                    <p className="text-[10px] text-gray-500 text-left">
                      Ekspansi perpustakaan lagu liturgi Anda secara massal
                      dengan berbagai metode impor instan.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSongDbModal(false)}
                  className="p-1 rounded-full hover:bg-zinc-850 text-gray-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="flex border-b border-[#2A2A2E]/50 mb-4 text-[10px] font-black uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setSongImportTab("raw_text")}
                  className={`flex-1 py-2 text-center transition-all ${songImportTab === "raw_text" ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/5" : "text-gray-500 hover:text-gray-300"}`}
                >
                  ✍️ Copy-Paste Lirik
                </button>
                <button
                  type="button"
                  onClick={() => setSongImportTab("files")}
                  className={`flex-1 py-2 text-center transition-all ${songImportTab === "files" ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/5" : "text-gray-500 hover:text-gray-300"}`}
                >
                  📁 Unggah (.txt / .json)
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar text-xs">
                {/* TAB 2: COPY-PASTE TEXT */}
                {songImportTab === "raw_text" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-blue-950/20 border border-blue-500/15 rounded-xl text-blue-400">
                      <p className="font-bold text-[11px] mb-1">
                        💡 Tips Sukses Impor Copy-Paste:
                      </p>
                      <p className="text-[10px] leading-relaxed opacity-90">
                        Anda bisa memasukkan banyak lagu sekaligus! Cukup
                        pisahkan tiap lagu memakai pembatas{" "}
                        <strong className="font-mono bg-blue-950/40 px-1 py-0.5 rounded text-white">
                          ---
                        </strong>{" "}
                        di baris baru. Sistem kami sangat cerdas dan akan
                        langsung menyusun judul & bait-bait lirik ke dalam
                        presentasi slide.
                      </p>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                        Tempel Teks Lirik Lagu Di Sini:
                      </label>
                      <textarea
                        value={rawTextPaste}
                        onChange={(e) => setRawTextPaste(e.target.value)}
                        placeholder={`Contoh Format Sederhana:
Satu Hal yang Kurindu
True Worshippers

Satu hal yang kurindu
Berdiam di dalam rumah-Mu

Tuk memandang wajah-Mu
Dan memuji nama-Mu
---
Contoh Format Dengan Label:
Judul: Nyanyi Bagi Dia
Artis: GMS Live

Slide 1
Angkatlah suaramu
Nyanyi bagi Dia

Slide 2
Haleluya pujilah Dia...`}
                        className="w-full h-56 bg-[#141416] border border-[#2A2A2E] rounded-xl p-4 text-[11px] font-mono focus:outline-none focus:border-blue-500 text-white placeholder-gray-700 leading-relaxed overflow-y-auto"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!rawTextPaste.trim()) {
                            showToast("Gagal: Lirik masih kosong.", "warn");
                            return;
                          }
                          setIsAiParsingSongs(true);
                          try {
                            const res = await fetch("/api/ai/parse-songs", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ text: rawTextPaste }),
                            });
                            const ct = res.headers.get("content-type") || "";
                            if (!res.ok) {
                              if (ct.includes("application/json")) {
                                const errData = await res.json();
                                throw new Error(
                                  errData.error ||
                                    "Gagal merapikan lirik dengan AI.",
                                );
                              }
                              throw new Error(
                                "Layanan AI server tidak tersedia di mode statis.",
                              );
                            }
                            if (!ct.includes("application/json")) {
                              throw new Error(
                                "Layanan AI server tidak tersedia di mode statis.",
                              );
                            }
                            const parsedSongs = await res.json();
                            if (parsedSongs.length > 0) {
                              const incomingTitles = new Set(
                                parsedSongs.map((s: any) =>
                                  s.title.toLowerCase(),
                                ),
                              );
                              const filtered = librarySongs.filter(
                                (s) =>
                                  s &&
                                  s.title &&
                                  !incomingTitles.has(s.title.toLowerCase()),
                              );
                              const updated = [...parsedSongs, ...filtered];
                              setRawTextPaste("");
                              saveAndApplyImportedSongs(
                                updated,
                                `${parsedSongs.length} Lagu sukses dirapikan & diimpor oleh AI!`,
                              );
                            } else {
                              showToast(
                                "AI tidak mendeteksi lagu apa pun dalam teks tersebut.",
                                "warn",
                              );
                            }
                          } catch (err: any) {
                            showToast(
                              `Galat: ${err.message || "Gagal memproses dengan AI."}`,
                              "warn",
                            );
                          } finally {
                            setIsAiParsingSongs(false);
                          }
                        }}
                        disabled={isAiParsingSongs}
                        className="py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-md shadow-violet-950/40 cursor-pointer"
                      >
                        {isAiParsingSongs ? (
                          <>
                            <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                            Sedang Diproses AI...
                          </>
                        ) : (
                          <>✨ Rapikan dengan AI</>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!rawTextPaste.trim()) {
                            showToast("Gagal: Lirik masih kosong.", "warn");
                            return;
                          }
                          const parsed = parseTextSongs(rawTextPaste);
                          if (parsed.length > 0) {
                            const incomingTitles = new Set(
                              parsed
                                .filter((s) => s && s.title)
                                .map((s) => s.title.toLowerCase()),
                            );
                            const filtered = librarySongs.filter(
                              (s) =>
                                s &&
                                s.title &&
                                !incomingTitles.has(s.title.toLowerCase()),
                            );
                            const updated = [...parsed, ...filtered];
                            setRawTextPaste("");
                            saveAndApplyImportedSongs(
                              updated,
                              `${parsed.length} Lagu sukses diekstrak & diimpor dari teks!`,
                            );
                          } else {
                            showToast(
                              "Gagal mengekstrak lagu. Silakan pastikan baris pertama memiliki judul lagu.",
                              "warn",
                            );
                          }
                        }}
                        disabled={isAiParsingSongs}
                        className="py-2.5 bg-zinc-850 hover:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        ⚡ Ekstrak Standar
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: FILE UPLOAD (.TXT / .JSON) */}
                {songImportTab === "files" && (
                  <div className="space-y-4">
                    {/* JSON Import Card */}
                    <div className="space-y-2 text-left">
                      <h4 className="text-[10px] font-black uppercase text-blue-400 tracking-widest">
                        Impor Backup Kumpulan Lagu Basis Data (JSON)
                      </h4>
                      <p className="text-[10px] text-gray-500 leading-normal mb-1">
                        Gunakan metode ini untuk memulihkan atau mengimpor
                        cadangan lagu yang berformat array JSON standar.
                      </p>
                      <div
                        onClick={() => {
                          document
                            .getElementById("song-db-upload-selector")
                            ?.click();
                        }}
                        className="border border-dashed border-[#2A2A2E] hover:border-blue-500/30 p-5 rounded-2xl bg-[#141416]/20 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
                      >
                        <ListMusic className="w-8 h-8 text-blue-500/60 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-gray-300 text-xs">
                          Pilih atau Seret Berkas .json Kumpulan Lagu
                        </span>
                        <p className="text-[9px] text-gray-500 mt-1 max-w-sm leading-normal">
                          Harus berupa berkas JSON array yang memiliki struktur:{" "}
                          <code className="text-blue-400 font-mono">
                            {
                              "[ { title, artist, verses: [], verseLabels: [] } ]"
                            }
                          </code>
                        </p>
                        <input
                          id="song-db-upload-selector"
                          type="file"
                          accept=".json"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              const allParsedSongs: Song[] = [];

                              for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                await new Promise<void>((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    try {
                                      const text = event.target
                                        ?.result as string;
                                      const parsed = JSON.parse(text);
                                      if (Array.isArray(parsed)) {
                                        const validSongs = parsed.filter(
                                          (s) =>
                                            s &&
                                            s.title &&
                                            Array.isArray(s.verses),
                                        );
                                        allParsedSongs.push(...validSongs);
                                      } else if (
                                        parsed &&
                                        typeof parsed === "object"
                                      ) {
                                        if (
                                          parsed.title &&
                                          Array.isArray(parsed.verses)
                                        ) {
                                          allParsedSongs.push(parsed);
                                        }
                                      }
                                    } catch (err) {
                                      console.error(
                                        "Gagal membaca file JSON:",
                                        file.name,
                                        err,
                                      );
                                    }
                                    resolve();
                                  };
                                  reader.onerror = () => {
                                    resolve();
                                  };
                                  reader.readAsText(file);
                                });
                              }

                              if (allParsedSongs.length > 0) {
                                // Deduplicate by title to ensure tidy database (tidak berantakan)
                                const uniqueImportedSongs: Song[] = [];
                                const seenTitles = new Set<string>();
                                for (const song of allParsedSongs) {
                                  if (!song || !song.title) continue;
                                  const normalizedTitle = song.title
                                    .trim()
                                    .toLowerCase();
                                  if (!seenTitles.has(normalizedTitle)) {
                                    seenTitles.add(normalizedTitle);
                                    uniqueImportedSongs.push(song);
                                  }
                                }

                                const titlesToReplace = new Set(
                                  uniqueImportedSongs.map((s) =>
                                    s.title.toLowerCase(),
                                  ),
                                );
                                const filtered = librarySongs.filter(
                                  (s) =>
                                    s &&
                                    s.title &&
                                    !titlesToReplace.has(s.title.toLowerCase()),
                                );
                                const updated = [
                                  ...uniqueImportedSongs,
                                  ...filtered,
                                ];
                                saveAndApplyImportedSongs(
                                  updated,
                                  `${uniqueImportedSongs.length} Lagu sukses diimpor dari ${files.length} berkas JSON!`,
                                );
                              } else {
                                alert(
                                  "Berkas JSON harus berupa daftar lagu valid yang memiliki atribut 'title' dan 'verses'.",
                                );
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="h-px bg-[#2A2A2E]/30 my-4" />

                    {/* TXT Import Card */}
                    <div className="space-y-2 text-left">
                      <h4 className="text-[10px] font-black uppercase text-pink-400 tracking-widest">
                        Impor Lagu Massal dari Berkas Teks (.txt)
                      </h4>
                      <p className="text-[10px] text-gray-500 leading-normal mb-1">
                        Punya kumpulan lirik yang dicetak ke dalam file TXT dari
                        EasyWorship atau Notepad? Unggah berkasnya di sini untuk
                        langsung mengimpornya secara massal (bisa pilih banyak
                        file sekaligus!).
                      </p>

                      <div
                        onClick={() => {
                          document
                            .getElementById("song-txt-upload-selector")
                            ?.click();
                        }}
                        className="border border-dashed border-[#2A2A2E] hover:border-pink-500/30 p-5 rounded-2xl bg-[#141416]/20 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
                      >
                        <FileText className="w-8 h-8 text-pink-500/60 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-gray-300 text-xs">
                          Pilih Berkas Dokumen Teks (.txt)
                        </span>
                        <p className="text-[9px] text-gray-500 mt-1 max-w-sm leading-normal">
                          Berkas teks baris per baris. Tiap lagu dipisahkan
                          dengan tanda hubung{" "}
                          <code className="text-pink-400 font-mono">---</code>.
                          Bisa unggah banyak file sekaligus!
                        </p>
                        <input
                          id="song-txt-upload-selector"
                          type="file"
                          accept=".txt"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              const allParsedSongs: Song[] = [];

                              for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                await new Promise<void>((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    try {
                                      const text = event.target
                                        ?.result as string;
                                      const parsed = parseTextSongs(text);
                                      if (parsed && parsed.length > 0) {
                                        allParsedSongs.push(...parsed);
                                      } else {
                                        // Fallback if it's a completely raw unstructured txt: treat as one song with file name as title
                                        const cleanText = text.trim();
                                        if (cleanText) {
                                          const fileNameNoExt =
                                            file.name.replace(/\.[^/.]+$/, "");
                                          allParsedSongs.push({
                                            id: `txt-song-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                            title: fileNameNoExt,
                                            artist: "Impor File Teks",
                                            verses: [cleanText],
                                            verseLabels: ["Bait 1"],
                                            updatedAt: Date.now(),
                                          } as any);
                                        }
                                      }
                                    } catch (err) {
                                      console.error(
                                        "Gagal membaca file TXT:",
                                        file.name,
                                        err,
                                      );
                                    }
                                    resolve();
                                  };
                                  reader.onerror = () => {
                                    resolve();
                                  };
                                  reader.readAsText(file);
                                });
                              }

                              if (allParsedSongs.length > 0) {
                                // Deduplicate by title to ensure tidy database (tidak berantakan)
                                const uniqueImportedSongs: Song[] = [];
                                const seenTitles = new Set<string>();
                                for (const song of allParsedSongs) {
                                  if (!song || !song.title) continue;
                                  const normalizedTitle = song.title
                                    .trim()
                                    .toLowerCase();
                                  if (!seenTitles.has(normalizedTitle)) {
                                    seenTitles.add(normalizedTitle);
                                    uniqueImportedSongs.push(song);
                                  }
                                }

                                const titlesToReplace = new Set(
                                  uniqueImportedSongs.map((s) =>
                                    s.title.toLowerCase(),
                                  ),
                                );
                                const filtered = librarySongs.filter(
                                  (s) =>
                                    s &&
                                    s.title &&
                                    !titlesToReplace.has(s.title.toLowerCase()),
                                );

                                const updated = [
                                  ...uniqueImportedSongs,
                                  ...filtered,
                                ];
                                saveAndApplyImportedSongs(
                                  updated,
                                  `${uniqueImportedSongs.length} Lagu sukses diekstrak & diimpor dari ${files.length} berkas TXT!`,
                                );
                              } else {
                                alert(
                                  "Gagal mengekstrak lirik dari berkas teks yang diunggah. Pastikan isi dokumen memiliki format judul dan lirik.",
                                );
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t border-[#2A2A2E]/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSongDbModal(false)}
                  className="px-5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-[#1c1c1f] text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {contextMenu.show && (
        <div
          className="fixed z-[500] bg-[#111112]/95 backdrop-blur-md border border-[#2A2A2E] rounded-lg shadow-2xl py-1 w-52 text-[11px] font-sans text-gray-300 pointer-events-auto"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => {
            e.stopPropagation();
            setContextMenu((prev) => ({ ...prev, show: false }));
          }}
        >
          {contextMenu.type === "library_song" && (
            <>
              <button
                onClick={() => addToSchedule(contextMenu.data)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-b border-zinc-800/40 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" /> Tambah ke Jadwal
              </button>
              <button
                onClick={() => setSelectedSong(contextMenu.data)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Presentation className="w-3 h-3 text-blue-400" /> Live
                Presentasi
              </button>
              <button
                onClick={() =>
                  setEditingItem({ ...contextMenu.data, type: "song" } as any)
                }
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-blue-400" /> Desain & Edit
                Konten
              </button>
              <button
                onClick={() => {
                  const updated = [
                    {
                      ...contextMenu.data,
                      id: `song-dup-${Date.now()}`,
                      title: `${contextMenu.data.title} (Salinan)`,
                      updatedAt: Date.now(),
                    },
                    ...librarySongs,
                  ];
                  setLibrarySongs(updated);
                  savePersistentSongs(currentAccountId, updated);
                  showToast("Lagu diduplikasi ke Perpustakaan.", "success");
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3 text-zinc-400" /> Duplikat Lagu
              </button>
              {!contextMenu.data.id.includes("bible") &&
                contextMenu.data.id !== "1" &&
                contextMenu.data.id !== "2" &&
                contextMenu.data.id !== "3" && (
                  <button
                    onClick={(e) =>
                      deleteSongFromLibrary(contextMenu.data, e as any)
                    }
                    className="w-full text-left px-3 py-1.5 hover:bg-red-650 hover:text-white flex items-center gap-2 text-rose-400 transition-colors border-t border-zinc-800/40 cursor-pointer"
                  >
                    <Trash className="w-3 h-3 text-rose-400" /> Hapus Lagu
                    Database
                  </button>
                )}
            </>
          )}

          {contextMenu.type === "schedule_item" && (
            <>
              <button
                onClick={() => setSelectedSong(contextMenu.data as any)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 text-emerald-400" /> Tampilkan di
                Presenter
              </button>
              {(contextMenu.data.id?.startsWith("presentation-") ||
                contextMenu.data.songId?.startsWith("presentation-") ||
                contextMenu.data.type === "presentation" ||
                contextMenu.data.type === "slide") && (
                <button
                  onClick={() => {
                    const item = contextMenu.data;
                    const existingId = item.songId || item.id;
                    const alreadyExists = libraryPresentations.some(
                      (p) => p.id === existingId || p.title === item.title
                    );
                    if (alreadyExists) {
                      showToast("Presentasi ini sudah ada di daftar Present!", "info");
                      return;
                    }

                    const newPres: Song = {
                      id: existingId.startsWith("presentation-") ? existingId : `presentation-${Date.now()}`,
                      title: item.title,
                      verses: [...item.verses],
                      verseLabels: item.verseLabels ? [...item.verseLabels] : undefined,
                      textColor: item.textColor,
                      fontSizeMode: item.fontSizeMode,
                      fontSize: item.fontSize,
                      textAlign: item.textAlign,
                      textPosition: item.textPosition,
                      textBold: item.textBold,
                      textItalic: item.textItalic,
                      textShadow: item.textShadow,
                      fontFamily: item.fontFamily,
                      textTransform: item.textTransform,
                      backgroundOverride: item.backgroundOverride,
                      shapeDecoration: item.shapeDecoration,
                      textTracking: item.textTracking,
                      textSpacing: item.textSpacing,
                      slideTransition: item.slideTransition,
                      textOutline: item.textOutline,
                      textOutlineColor: item.textOutlineColor,
                      bgOpacity: item.bgOpacity,
                      bgBrightness: item.bgBrightness,
                      bgBlur: item.bgBlur,
                      bgFit: item.bgFit,
                      bgScale: item.bgScale,
                      bgPositionX: item.bgPositionX,
                      bgPositionY: item.bgPositionY,
                      logoUrl: item.logoUrl,
                      logoPosition: item.logoPosition,
                      logoLeftUrl: item.logoLeftUrl,
                      logoRightUrl: item.logoRightUrl,
                      textWidth: item.textWidth,
                      textHeight: item.textHeight,
                      textLeft: item.textLeft,
                      textTop: item.textTop,
                    };

                    setLibraryPresentations((prev) => [newPres, ...prev]);
                    showToast("Berhasil ditambahkan ke daftar Present!", "success");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer border-b border-zinc-800/40"
                >
                  <Presentation className="w-3 h-3 text-emerald-400" /> Tambah ke Present
                </button>
              )}
              <button
                onClick={() => setEditingItem(contextMenu.data)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-b border-zinc-800/40 cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-blue-400" /> Edit Item Jadwal
                Ini
              </button>
              <button
                onClick={() => {
                  const newItem = {
                    ...contextMenu.data,
                    id: `schedule-dup-${Date.now()}`,
                    title: `${contextMenu.data.title} (Dup)`,
                  };
                  const updated = [...schedule, newItem];
                  setSchedule(updated);
                  localStorage.setItem(
                    "cp_service_schedule",
                    JSON.stringify(updated),
                  );
                  showToast("Jadwal lagu diduplikasi.", "success");
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3 text-zinc-450" /> Duplikat Item
              </button>
              <button
                onClick={(e) =>
                  removeFromSchedule(contextMenu.data.id, e as any)
                }
                className="w-full text-left px-3 py-1.5 hover:bg-red-650 hover:text-white flex items-center gap-2 text-rose-400 transition-colors cursor-pointer"
              >
                <Trash className="w-3 h-3 text-rose-400" /> Hapus Dari Jadwal
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Apakah Anda yakin ingin mengosongkan seluruh rencana jadwal ibadah ini?",
                    )
                  ) {
                    setSchedule([]);
                    localStorage.setItem(
                      "cp_service_schedule",
                      JSON.stringify([]),
                    );
                    showToast("Seluruh rencana jadwal dikosongkan.", "info");
                  }
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-700 hover:text-white flex items-center gap-2 text-red-500 transition-colors border-t border-zinc-800/40 cursor-pointer"
              >
                <XCircle className="w-3 h-3 text-rose-500" /> Kosongkan Rencana
                Jadwal
              </button>
            </>
          )}

          {contextMenu.type === "slide_item" && (
            <>
              <button
                onClick={() => {
                  const sIdx = contextMenu.data.idx;
                  const verses = selectedSong?.verses || [];
                  const labels = selectedSong?.verseLabels || [];
                  const isBible =
                    selectedSong?.id.startsWith("bible-") ||
                    (selectedSong as any)?.type === "bible";
                  const bibleVerseNum = getBibleVerseLabel(labels, sIdx);
                  const displayContent = isBible
                    ? `${bibleVerseNum}. ${verses[sIdx]}`
                    : verses[sIdx];
                  const displayTitle = isBible
                    ? `${selectedSong?.title.split(":")[0]}:${bibleVerseNum}`
                    : selectedSong?.title;
                  handleVerseClick(
                    displayContent,
                    displayTitle || "",
                    selectedSong?.id,
                    sIdx,
                  );
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-b border-zinc-800/40 cursor-pointer font-extrabold"
              >
                <Play className="w-3 h-3 text-emerald-400" /> Live Sekarang (Go
                Live)
              </button>
              <button
                onClick={() => {
                  if (selectedSong) {
                    const item = schedule.find(
                      (s) => s.songId === selectedSong.id,
                    ) || {
                      id: selectedSong.id,
                      title: selectedSong.title,
                      artist: selectedSong.artist || "Unknown",
                      type: selectedSong.id.startsWith("bible-")
                        ? "bible"
                        : "song",
                      verses: [...selectedSong.verses],
                    };
                    setEditingItem(item as ScheduleItem);
                  }
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3 h-3 text-blue-400" /> Desain Sesi Builder
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.data.verse);
                  showToast("Lirik bait disalin ke papan klip.", "success");
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3 text-zinc-400" /> Salin Teks Lirik
              </button>
              <button
                onClick={() => {
                  setLowerThirdMode(!lowerThirdMode);
                  showToast(
                    `Lower Third ${!lowerThirdMode ? "Aktif" : "Nonaktif"}`,
                    "info",
                  );
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-t border-zinc-800/40 cursor-pointer"
              >
                <Layers className="w-3 h-3 text-blue-400" /> Toggle Lower Third
              </button>
            </>
          )}

          {contextMenu.type === "live_preview" && (
            <>
              <button
                onClick={() => toggleMasterOverride("black")}
                className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 fill-red-500 text-red-500" />{" "}
                Standby Layar Hitam (Black)
              </button>
              <button
                onClick={() => toggleMasterOverride("logo")}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3 h-3 text-emerald-400" /> Tampilkan Logo
                Standby
              </button>
              <button
                onClick={() => toggleMasterOverride("clear")}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors border-b border-zinc-800/40 cursor-pointer"
              >
                <Lock className="w-3 h-3 text-blue-400" /> Kosongkan Teks
                Lirik (Clear)
              </button>
              <button
                onClick={() => {
                  setLowerThirdMode(!lowerThirdMode);
                  showToast(
                    `Lower Third format disetel ke ${!lowerThirdMode ? "ON" : "OFF"}`,
                    "info",
                  );
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Layers className="w-3 h-3 text-blue-450" /> Mode Lower Third
              </button>
              <button
                onClick={() => {
                  const col =
                    chromaKeyColor === "green" ? "transparent" : "green";
                  setChromaKeyColor(col);
                  showToast(`Warna chroma-key diubah ke ${col}`, "info");
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3 text-zinc-350" /> Chroma Key:{" "}
                {chromaKeyColor === "green" ? "Transparent" : "Hijau"}
              </button>
              <button
                onClick={() => {
                  setMasterOverride(null);
                  showToast("Kembali ke Presentasi Normal.", "success");
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center gap-2 transition-colors border-t border-zinc-800/40 cursor-pointer"
              >
                <Play className="w-3 h-3 text-emerald-400" /> Off Override
                (Tampilkan Live)
              </button>
            </>
          )}
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-[#161618] border-t border-[#2A2A2E] px-4 flex items-center justify-between text-[10px] text-gray-500 font-bold tracking-tighter shrink-0 select-none">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <span className="text-gray-600">CPU</span>
            <div className="w-12 h-1.5 bg-[#0A0A0B] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${cpuVal}%` }}
              ></div>
            </div>
            <span className="text-gray-400 font-mono text-[9px] w-6 shrink-0">
              {cpuVal}%
            </span>
          </div>
          <span className="font-mono">FPS: {fpsVal.toFixed(2)}</span>
          <span className="font-mono text-zinc-400">
            MEMORY: {memVal.toFixed(2)} GB / 8.0 GB
          </span>

          <div className="hidden lg:flex items-center space-x-1.5 px-2 py-0.5 bg-red-950/40 border border-red-500/20 text-red-500 rounded-md text-[8.5px] uppercase tracking-wider font-extrabold shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
            <Copy className="w-3 h-3 text-red-500" />
            <span className="text-zinc-300 font-black">
              DILARANG MENDUPLIKAT APLIKASI
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[9.5px]">
          <span className="text-zinc-400 font-medium">App Developer :</span>
          <span className="text-blue-400 font-black uppercase tracking-tight">
            Pirma Siahaan
          </span>
          <span className="text-zinc-600 font-light">|</span>
          <span className="text-zinc-400 font-medium font-mono">
            Email : pirmasiahaan1234@gmail.com
          </span>
        </div>

        <div className="flex items-center space-x-6 text-gray-600">
          <span className="hidden xl:inline">OUTPUT: 1920x1080 (PRIMARY)</span>
          <span className="font-mono">v1.2.0-STABLE</span>
        </div>
      </footer>
    </div>
  );
}
