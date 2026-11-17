import { ScheduleItem, Song } from "../types";
import {
  BIBLE_BOOKS,
  BIBLE_BOOKS_BATAK,
  resolveCanonicalIndoBook,
} from "../constants/bible";

export const HKBP_SOURCE_URLS = {
  alkitab: "https://hkbp.or.id/alkitab",
  bukuEnde: "https://hkbp.or.id/buku-ende",
  bukuNyanyian: "https://hkbp.or.id/buku-nyanyian",
} as const;

const HKBP_CDN_BASE = "https://cdn.jsdelivr.net/gh/pandapotan/ktb@main";

export interface HkbpBookMeta {
  nomor_urut: number;
  indonesia: string;
  batak: string;
  inggris: string;
  jumlah_chapter: number;
  jumlah_ayat_per_pasal?: number[];
  perjanjian: "PL" | "PB";
}

export interface HkbpBibleChapterResult {
  bookIndo: string;
  bookDisplay: string;
  chapter: number;
  version: "tb" | "toba";
  verses: string[];
  verseNumbers: number[];
  pericopes: Record<number, string[]>;
}

export interface HkbpSongCatalogItem {
  nomorLagu: string;
  numberNum: number;
  judul: string;
  songbook: "be" | "bn";
  tonalitas?: string;
  nomorBukuLagu?: string;
}

interface RawHkbpLyricBlock {
  type?: string;
  lines?: string[];
}

// In-memory caches for instant navigation without re-fetching
let cachedBooksMeta: HkbpBookMeta[] | null = null;
const bibleChapterCache = new Map<string, HkbpBibleChapterResult>();
const songCatalogCache = new Map<"be" | "bn", HkbpSongCatalogItem[]>();
const cdnSongMapCache = new Map<"be" | "bn", Record<string, any>>();
const songDetailCache = new Map<string, Song>();

function getBookSlug(bookName: string): string {
  const canonical = resolveCanonicalIndoBook(bookName);
  return canonical.replace(/\s+/g, "");
}

export async function fetchHkbpBibleBooks(): Promise<HkbpBookMeta[]> {
  if (cachedBooksMeta) return cachedBooksMeta;
  try {
    const res = await fetch(`${HKBP_CDN_BASE}/buku-v1.0.0.json`);
    if (res.ok) {
      const data = await res.json();
      const pl = (data.perjanjian_lama || []).map((b: any) => ({
        ...b,
        perjanjian: "PL" as const,
      }));
      const pb = (data.perjanjian_baru || []).map((b: any) => ({
        ...b,
        perjanjian: "PB" as const,
      }));
      const combined = [...pl, ...pb];
      if (combined.length > 0) {
        cachedBooksMeta = combined;
        return combined;
      }
    }
  } catch {}

  // Fallback to static constant list
  const fallback = BIBLE_BOOKS.map((indo, idx) => ({
    nomor_urut: idx + 1,
    indonesia: indo,
    batak: BIBLE_BOOKS_BATAK[indo] || indo,
    inggris: indo,
    jumlah_chapter: 150,
    perjanjian: (idx < 39 ? "PL" : "PB") as "PL" | "PB",
  }));
  cachedBooksMeta = fallback;
  return fallback;
}

/**
 * Fetches an entire chapter from HKBP Alkitab (`https://hkbp.or.id/alkitab`),
 * cleanly separating Judul Perikop (`type: "title"`) from actual Bible verses (`type: "content"`).
 */
export async function fetchHkbpBibleChapter(
  bookName: string,
  chapter: number,
  version: "tb" | "toba",
): Promise<HkbpBibleChapterResult> {
  const canonicalIndo = resolveCanonicalIndoBook(bookName);
  const slug = getBookSlug(canonicalIndo);
  const safeChapter = Math.max(1, Math.floor(Number(chapter) || 1));
  const cacheKey = `${version}:${slug}:${safeChapter}`;

  const cached = bibleChapterCache.get(cacheKey);
  if (cached) return cached;

  const url = `${HKBP_CDN_BASE}/bib/${version}/book/${encodeURIComponent(slug)}/${safeChapter}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Pasal ${safeChapter} untuk kitab ${bookName} (${version === "toba" ? "Batak Toba" : "Bahasa Indonesia"}) tidak ditemukan di HKBP Alkitab.`,
    );
  }

  const rawData = await res.json();
  const rawEntries: Array<{ verse?: number; text?: string; type?: string }> =
    Array.isArray(rawData?.verses) ? rawData.verses : [];

  if (rawEntries.length === 0) {
    throw new Error(`Data ayat kosong untuk ${bookName} ${safeChapter}.`);
  }

  const verses: string[] = [];
  const verseNumbers: number[] = [];
  const pericopes: Record<number, string[]> = {};

  for (const entry of rawEntries) {
    const cleanText = String(entry?.text || "").trim();
    if (!cleanText) continue;

    const vNum = Number(entry?.verse) || (verseNumbers.length + 1);
    const entryType = String(entry?.type || "content").toLowerCase();

    if (entryType === "title" || entryType === "pericope" || entryType === "heading") {
      // Strictly keep Judul Perikop separate from verses
      if (!pericopes[vNum]) pericopes[vNum] = [];
      pericopes[vNum].push(cleanText);
    } else {
      verses.push(cleanText);
      verseNumbers.push(vNum);
    }
  }

  if (verses.length === 0) {
    throw new Error(`Tidak ada isi ayat ditemukan untuk ${bookName} ${safeChapter}.`);
  }

  const bookDisplay =
    version === "toba"
      ? BIBLE_BOOKS_BATAK[canonicalIndo] || canonicalIndo
      : canonicalIndo;

  const result: HkbpBibleChapterResult = {
    bookIndo: canonicalIndo,
    bookDisplay,
    chapter: safeChapter,
    version,
    verses,
    verseNumbers,
    pericopes,
  };

  bibleChapterCache.set(cacheKey, result);
  return result;
}

async function fetchCdnSongCollection(bookType: "be" | "bn"): Promise<Record<string, any>> {
  const cached = cdnSongMapCache.get(bookType);
  if (cached) return cached;

  const filename = bookType === "be" ? "BE-v1.0.0.json" : "BN-v1.0.0.json";
  const res = await fetch(`${HKBP_CDN_BASE}/${filename}`);
  if (!res.ok) {
    throw new Error(`Gagal memuat database ${bookType.toUpperCase()} dari sumber HKBP.`);
  }
  const data = (await res.json()) as Record<string, any>;
  cdnSongMapCache.set(bookType, data);
  return data;
}

function cleanHkbpSongTitle(rawTitle: string, songbook: "be" | "bn", nomorLagu: string): string {
  const prefixRegex = new RegExp(`^${songbook}\\s*${nomorLagu}\\s*[-:.]?\\s*`, "i");
  const trimmed = (rawTitle || "").trim().replace(prefixRegex, "").trim();
  return trimmed || `No. ${nomorLagu}`;
}

/**
 * Fetches full catalog list for Buku Ende (`be`) or Buku Nyanyian HKBP (`bn`)
 * from `https://hkbp.or.id/buku-ende` or `https://hkbp.or.id/buku-nyanyian`.
 */
export async function fetchHkbpSongCatalog(
  bookType: "be" | "bn",
): Promise<HkbpSongCatalogItem[]> {
  const cached = songCatalogCache.get(bookType);
  if (cached && cached.length > 0) return cached;

  const apiPath = bookType === "be" ? "buku-ende/songs" : "buku-nyanyian/songs";

  // 1. Try live HKBP portal API via backend proxy (`/api/hkbp`)
  try {
    const res = await fetch(`/api/hkbp?endpoint=${encodeURIComponent(apiPath)}`);
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const mapped: HkbpSongCatalogItem[] = list.map((item: any) => {
          const nomorStr = String(item.nomorLagu ?? item.number ?? "").trim();
          const numMatch = nomorStr.match(/\d+/);
          return {
            nomorLagu: nomorStr,
            numberNum: numMatch ? parseInt(numMatch[0], 10) : 99999,
            judul: cleanHkbpSongTitle(String(item.judul || ""), bookType, nomorStr),
            songbook: bookType,
            tonalitas: item.tonalitas || undefined,
            nomorBukuLagu: item.nomorBukuLagu ? String(item.nomorBukuLagu) : undefined,
          };
        });
        mapped.sort((a, b) => a.numberNum - b.numberNum || a.nomorLagu.localeCompare(b.nomorLagu));
        songCatalogCache.set(bookType, mapped);
        return mapped;
      }
    }
  } catch {}

  // 2. CORS-free fallback directly from HKBP's official CDN dataset
  const cdnMap = await fetchCdnSongCollection(bookType);
  const items: HkbpSongCatalogItem[] = Object.values(cdnMap).map((entry: any) => {
    const nomorStr = String(entry?.number ?? "").trim();
    const numMatch = nomorStr.match(/\d+/);
    return {
      nomorLagu: nomorStr,
      numberNum: numMatch ? parseInt(numMatch[0], 10) : 99999,
      judul: cleanHkbpSongTitle(String(entry?.title || ""), bookType, nomorStr),
      songbook: bookType,
      tonalitas: entry?.keySignature || undefined,
      nomorBukuLagu: entry?.originalNumber ? String(entry.originalNumber) : undefined,
    };
  });

  items.sort((a, b) => a.numberNum - b.numberNum || a.nomorLagu.localeCompare(b.nomorLagu));
  songCatalogCache.set(bookType, items);
  return items;
}

function formatSongIntroTitle(rawTitle: string): string {
  const cleaned = String(rawTitle || "")
    .trim()
    .replace(/^((?:BE|BN|KJ|PKJ|NKB|NR|KPKA|DSL)\s+[0-9]+[a-z]?)[.:]\s*/i, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.toUpperCase();
}

function hasExplicitVerseNumberPrefix(text: string): boolean {
  const firstLine = (String(text || "").trim().split(/\r?\n/)[0] || "").trim();
  return /^\d+\s*\.?$/.test(firstLine) || /^\d+[.)]\s+\S/.test(firstLine);
}

function hasExplicitReffPrefix(text: string): boolean {
  const firstLine = (String(text || "").trim().split(/\r?\n/)[0] || "").trim();
  return (
    /^(?:reff|reffrain|refrain|chorus)\.?$/i.test(firstLine) ||
    /^(?:reff|reffrain|refrain|chorus)[:.\-]\s+\S/i.test(firstLine)
  );
}

function formatVerseTextWithNumber(text: string, verseNumber: number): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return `${verseNumber}`;
  if (hasExplicitVerseNumberPrefix(trimmed)) return trimmed;
  return `${verseNumber}\n${trimmed}`;
}

function formatReffText(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "Reff";
  if (hasExplicitReffPrefix(trimmed)) return trimmed;
  return `Reff\n${trimmed}`;
}

/**
 * Ensures any Song or Song ScheduleItem has:
 * 1) Slide 1: Song Number & Title (e.g. "BE 21 BEGE MA SUDE HAMU") labeled "Judul"
 * 2) Verse slides prefixed with verse number ("1\n...", "2\n...", "Reff\n...")
 * Skips Bible passages, presentations, and media items untouched.
 */
export function ensureSongTitleAndVerseSlides<T extends Song | ScheduleItem>(item: T): T {
  if (!item) return item;
  const anyItem = item as any;
  const itemType = String(anyItem.type || "").toLowerCase();
  if (
    item.id?.startsWith("bible-") ||
    item.id?.startsWith("presentation-") ||
    itemType === "bible" ||
    itemType === "slide" ||
    itemType === "presentation" ||
    itemType === "media"
  ) {
    return item;
  }

  const rawVerses = Array.isArray(item.verses) ? item.verses : [];
  if (rawVerses.length === 0) return item;

  const rawLabels = Array.isArray(item.verseLabels) ? item.verseLabels : [];
  const introTitle = formatSongIntroTitle(item.title || "LAGU");
  const normalizedRawTitle = String(item.title || "").replace(/\s+/g, " ").trim().toUpperCase();

  const firstLabel = String(rawLabels[0] || "").trim();
  const hasTitleLabel = /^(?:judul|judul lagu|title|intro)$/i.test(firstLabel);
  const firstVerseNorm = String(rawVerses[0] || "").replace(/\s+/g, " ").trim().toUpperCase();
  const firstLooksLikeTitle =
    Boolean(introTitle) &&
    (firstVerseNorm === introTitle || firstVerseNorm === normalizedRawTitle);

  const nextVerses = [...rawVerses];
  const nextLabels = rawVerses.map((_, idx) =>
    rawLabels[idx] !== undefined ? rawLabels[idx] : "",
  );

  let hasIntroSlide = hasTitleLabel || firstLooksLikeTitle;
  if (!hasIntroSlide && introTitle) {
    nextVerses.unshift(introTitle);
    nextLabels.unshift("Judul");
    hasIntroSlide = true;
  } else if (hasIntroSlide && !hasTitleLabel) {
    nextLabels[0] = "Judul";
  }

  const startIdx = hasIntroSlide ? 1 : 0;
  let verseNum = 0;

  for (let i = startIdx; i < nextVerses.length; i++) {
    const lbl = nextLabels[i];
    const txt = String(nextVerses[i] || "").trim();

    // Explicit split continuation slide keeps empty label and no new verse prefix
    if (lbl === "" && rawLabels.length > 0) {
      continue;
    }

    const isReff =
      /^(?:reff|reffrain|refrain|chorus|paduan\s*suara)/i.test(lbl || "") ||
      /^(?:reff|reffrain|refrain|chorus)\b/i.test(txt);

    if (isReff) {
      if (txt) {
        nextVerses[i] = formatReffText(txt);
      }
      if (!lbl || /^(?:slide|verse|bait|ayat)\s*\d*$/i.test(lbl)) {
        nextLabels[i] = "Reff";
      }
    } else {
      verseNum++;
      if (txt) {
        nextVerses[i] = formatVerseTextWithNumber(txt, verseNum);
      }
      if (!lbl || /^(?:slide|verse|bait|ayat)\s*\d*$/i.test(lbl)) {
        nextLabels[i] = `Ayat ${verseNum}`;
      }
    }
  }

  const sameVerses =
    nextVerses.length === rawVerses.length &&
    nextVerses.every((v, idx) => v === rawVerses[idx]);
  const sameLabels =
    nextLabels.length === rawLabels.length &&
    nextLabels.every((l, idx) => l === rawLabels[idx]);

  if (sameVerses && sameLabels) {
    return item;
  }

  return {
    ...item,
    verses: nextVerses,
    verseLabels: nextLabels,
  };
}

/**
 * Converts HKBP lyric blocks (`verse`, `reff`, `refrain`) into clean projection slides:
 * - Slide 1: Song number & title (e.g. "BE 21 BEGE MA SUDE HAMU")
 * - Verse slides: prefixed with verse number ("1\n...", "2\n...") and "Reff\n..."
 * Ensuring ALL verses AND refrains are included and properly labeled (`Judul`, `Ayat 1`, `Reff`, `Ayat 2`, ...).
 */
export function buildHkbpSongSlides(
  rawLirik: RawHkbpLyricBlock[],
  bookType: "be" | "bn",
  nomorLagu: string,
  judul: string,
  extraMeta?: { tonalitas?: string; nomorBukuLagu?: string },
): Song {
  const prefix = bookType === "be" ? "BE" : "BN";
  const cleanTitle = cleanHkbpSongTitle(judul, bookType, nomorLagu);
  const introSlideText = `${prefix} ${nomorLagu} ${cleanTitle}`.replace(/\s+/g, " ").trim().toUpperCase();

  const blocks = (Array.isArray(rawLirik) ? rawLirik : []).filter(
    (b) =>
      Array.isArray(b?.lines) &&
      b.lines.some((l) => String(l || "").trim().length > 0),
  );

  // Identify the primary refrain text (if the song has one)
  const firstReffBlock = blocks.find((b) => {
    const t = String(b?.type || "").toLowerCase();
    return t === "reff" || t === "refrain";
  });
  const primaryReffRawText = firstReffBlock
    ? (firstReffBlock.lines || []).map((l) => String(l).trim()).filter(Boolean).join("\n")
    : "";
  const primaryReffText = primaryReffRawText ? formatReffText(primaryReffRawText) : "";

  const verses: string[] = [introSlideText];
  const verseLabels: string[] = ["Judul"];
  let verseNumber = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = (block.lines || [])
      .map((l) => String(l).trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const text = lines.join("\n");
    const blockType = String(block?.type || "verse").toLowerCase();
    const isReff = blockType === "reff" || blockType === "refrain";

    if (isReff) {
      verses.push(formatReffText(text));
      verseLabels.push("Reff");
    } else {
      verseNumber++;
      verses.push(formatVerseTextWithNumber(text, verseNumber));
      verseLabels.push(`Ayat ${verseNumber}`);

      // In Buku Ende (`BE`), many songs write the `reff` block only once after Bait 1
      // (or in the CDN JSON only after verse 1). If the song has a Reff and the next block
      // is NOT already a reff/refrain, insert the Reff slide right after this verse so
      // sequential projection always covers every verse and refrain!
      if (primaryReffText) {
        const nextBlock = blocks[i + 1];
        const nextType = String(nextBlock?.type || "").toLowerCase();
        const nextIsReff = nextType === "reff" || nextType === "refrain";
        if (!nextIsReff) {
          verses.push(primaryReffText);
          verseLabels.push("Reff");
        }
      }
    }
  }

  if (verses.length === 1) {
    verses.push(formatVerseTextWithNumber(cleanTitle, 1));
    verseLabels.push("Ayat 1");
  }

  const baseArtist =
    bookType === "be" ? "Buku Ende HKBP" : "Buku Nyanyian HKBP";
  const metaParts = [baseArtist];
  if (extraMeta?.tonalitas) metaParts.push(extraMeta.tonalitas);
  if (bookType === "bn" && extraMeta?.nomorBukuLagu) {
    metaParts.push(`BE ${extraMeta.nomorBukuLagu}`);
  }

  return {
    id: `hkbp-${bookType}-${nomorLagu}`,
    title: `${prefix} ${nomorLagu}. ${cleanTitle}`,
    artist: metaParts.join(" • "),
    verses,
    verseLabels,
  };
}

/**
 * Fetches full song details (all verses + refrains) from `https://hkbp.or.id/buku-ende` or `/buku-nyanyian`.
 */
export async function fetchHkbpSongDetail(
  bookType: "be" | "bn",
  nomorLagu: string,
  fallbackJudul?: string,
): Promise<Song> {
  const cleanNo = String(nomorLagu || "").trim();
  const cacheKey = `${bookType}:${cleanNo}`;
  const cached = songDetailCache.get(cacheKey);
  if (cached) return cached;

  const apiEndpoint =
    bookType === "be"
      ? `buku-ende/songs/${encodeURIComponent(cleanNo)}`
      : `buku-nyanyian/songs/${encodeURIComponent(cleanNo)}`;

  // 1. Prefer live HKBP portal API (`/api/hkbp`) for most complete text & repeated refrains
  try {
    const res = await fetch(`/api/hkbp?endpoint=${encodeURIComponent(apiEndpoint)}`);
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      const data = await res.json();
      if (data && Array.isArray(data.lirik) && data.lirik.length > 0) {
        const song = buildHkbpSongSlides(
          data.lirik,
          bookType,
          cleanNo,
          String(data.judul || fallbackJudul || `No. ${cleanNo}`),
          {
            tonalitas: data.tonalitas || undefined,
            nomorBukuLagu: data.nomorBukuLagu ? String(data.nomorBukuLagu) : undefined,
          },
        );
        songDetailCache.set(cacheKey, song);
        return song;
      }
    }
  } catch {}

  // 2. Fallback to CDN JSON dataset (`BE-v1.0.0.json` / `BN-v1.0.0.json`)
  const cdnMap = await fetchCdnSongCollection(bookType);
  const directKey = `${bookType}:${cleanNo}`;
  const found =
    cdnMap[directKey] ||
    Object.values(cdnMap).find((item: any) => String(item?.number ?? "").trim() === cleanNo);

  if (!found || !Array.isArray(found.lyrics)) {
    throw new Error(`Lagu ${bookType.toUpperCase()} No. ${cleanNo} tidak ditemukan di HKBP.`);
  }

  const song = buildHkbpSongSlides(
    found.lyrics,
    bookType,
    cleanNo,
    String(found.title || fallbackJudul || `No. ${cleanNo}`),
    {
      tonalitas: found.keySignature || undefined,
      nomorBukuLagu: found.originalNumber ? String(found.originalNumber) : undefined,
    },
  );
  songDetailCache.set(cacheKey, song);
  return song;
}
