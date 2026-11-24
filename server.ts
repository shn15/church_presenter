import express from "express";
import path from "path";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import multer from "multer";
import initSqlJs from "sql.js";
import AdmZip from "adm-zip";
const BIBLE_BOOKS_BATAK_GLOBAL: Record<string, string> = {
  "Kejadian": "1 Musa", "Keluaran": "2 Musa", "Imamat": "3 Musa", "Bilangan": "4 Musa", "Ulangan": "5 Musa",
  "Yosua": "Josua", "Hakim-hakim": "Panguhum", "Rut": "Rut", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",
  "1 Raja-raja": "1 Raja-raja", "2 Raja-raja": "2 Raja-raja", "1 Tawarikh": "1 Kronika", "2 Tawarikh": "2 Kronika",
  "Ezra": "Esra", "Nehemia": "Nehemia", "Ester": "Ester", "Ayub": "Job", "Mazmur": "Psalmen", "Amsal": "Poda",
  "Pengkhotbah": "Parjamita", "Kidung Agung": "Angka Ende", "Yesaya": "Jesaya", "Yeremia": "Jeremia",
  "Ratapan": "Andung-andung", "Yehezkiel": "Hesekiel", "Daniel": "Daniel", "Hosea": "Hosea", "Yoel": "Joel",
  "Amos": "Amos", "Obaja": "Obaja", "Yunus": "Jona", "Mikha": "Mika", "Nahum": "Nahum", "Habakuk": "Habakuk",
  "Zefanya": "Sepania", "Hagai": "Haggai", "Zakharia": "Sakaria", "Maleakhi": "Maleaki",
  "Matius": "Mateus", "Markus": "Markus", "Lukas": "Lukas", "Yohanes": "Johannes", "Kisah Para Rasul": "Ulaon ni Apostel",
  "Roma": "Rom", "1 Korintus": "1 Korint", "2 Korintus": "2 Korint", "Galatia": "Galatia", "Efesus": "Epesus",
  "Filipi": "Pilippi", "Kolose": "Kolosse", "1 Tesalonika": "1 Tessalonik", "2 Tesalonika": "2 Tessalonik",
  "1 Timotius": "1 Timoteus", "2 Timotius": "2 Timoteus", "Titus": "Titus", "Filemon": "Pilemon", "Ibrani": "Heber",
  "Yakobus": "Jakobus", "1 Petrus": "1 Petrus", "2 Petrus": "2 Petrus", "1 Yohanes": "1 Johannes",
  "2 Yohanes": "2 Johannes", "3 Yohanes": "3 Johannes", "Yudas": "Judas", "Wahyu": "Pangungkapon"
};

dotenv.config();

// Helper to safely load and initialize sql.js under any packaging or bundle environment
const initSqlJsDatabase = async (fileBuffer: Buffer) => {
  try {
    let wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    if (!fs.existsSync(wasmPath)) {
      wasmPath = path.join(process.cwd(), "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    }
    let config: any = {};
    if (fs.existsSync(wasmPath)) {
      config.wasmBinary = fs.readFileSync(wasmPath);
    }
    
    let initSql: any = initSqlJs;
    if (typeof initSql !== "function") {
      if ((initSql as any).default) {
        initSql = (initSql as any).default;
      } else if ((initSql as any).initSqlJs) {
        initSql = (initSql as any).initSqlJs;
      }
    }
    const SQL = await initSql(config);
    return new SQL.Database(fileBuffer);
  } catch (wasmErr) {
    console.warn("WASM SQL.js initialization failed. Falling back to ASM.js...", wasmErr);
    try {
      // Require the pure-JS asm.js fallback which contains zero WebAssembly dependencies
      const initSqlJsAsm = require("sql.js/dist/sql-asm.js");
      let initSql: any = initSqlJsAsm;
      if (typeof initSql !== "function") {
        if ((initSql as any).default) {
          initSql = (initSql as any).default;
        } else if ((initSql as any).initSqlJs) {
          initSql = (initSql as any).initSqlJs;
        }
      }
      const SQL = await initSql({});
      return new SQL.Database(fileBuffer);
    } catch (asmErr) {
      console.warn("ASM.js SQL.js initialization also failed. Rethrowing:", asmErr);
      throw wasmErr; // throw original WASM error if both failed
    }
  }
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
    const lines = trimmedBlock.split("\n").map(l => l.trim());
    const firstLine = lines[0];
    const isLabel = /^(verse|chorus|bridge|tag|ending|pre-chorus|refrain|slide|v\d+|c\d+|b\d+|split|reff|bait|bait\s+\d+|reff\s+\d+)/i.test(firstLine) ||
                    (firstLine.startsWith("[") && firstLine.endsWith("]"));

    if (isLabel && lines.length > 1) {
      const cleanLabel = firstLine.replace(/[\[\]]/g, "").trim();
      verseLabels.push(cleanLabel);
      verses.push(lines.slice(1).join("\n"));
    } else {
      verseLabels.push(`Slide ${defaultIndex}`);
      verses.push(trimmedBlock);
      defaultIndex++;
    }
  });

  if (verses.length === 0) {
    verses.push(plainText);
    verseLabels.push("Bait 1");
  }
  return { verses, verseLabels };
};

// Raw XML parser to extract EasyWorship songs from direct xml or .song files
const parseRawXMLSongs = (xmlText: string): any[] => {
  const songs: any[] = [];
  const songBlocks = xmlText.match(/<(?:\w+:)?Song[^>]*>([\s\S]*?)<\/(?:\w+:)?Song>/gi) || 
                     xmlText.match(/<(?:\w+:)?Item[^>]*>([\s\S]*?)<\/(?:\w+:)?Item>/gi) ||
                     xmlText.match(/<(?:\w+:)?ScheduleItem[^>]*>([\s\S]*?)<\/(?:\w+:)?ScheduleItem>/gi) ||
                     xmlText.match(/<(?:\w+:)?ServiceItem[^>]*>([\s\S]*?)<\/(?:\w+:)?ServiceItem>/gi);

  if (songBlocks && songBlocks.length > 0) {
    songBlocks.forEach((blockXML, index) => {
      const titleMatch = blockXML.match(/<(?:\w+:)?Title[^>]*>([\s\S]*?)<\/(?:\w+:)?Title>/i) || 
                         blockXML.match(/<(?:\w+:)?Name[^>]*>([\s\S]*?)<\/(?:\w+:)?Name>/i);
      const titleStr = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
      if (!titleStr) return;

      const lyricsMatch = blockXML.match(/<(?:\w+:)?Lyrics[^>]*>([\s\S]*?)<\/(?:\w+:)?Lyrics>/i) || 
                          blockXML.match(/<(?:\w+:)?Words[^>]*>([\s\S]*?)<\/(?:\w+:)?Words>/i) || 
                          blockXML.match(/<(?:\w+:)?BodyText[^>]*>([\s\S]*?)<\/(?:\w+:)?BodyText>/i) || 
                          blockXML.match(/<(?:\w+:)?Text[^>]*>([\s\S]*?)<\/(?:\w+:)?Text>/i);
      if (!lyricsMatch) return;
      const lyricsStr = lyricsMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();

      const authorMatch = blockXML.match(/<(?:\w+:)?Author[^>]*>([\s\S]*?)<\/(?:\w+:)?Author>/i) || 
                          blockXML.match(/<(?:\w+:)?Artist[^>]*>([\s\S]*?)<\/(?:\w+:)?Artist>/i) || 
                          blockXML.match(/<(?:\w+:)?Writer[^>]*>([\s\S]*?)<\/(?:\w+:)?Writer>/i);
      const authorStr = authorMatch ? authorMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "EasyWorship";

      const plainLyrics = lyricsStr.startsWith("{\\rtf") ? cleanEWRtf(lyricsStr) : lyricsStr;
      const { verses, verseLabels } = parseEWSongVerses(plainLyrics);

      if (verses.length > 0) {
        songs.push({
          id: `ew-xml-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: titleStr,
          artist: authorStr,
          verses,
          verseLabels
        });
      }
    });
  } else {
    // Check if it is a single song XML without outer wrapping blocks (just fields)
    const titleMatch = xmlText.match(/<(?:\w+:)?Title[^>]*>([\s\S]*?)<\/(?:\w+:)?Title>/i) || 
                       xmlText.match(/<(?:\w+:)?Name[^>]*>([\s\S]*?)<\/(?:\w+:)?Name>/i);
    const lyricsMatch = xmlText.match(/<(?:\w+:)?Lyrics[^>]*>([\s\S]*?)<\/(?:\w+:)?Lyrics>/i) || 
                        xmlText.match(/<(?:\w+:)?Words[^>]*>([\s\S]*?)<\/(?:\w+:)?Words>/i) || 
                        xmlText.match(/<(?:\w+:)?BodyText[^>]*>([\s\S]*?)<\/(?:\w+:)?BodyText>/i) || 
                        xmlText.match(/<(?:\w+:)?Text[^>]*>([\s\S]*?)<\/(?:\w+:)?Text>/i);

    if (titleMatch && lyricsMatch) {
      const titleStr = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      const lyricsStr = lyricsMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      const authorMatch = xmlText.match(/<(?:\w+:)?Author[^>]*>([\s\S]*?)<\/(?:\w+:)?Author>/i) || 
                          xmlText.match(/<(?:\w+:)?Artist[^>]*>([\s\S]*?)<\/(?:\w+:)?Artist>/i) || 
                          xmlText.match(/<(?:\w+:)?Writer[^>]*>([\s\S]*?)<\/(?:\w+:)?Writer>/i);
      const authorStr = authorMatch ? authorMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "EasyWorship";

      const plainLyrics = lyricsStr.startsWith("{\\rtf") ? cleanEWRtf(lyricsStr) : lyricsStr;
      const { verses, verseLabels } = parseEWSongVerses(plainLyrics);

      songs.push({
        id: `ew-xml-single-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: titleStr,
        artist: authorStr,
        verses,
        verseLabels
      });
    }
  }
  return songs;
};

// Parse EasyWorship schedule from raw XML (Schedule.xml inside .ewsx)
const parseEWXmlSchedule = (xmlText: string, decodeXmlEntities: (s: string) => string): any[] => {
  const items: any[] = [];
  
  // Find all service item nodes (ServiceItem)
  const itemMatches = xmlText.match(/<(?:[A-Za-z0-9_-]+:)?ServiceItem>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?ServiceItem>/gi) ||
                      xmlText.match(/<(?:[A-Za-z0-9_-]+:)?ServiceItem\s[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?ServiceItem>/gi) ||
                      xmlText.match(/<(?:[A-Za-z0-9_-]+:)?ScheduleItem>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?ScheduleItem>/gi) ||
                      xmlText.match(/<(?:[A-Za-z0-9_-]+:)?ScheduleItem\s[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?ScheduleItem>/gi) ||
                      xmlText.match(/<(?:[A-Za-z0-9_-]+:)?Song[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Song>/gi) ||
                      xmlText.match(/<(?:[A-Za-z0-9_-]+:)?Item[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Item>/gi);

  const extractSingleItem = (block: string, index: number): any | null => {
    // 1. Get Title
    const titleMatch = block.match(/<(?:[A-Za-z0-9_-]+:)?Title>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Title>/i) ||
                       block.match(/<(?:[A-Za-z0-9_-]+:)?Title\s[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Title>/i) ||
                       block.match(/<(?:[A-Za-z0-9_-]+:)?Name>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Name>/i) ||
                       block.match(/<(?:[A-Za-z0-9_-]+:)?Name\s[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Name>/i) ||
                       block.match(/<(?:[A-Za-z0-9_-]+:)?Caption>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Caption>/i);
    
    let titleStr = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
    titleStr = decodeXmlEntities(titleStr);
    
    // Fallback if title is empty
    if (!titleStr) {
      titleStr = `Item Jadwal ${index + 1}`;
    }

    let verses: string[] = [];
    let verseLabels: string[] = [];

    // 2. See if there are slides
    const slideMatches = block.match(/<(?:[A-Za-z0-9_-]+:)?Slide[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Slide>/gi) ||
                         block.match(/<(?:[A-Za-z0-9_-]+:)?SlideText[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?SlideText>/gi);

    if (slideMatches && slideMatches.length > 0) {
      slideMatches.forEach((slideBlock, slideIdx) => {
        // Try to match standard text fields
        const textMatch = slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Text[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Text>/i) ||
                          slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?BodyText[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?BodyText>/i) ||
                          slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Rtf[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Rtf>/i) ||
                          slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?rtf[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?rtf>/i) ||
                          slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Words[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Words>/i) ||
                          slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Lyrics[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Lyrics>/i);

        let sText = textMatch ? textMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
        sText = decodeXmlEntities(sText);

        if (sText) {
          const plain = sText.startsWith("{\\rtf") ? cleanEWRtf(sText) : sText;
          if (plain.trim()) {
            const labelMatch = slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Label[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Label>/i) ||
                               slideBlock.match(/<(?:[A-Za-z0-9_-]+:)?Name[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Name>/i);
            const labelStr = labelMatch ? decodeXmlEntities(labelMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : `Bait ${slideIdx + 1}`;
            verses.push(plain.trim());
            verseLabels.push(labelStr);
          }
        }
      });
    }

    // 3. Fallback: Parse item-level Lyrics or Words
    if (verses.length === 0) {
      const lyricsMatch = block.match(/<(?:[A-Za-z0-9_-]+:)?Lyrics[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Lyrics>/i) ||
                          block.match(/<(?:[A-Za-z0-9_-]+:)?Words[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Words>/i) ||
                          block.match(/<(?:[A-Za-z0-9_-]+:)?BodyText[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?BodyText>/i) ||
                          block.match(/<(?:[A-Za-z0-9_-]+:)?Text[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Text>/i) ||
                          block.match(/<(?:[A-Za-z0-9_-]+:)?Rtf[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Rtf>/i) ||
                          block.match(/<(?:[A-Za-z0-9_-]+:)?rtf[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?rtf>/i);

      if (lyricsMatch) {
        let bulkText = lyricsMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
        bulkText = decodeXmlEntities(bulkText);
        const plain = bulkText.startsWith("{\\rtf") ? cleanEWRtf(bulkText) : bulkText;
        if (plain.trim()) {
          const parsed = parseEWSongVerses(plain);
          verses = parsed.verses;
          verseLabels = parsed.verseLabels;
        }
      }
    }

    // 4. Try pptx/keynote style <a:t>
    if (verses.length === 0) {
      const xmlMatches = block.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || block.match(/<a:t>([\s\S]*?)<\/a:t>/gi);
      if (xmlMatches && xmlMatches.length > 0) {
        const combined = xmlMatches
          .map(m => m.replace(/<[^>]+>/g, "").trim())
          .filter(Boolean)
          .map(decodeXmlEntities)
          .join(" ");
        if (combined.trim()) {
          verses.push(combined.trim());
          verseLabels.push("Bait 1");
        }
      }
    }

    // If still empty but we have a title, check if it's not a generic service element
    if (verses.length === 0) {
      verses.push(`[Slide Presentasi / Media] ${titleStr}`);
      verseLabels.push("Bait 1");
    }

    const artistMatch = block.match(/<(?:[A-Za-z0-9_-]+:)?Author[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Author>/i) ||
                        block.match(/<(?:[A-Za-z0-9_-]+:)?Artist[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Artist>/i);
    const artistStr = artistMatch ? decodeXmlEntities(artistMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : "EasyWorship";

    return {
      id: `ew-xml-extracted-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: titleStr,
      artist: artistStr,
      type: "song",
      verses: verses,
      verseLabels: verseLabels
    };
  };

  if (itemMatches && itemMatches.length > 0) {
    itemMatches.forEach((block, idx) => {
      const item = extractSingleItem(block, idx);
      if (item && item.title && item.title !== "EasyWorship Schedule" && item.title !== "Schedule") {
        items.push(item);
      }
    });
  } else {
    // If no tags match but we have some standard XML tags like <Title>
    if (xmlText.includes("<Title>") || xmlText.includes("<Name>")) {
      const single = extractSingleItem(xmlText, 0);
      if (single) items.push(single);
    }
  }

  return items;
};

// Extract songs directly from proprietary non-SQLite DBISAM/Paradox binary formats
const carveEWSongs = (buffer: Buffer): any[] => {
  const importedSongs: any[] = [];
  const signature = Buffer.from("{\\rtf");
  const indices: number[] = [];
  
  let pos = buffer.indexOf(signature);
  while (pos !== -1) {
    indices.push(pos);
    pos = buffer.indexOf(signature, pos + 1);
  }

  console.log(`Binary Carver: found ${indices.length} potential RTF lyric blocks in binary.`);

  let lastRtfEnd = 0;
  for (let i = 0; i < indices.length; i++) {
    const startIdx = indices[i];
    
    if (startIdx < lastRtfEnd) {
      continue;
    }

    // Trace braces
    let braceCount = 0;
    let endIdx = startIdx;
    let found = false;
    for (let k = startIdx; k < buffer.length; k++) {
      const byte = buffer[k];
      if (byte === 0x7B) { // '{'
        braceCount++;
      } else if (byte === 0x7D) { // '}'
        braceCount--;
        if (braceCount === 0) {
          endIdx = k + 1;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      continue;
    }

    const rtfString = buffer.slice(startIdx, endIdx).toString("utf-8");

    // Scan backwards for printable fields in the record structure
    const lookbackStart = Math.max(lastRtfEnd, startIdx - 1000);
    const lookbackEnd = startIdx;

    const candidates: { text: string; offset: number }[] = [];
    let currentStr: number[] = [];
    let strStartOffset = -1;

    for (let j = lookbackStart; j < lookbackEnd; j++) {
      const b = buffer[j];
      // Printable ASCII or common Latin extended
      if ((b >= 0x20 && b <= 0x7E) || (b >= 0xC0 && b <= 0xFF)) {
        if (currentStr.length === 0) {
          strStartOffset = j;
        }
        currentStr.push(b);
      } else {
        if (currentStr.length >= 2) {
          const textStr = Buffer.from(currentStr).toString("utf-8").trim();
          const lowerStr = textStr.toLowerCase();
          const looksLikeRTF = textStr.startsWith("\\") || textStr.includes("\\") || textStr.includes(";") || textStr.includes("}") || textStr.includes("{") || textStr.includes("=");
          const isMetadata = ["title", "words", "author", "songs", "easyworship", "song", "dbisam", "paradox", "index", "words", "copyright", "administrator", "notes", "key"].includes(lowerStr);
          const hasLetters = /[a-zA-Z]/.test(textStr);

          if (!looksLikeRTF && !isMetadata && hasLetters) {
            candidates.push({ text: textStr, offset: strStartOffset });
          }
        }
        currentStr = [];
        strStartOffset = -1;
      }
    }

    if (currentStr.length >= 2) {
      const textStr = Buffer.from(currentStr).toString("utf-8").trim();
      const lowerStr = textStr.toLowerCase();
      const looksLikeRTF = textStr.startsWith("\\") || textStr.includes("\\") || textStr.includes(";") || textStr.includes("}") || textStr.includes("{") || textStr.includes("=");
      const isMetadata = ["title", "words", "author", "songs", "easyworship", "song", "dbisam", "paradox", "index", "words", "copyright", "administrator", "notes", "key"].includes(lowerStr);
      const hasLetters = /[a-zA-Z]/.test(textStr);

      if (!looksLikeRTF && !isMetadata && hasLetters) {
        candidates.push({ text: textStr, offset: lookbackEnd - currentStr.length });
      }
    }

    let title = "Lagu Tanpa Judul";
    let artist = "EasyWorship";

    if (candidates.length > 0) {
      // Clean extracted strings of weird residues
      title = candidates[0].text;
      if (candidates.length > 1) {
        artist = candidates[1].text;
      }
    }

    const plainLyrics = cleanEWRtf(rtfString).trim();
    if (plainLyrics.length > 0) {
      const { verses, verseLabels } = parseEWSongVerses(plainLyrics);
      importedSongs.push({
        id: `ew-carved-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title,
        artist: artist,
        verses,
        verseLabels
      });
    }

    lastRtfEnd = endIdx;
  }

  return importedSongs;
};

// Normalize/Translate English and Abbreviated Book names to Indonesian equivalent
const normalizeBibleBookName = (id: number, name: string): string => {
  const EW_BOOK_ID_MAP: { [key: number]: string } = {
    1: "Kejadian", 2: "Keluaran", 3: "Imamat", 4: "Bilangan", 5: "Ulangan",
    6: "Yosua", 7: "Hakim-hakim", 8: "Rut", 9: "1 Samuel", 10: "2 Samuel",
    11: "1 Raja-raja", 12: "2 Raja-raja", 13: "1 Tawarikh", 14: "2 Tawarikh",
    15: "Ezra", 16: "Nehemia", 17: "Ester", 18: "Ayub", 19: "Mazmur",
    20: "Amsal", 21: "Pengkhotbah", 22: "Kidung Agung", 23: "Yesaya",
    24: "Yeremia", 25: "Ratapan", 26: "Yehezkiel", 27: "Daniel",
    28: "Hosea", 29: "Yoel", 30: "Amos", 31: "Obaja", 32: "Yunus",
    33: "Mikha", 34: "Nahum", 35: "Habakuk", 36: "Zefanya", 37: "Hagai",
    38: "Zakharia", 39: "Maleakhi", 40: "Matius", 41: "Markus",
    42: "Lukas", 43: "Yohanes", 44: "Kisah Para Rasul", 45: "Roma",
    46: "1 Korintus", 47: "2 Korintus", 48: "Galatia", 49: "Efesus",
    50: "Filipi", 51: "Kolose", 52: "1 Tesalonika", 53: "2 Tesalonika",
    54: "1 Timotius", 55: "2 Timotius", 56: "Titus", 57: "Filemon",
    58: "Ibrani", 59: "Yakobus", 60: "1 Petrus", 61: "2 Petrus",
    62: "1 Yohanes", 63: "2 Yohanes", 64: "3 Yohanes", 65: "Yudas",
    66: "Wahyu"
  };

  const EW_BOOK_NAME_MAP: { [key: string]: string } = {
    "genesis": "Kejadian", "exodus": "Keluaran", "leviticus": "Imamat",
    "numbers": "Bilangan", "deuteronomy": "Ulangan", "joshua": "Yosua",
    "judges": "Hakim-hakim", "ruth": "Rut", "1samuel": "1 Samuel",
    "2samuel": "2 Samuel", "1kings": "1 Raja-raja", "2kings": "2 Raja-raja",
    "1chronicles": "1 Tawarikh", "2chronicles": "2 Tawarikh", "ezra": "Ezra",
    "nehemiah": "Nehemia", "esther": "Ester", "job": "Ayub", "psalms": "Mazmur",
    "proverbs": "Amsal", "ecclesiastes": "Pengkhotbah", "songofsolomon": "Kidung Agung",
    "isaiah": "Yesaya", "jeremiah": "Yeremia", "lamentations": "Ratapan",
    "ezekiel": "Yehezkiel", "daniel": "Daniel", "hosea": "Hosea",
    "joel": "Yoel", "amos": "Amos", "obadiah": "Obaja", "jonah": "Yunus",
    "micah": "Mikha", "nahum": "Nahum", "habakkuk": "Habakuk",
    "zephaniah": "Zefanya", "haggai": "Hagai", "zechariah": "Zakharia",
    "malachi": "Maleakhi", "matthew": "Matius", "mark": "Markus",
    "luke": "Lukas", "john": "Yohanes", "acts": "Kisah Para Rasul",
    "romans": "Roma", "1corinthians": "1 Korintus", "2corinthians": "2 Korintus",
    "galatians": "Galatia", "ephesians": "Efesus", "philippians": "Filipi",
    "colossians": "Kolose", "1thessalonians": "1 Tesalonika",
    "2thessalonians": "2 Tesalonika", "1timothy": "1 Timotius",
    "2timothy": "2 Timotius", "titus": "Titus", "philemon": "Filemon",
    "hebrews": "Ibrani", "james": "Yakobus", "1peter": "1 Petrus",
    "2peter": "2 Petrus", "1john": "1 Yohanes", "2john": "2 Yohanes",
    "3john": "3 Yohanes", "jude": "Yudas", "revelation": "Wahyu"
  };

  if (id && EW_BOOK_ID_MAP[id]) return EW_BOOK_ID_MAP[id];
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (EW_BOOK_NAME_MAP[clean]) return EW_BOOK_NAME_MAP[clean];
  for (const [eng, idn] of Object.entries(EW_BOOK_NAME_MAP)) {
    if (clean.includes(eng) || eng.includes(clean)) return idn;
  }
  return name;
};

// Bypass expired certificate issues for official Alkitab API if needed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Initialize the shared Gemini client utility on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY as string,
});

// Simple in-memory cache for speed
const scriptureCache = new Map<string, any>();

// Temp multer storage for import files (.chr, .pptx, .ewsx, bible sqlite)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB limit
});

// Dedicated folder storage for background images & videos (public/backgrounds)
const BG_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]);
const BG_VIDEO_EXTS = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);

function getBackgroundsFolderDir(): string {
  const bgsDir = path.join(process.cwd(), "public", "backgrounds");
  if (!fs.existsSync(bgsDir)) {
    fs.mkdirSync(bgsDir, { recursive: true });
  }
  return bgsDir;
}

function syncBackgroundsManifest(): { images: string[]; videos: string[] } {
  const bgsDir = getBackgroundsFolderDir();
  const files = fs.readdirSync(bgsDir).sort((a, b) => a.localeCompare(b));
  const images: string[] = [];
  const videos: string[] = [];

  for (const file of files) {
    if (file === ".keep" || file === "manifest.json" || file === "README.txt") continue;
    const ext = path.extname(file).toLowerCase();
    const urlPath = `/backgrounds/${encodeURIComponent(file)}`;
    if (BG_IMAGE_EXTS.has(ext)) {
      images.push(urlPath);
    } else if (BG_VIDEO_EXTS.has(ext)) {
      videos.push(urlPath);
    }
  }

  try {
    fs.writeFileSync(
      path.join(bgsDir, "manifest.json"),
      JSON.stringify({ images, videos }, null, 2) + "\n",
      "utf-8"
    );
  } catch (err) {
    console.warn("Could not write backgrounds manifest:", err);
  }

  return { images, videos };
}

const bgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getBackgroundsFolderDir());
  },
  filename: (_req, file, cb) => {
    const cleanOrig = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetPath = path.join(getBackgroundsFolderDir(), cleanOrig);
    const finalName = fs.existsSync(targetPath)
      ? `${Date.now()}-${cleanOrig}`
      : cleanOrig;
    cb(null, finalName);
  }
});

const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: 250 * 1024 * 1024 }
});

async function startServer() {
  const app = express();
  
  // Set larger limit to support uploading image and video backgrounds
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const backgroundsDir = getBackgroundsFolderDir();
  syncBackgroundsManifest();

  // Serve the dedicated backgrounds folder directly with CORS & range support
  app.use("/backgrounds", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    next();
  }, express.static(backgroundsDir));

  // Serve legacy /uploads static files caught BEFORE the Vite dev middleware
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    next();
  }, express.static(uploadsDir));

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Real-time state
  const activeOperators = new Set<string>();
  const operatorAccountMap = new Map<string, string>();
  const operatorStatusMap = new Map<string, { active: boolean; isLive: boolean; ts: number }>();
  const operatorDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const accountSyncRoomMap = new Map<string, string>();
  const currentSlideMap = new Map<string, any>();
  const currentSettingsMap = new Map<string, any>();
  const currentShiftMap = new Map<string, any>();

  const hasActiveOperatorForAccount = (accountId: string) => {
    for (const acc of operatorAccountMap.values()) {
      if (acc === accountId) return true;
    }
    return false;
  };

  const isOperatorConsideredActive = (accountId: string) => {
    if (hasActiveOperatorForAccount(accountId)) return true;
    const storedOpStatus = operatorStatusMap.get(accountId);
    return Boolean(
      storedOpStatus &&
        storedOpStatus.active === true &&
        Date.now() - storedOpStatus.ts < 30000
    );
  };

  // GET endpoint to fetch current active shift
  app.get("/api/current-shift", (req: any, res: any) => {
    const accountId = (req.query.account as string) || "acc_default";
    const shift = currentShiftMap.get(accountId) || {
      active: false,
      name: "",
      endTime: "",
      token: ""
    };
    return res.json(shift);
  });

  // GET endpoint to fetch current live output slide & settings directly (for OBS / Projector)
  app.get("/api/live-output", (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    const accountId = (req.query.account as string) || "acc_default";
    const slide = currentSlideMap.get(accountId) || null;
    const settings = currentSettingsMap.get(accountId) || null;
    const syncRoomId = accountSyncRoomMap.get(accountId) || null;
    const storedOpStatus = operatorStatusMap.get(accountId);
    const hasOp = hasActiveOperatorForAccount(accountId);
    const isFreshStored = Boolean(storedOpStatus && Date.now() - storedOpStatus.ts < 30000);
    const operatorStatus = hasOp
      ? {
          active: storedOpStatus ? storedOpStatus.active : true,
          isLive: storedOpStatus ? storedOpStatus.isLive : (slide ? slide.isLive !== false : true),
          ts: Date.now(),
        }
      : isFreshStored && storedOpStatus
        ? storedOpStatus
        : storedOpStatus
          ? storedOpStatus
          : slide && slide.isLive !== false
            ? { active: true, isLive: true, ts: Date.now() }
            : null;
    return res.json({ slide, settings, operatorStatus, syncRoomId });
  });

  const shouldAcceptMonotonicUpdate = (existing: any, incoming: any) => {
    if (!existing || !incoming) return true;
    if (
      typeof existing._syncSession === "string" &&
      typeof incoming._syncSession === "string" &&
      existing._syncSession === incoming._syncSession &&
      typeof existing._syncTs === "number" &&
      typeof incoming._syncTs === "number"
    ) {
      return incoming._syncTs >= existing._syncTs;
    }
    return true;
  };

  // POST endpoint to persist & broadcast live output snapshot
  app.post("/api/live-output", (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const accountId = (req.body?.accountId as string) || (req.query.account as string) || "acc_default";
    if (typeof req.body?.syncRoomId === "string" && req.body.syncRoomId.trim()) {
      accountSyncRoomMap.set(accountId, req.body.syncRoomId.trim());
    }
    if (req.body?.operatorStatus && typeof req.body.operatorStatus.active === "boolean") {
      const pendingTimer = operatorDisconnectTimers.get(accountId);
      if (req.body.operatorStatus.active && pendingTimer) {
        clearTimeout(pendingTimer);
        operatorDisconnectTimers.delete(accountId);
      }
      const statusPayload = {
        active: Boolean(req.body.operatorStatus.active),
        isLive: req.body.operatorStatus.active ? req.body.operatorStatus.isLive !== false : false,
        ts: Date.now(),
      };
      operatorStatusMap.set(accountId, statusPayload);
      io.to("room_" + accountId).emit("operator:status", statusPayload);
    }
    if (req.body?.slide) {
      const existingSlide = currentSlideMap.get(accountId);
      if (shouldAcceptMonotonicUpdate(existingSlide, req.body.slide)) {
        currentSlideMap.set(accountId, req.body.slide);
        io.to("room_" + accountId).emit("slide:update", req.body.slide);
      }
    }
    if (req.body?.settings) {
      const existingSettings = currentSettingsMap.get(accountId);
      if (shouldAcceptMonotonicUpdate(existingSettings, req.body.settings)) {
        currentSettingsMap.set(accountId, req.body.settings);
        io.to("room_" + accountId).emit("settings:update", req.body.settings);
      }
    }
    return res.json({ ok: true });
  });

  // API Endpoints: save uploaded background images/videos into the single dedicated folder (public/backgrounds)
  app.post("/api/upload", bgUpload.array("files"), (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const urls = files.map(file => `/backgrounds/${encodeURIComponent(file.filename)}`);
      syncBackgroundsManifest();
      console.log(`Saved ${files.length} background file(s) to public/backgrounds:`, urls);
      return res.json({ urls });
    } catch (error: any) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: error.message || "Failed to save file(s)" });
    }
  });

  // Get local custom bibles from public/bibles folder
  app.get("/api/local-bibles", (_req, res) => {
    try {
      const biblesDir = path.join(process.cwd(), "public", "bibles");
      if (!fs.existsSync(biblesDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(biblesDir);
      const bibles = [];
      files.forEach(file => {
        if (!file.endsWith(".json")) return;
        try {
          const filePath = path.join(biblesDir, file);
          const d = fs.readFileSync(filePath, "utf-8");
          const b = JSON.parse(d);
          if (b && b.id && b.name) {
            let bookNames = b.bookNames;
            if (!bookNames && b.books) {
              bookNames = Object.keys(b.books);
            }
            bibles.push({
              id: b.id,
              name: b.name,
              bookNames: bookNames || []
            });
          }
        } catch (err) {
          console.error("Failed to parse local bible:", file, err);
        }
      });
      return res.json(bibles);
    } catch (error) {
      console.error("Failed to read local bibles:", error);
      return res.json([]);
    }
  });

  // Get custom backgrounds from the single dedicated public/backgrounds folder
  app.get("/api/local-backgrounds", (_req, res) => {
    try {
      const manifest = syncBackgroundsManifest();
      return res.json(manifest);
    } catch (error) {
      console.error("Failed to read local backgrounds:", error);
      return res.json({ images: [], videos: [] });
    }
  });

  // Delete a background file from the dedicated public/backgrounds folder
  app.delete("/api/local-backgrounds", (req, res) => {
    try {
      const rawUrl = String(req.query.file || req.body?.url || "");
      const baseName = decodeURIComponent(rawUrl.split("/").pop() || "").replace(/[\\/]/g, "");
      if (!baseName || baseName === ".keep" || baseName === "manifest.json" || baseName === "README.txt") {
        return res.status(400).json({ error: "Invalid filename" });
      }
      const targetPath = path.join(getBackgroundsFolderDir(), baseName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      const manifest = syncBackgroundsManifest();
      return res.json({ ok: true, ...manifest });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to delete background" });
    }
  });

  // Accounts Management Endpoint
  app.get("/api/accounts", (_req, res) => {
    try {
      const p = path.join(process.cwd(), "uploads", "accounts.json");
      if (fs.existsSync(p)) {
        const d = fs.readFileSync(p, "utf-8");
        return res.json(JSON.parse(d));
      }
      return res.json([]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/accounts", (req, res) => {
    try {
      const accounts = req.body;
      if (!Array.isArray(accounts)) {
        return res.status(400).json({ error: "Body must be an array" });
      }
      const p = path.join(process.cwd(), "uploads", "accounts.json");
      fs.writeFileSync(p, JSON.stringify(accounts, null, 2), "utf-8");
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 1. Get custom library songs saved on backend (Scoped per Account)
  app.get("/api/custom-songs", (req, res) => {
    try {
      const accountId = (req.query.accountId as string) || "acc_default";
      const p = path.join(process.cwd(), "uploads", `custom_songs_${accountId}.json`);
      if (fs.existsSync(p)) {
        const d = fs.readFileSync(p, "utf-8");
        return res.json(JSON.parse(d));
      }
      // Fallback for default account
      if (accountId === "acc_default") {
        const legacyPath = path.join(process.cwd(), "uploads", "custom_songs.json");
        if (fs.existsSync(legacyPath)) {
          const d = fs.readFileSync(legacyPath, "utf-8");
          return res.json(JSON.parse(d));
        }
      }
      return res.json([]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 2. Save custom library songs to backend (Scoped per Account)
  app.post("/api/custom-songs", (req, res) => {
    try {
      let accountId = (req.query.accountId as string) || "acc_default";
      let songs = req.body;
      if (req.body && !Array.isArray(req.body) && req.body.songs && Array.isArray(req.body.songs)) {
        songs = req.body.songs;
        if (req.body.accountId) accountId = req.body.accountId;
      }
      if (!Array.isArray(songs)) {
        return res.status(400).json({ error: "Body must be an array of songs" });
      }
      const p = path.join(process.cwd(), "uploads", `custom_songs_${accountId}.json`);
      fs.writeFileSync(p, JSON.stringify(songs, null, 2), "utf-8");
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 3. Get custom bibles saved on backend (Scoped per Account)
  app.get("/api/custom-bibles", (req, res) => {
    try {
      const accountId = (req.query.accountId as string) || "acc_default";
      const p = path.join(process.cwd(), "uploads", `custom_bibles_${accountId}.json`);
      let biblesData: any[] = [];
      if (fs.existsSync(p)) {
        const d = fs.readFileSync(p, "utf-8");
        biblesData = JSON.parse(d);
      } else if (accountId === "acc_default") {
        const legacyPath = path.join(process.cwd(), "uploads", "custom_bibles.json");
        if (fs.existsSync(legacyPath)) {
          const d = fs.readFileSync(legacyPath, "utf-8");
          biblesData = JSON.parse(d);
        }
      }

      if (Array.isArray(biblesData)) {
        const lightweight = biblesData.map((b: any) => {
          let bookNames = b.bookNames;
          if (!bookNames && b.books) {
            bookNames = Object.keys(b.books);
          }
          return {
            id: b.id,
            name: b.name,
            bookNames: bookNames || []
          };
        });
        return res.json(lightweight);
      }
      return res.json([]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 3.5. On-Demand chapter search / fetch API (Super efficient database proxying)
  app.get("/api/custom-bibles/:bibleId/chapter", async (req, res) => {
    try {
      const { bibleId } = req.params;
      const { book, chapter } = req.query;
      if (!book || !chapter) {
        return res.status(400).json({ error: "Query parameters 'book' & 'chapter' are required" });
      }

      const chapStr = String(chapter);
      const BIBLE_BOOKS = [
        "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan",
        "Yosua", "Hakim-hakim", "Rut", "1 Samuel", "2 Samuel",
        "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh",
        "Ezra", "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal",
        "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan",
        "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja",
        "Yunus", "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai",
        "Zakharia", "Maleakhi",
        "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul",
        "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus",
        "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika",
        "1 Timotius", "2 Timotius", "Titus", "Filemon", "Ibrani",
        "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes",
        "3 Yohanes", "Yudas", "Wahyu"
      ];

      const retrieveChapterVerses = (booksMap: Record<string, any>): string[] | null => {
        if (!booksMap) return null;
        let matchedBookKey = Object.keys(booksMap).find(
          b => b.toLowerCase() === String(book).toLowerCase()
        );
        if (!matchedBookKey) {
          let targetIdx = BIBLE_BOOKS.findIndex(
            b => b.toLowerCase() === String(book).toLowerCase()
          );
          if (targetIdx === -1) {
            const batakKeys = Object.keys(BIBLE_BOOKS_BATAK_GLOBAL);
            const isBatakName = batakKeys.find(b => {
              const bBatak = BIBLE_BOOKS_BATAK_GLOBAL[b];
              return bBatak && bBatak.toLowerCase() === String(book).toLowerCase();
            });
            if (isBatakName) {
              targetIdx = BIBLE_BOOKS.findIndex(b => b === isBatakName);
            }
          }
          if (targetIdx !== -1) {
            const numericKey = String(targetIdx + 1);
            if (booksMap[numericKey]) {
              matchedBookKey = numericKey;
            }
          }
        }

        if (matchedBookKey) {
          const rawVerses = booksMap[matchedBookKey]?.[chapStr];
          if (rawVerses) {
            if (Array.isArray(rawVerses)) {
              return rawVerses;
            } else if (rawVerses && typeof rawVerses === "object") {
              const keys = Object.keys(rawVerses).sort((a,b) => parseInt(a) - parseInt(b));
              return keys.map(k => {
                const val = rawVerses[k];
                return typeof val === "string" ? val : (val?.text || val?.content || JSON.stringify(val));
              });
            }
          }
        }
        return null;
      };

      // 1. Try to find individual isolated Bible file
      const individualPath = path.join(process.cwd(), "uploads", "bibles", `${bibleId}.json`);
      if (fs.existsSync(individualPath)) {
        try {
          const bibleData = JSON.parse(fs.readFileSync(individualPath, "utf-8"));
          if (bibleData && bibleData.books) {
            const verses = retrieveChapterVerses(bibleData.books);
            if (verses && verses.length > 0) {
              return res.json({ verses });
            }
          }
        } catch (err) {
          console.error(`Error reading isolated Bible file ${bibleId}:`, err);
        }
      }

      // 1.5 Try to find it in public/bibles
      const localPath = path.join(process.cwd(), "public", "bibles", `${bibleId}.json`);
      if (fs.existsSync(localPath)) {
        try {
          const bibleData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
          if (bibleData && bibleData.books) {
            const verses = retrieveChapterVerses(bibleData.books);
            if (verses && verses.length > 0) {
              return res.json({ verses });
            }
          }
        } catch (err) {
          console.error(`Error reading local Bible file ${bibleId}:`, err);
        }
      }

      // 2. Fallback to monolithic custom_bibles.json
      const biblesPath = path.join(process.cwd(), "uploads", "custom_bibles.json");
      if (fs.existsSync(biblesPath)) {
        const allBibles = JSON.parse(fs.readFileSync(biblesPath, "utf-8"));
        if (Array.isArray(allBibles)) {
          const match = allBibles.find((b: any) => b.id === bibleId);
          if (match && match.books) {
            const verses = retrieveChapterVerses(match.books);
            if (verses && verses.length > 0) {
              return res.json({ verses });
            }
          }
        }
      }

      // 3. Fallback to scraping alkitab.me/bbc-toba if the bible ID is for Batak/Toba
      if (bibleId.toLowerCase().includes("toba") || bibleId.toLowerCase().includes("batak")) {
        try {
          const bookStr = String(book);
          let tobaBook = bookStr;
          const matchedBatakVal = BIBLE_BOOKS_BATAK_GLOBAL[bookStr];
          if (matchedBatakVal) {
            tobaBook = matchedBatakVal;
          } else {
            const foundKey = Object.keys(BIBLE_BOOKS_BATAK_GLOBAL).find(
              k => k.toLowerCase() === bookStr.toLowerCase()
            );
            if (foundKey) {
              tobaBook = BIBLE_BOOKS_BATAK_GLOBAL[foundKey];
            }
          }

          const alkitabMeUrl = `https://alkitab.me/bbc-toba/${encodeURIComponent(tobaBook)}/${chapter}`;
          console.log(`Fallback scraper: Scraping Batak Toba verses from: ${alkitabMeUrl}`);
          const resMe = await fetch(alkitabMeUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          if (resMe.ok) {
            const html = await resMe.text();
            const verseRegex = /<div\s+[^>]*class="vw\s*"[^>]*data-verse="(\d+)"[^>]*>([\s\S]*?)<\/div>/gi;
            let match;
            const scraperVerses = [];
            while ((match = verseRegex.exec(html)) !== null) {
              const blockContent = match[2];
              const pMatch = blockContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
              const text = pMatch ? pMatch[1].replace(/<[^>]*>/g, "").trim() : "";
              if (text) {
                scraperVerses.push(text);
              }
            }
            if (scraperVerses.length > 0) {
              console.log(`Fallback scraper success from alkitab.me! Verses count: ${scraperVerses.length}`);
              return res.json({ verses: scraperVerses });
            }
          }
        } catch (scrapeErr) {
          console.error("Fallback scraper to alkitab.me/bbc-toba failed:", scrapeErr);
        }
      }

      // 3.5 Fallback to Bolls.life for Indonesian TB custom bibles if the file is missing
      if (bibleId.toLowerCase().includes("tb") || bibleId.toLowerCase().includes("indo")) {
        try {
          const bookIdx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === String(book).toLowerCase());
          if (bookIdx !== -1) {
            const bookIdInt = bookIdx + 1;
            const bollsUrl = `https://bolls.life/get-text/TB/${bookIdInt}/${chapter}/`;
            console.log(`Fallback Bolls.life for missing custom bible ${bibleId}: ${bollsUrl}`);
            const bollsRes = await fetch(bollsUrl, {
              headers: { 'Accept': 'application/json' }
            });
            if (bollsRes.ok) {
              const data = await bollsRes.json() as any;
              if (Array.isArray(data) && data.length > 0) {
                const verses = data.map((v: any) => v.text);
                return res.json({ verses });
              }
            }
          }
        } catch (err) {
          console.error("Fallback Bolls.life failed:", err);
        }
      }

      return res.status(404).json({ error: `Ayat tidak ditemukan untuk kitab '${book}' pasal ${chapter}` });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 4. Save custom bibles to backend (metadata-only safe saving, with automatic server-side isolation)
  app.post("/api/custom-bibles", (req, res) => {
    try {
      const bibles = req.body;
      if (!Array.isArray(bibles)) {
        return res.status(400).json({ error: "Body must be an array of bibles" });
      }
      const p = path.join(process.cwd(), "uploads", "custom_bibles.json");
      let existingBibles: any[] = [];
      try {
        if (fs.existsSync(p)) {
          const fileContents = fs.readFileSync(p, "utf-8");
          existingBibles = JSON.parse(fileContents);
          if (!Array.isArray(existingBibles)) {
            existingBibles = [];
          }
        }
      } catch (err) {
        console.warn("Reading existing bibles for merge safety warning:", err);
      }

      const protectedBibles = bibles.map((b: any) => {
        // If posted bible contains a full 'books' payload, isolate it to physical database files first!
        if (b.books && typeof b.books === "object" && Object.keys(b.books).length > 0) {
          try {
            const biblesDir = path.join(process.cwd(), "uploads", "bibles");
            if (!fs.existsSync(biblesDir)) {
              fs.mkdirSync(biblesDir, { recursive: true });
            }
            const individualPath = path.join(biblesDir, `${b.id}.json`);
            fs.writeFileSync(individualPath, JSON.stringify({
              id: b.id,
              name: b.name,
              books: b.books
            }, null, 2), "utf-8");
            console.log(`Successfully auto-isolated database file for client uploaded Bible: ${individualPath}`);
          } catch (err) {
            console.error("Gagal auto-isolasi data alkitab kustom:", err);
          }
          // Strip heavy books array from master file index
          return {
            id: b.id,
            name: b.name,
            bookNames: Object.keys(b.books)
          };
        }

        // If POSTed bible has no books but has existing index catalog, maintain the index config mapping
        if (!b.books || typeof b.books !== "object" || Object.keys(b.books).length === 0) {
          const match = existingBibles.find((ex: any) => ex.id === b.id);
          if (match) {
            const bookNames = match.bookNames || (match.books ? Object.keys(match.books) : []);
            return {
              id: b.id,
              name: b.name,
              bookNames
            };
          }
        }
        return b;
      });

      fs.writeFileSync(p, JSON.stringify(protectedBibles, null, 2), "utf-8");
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // AI-powered raw lyrics/text parser with Gemini structured output
  app.post("/api/ai/parse-songs", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Lirik atau teks lagu harus diisi." });
      }

      console.log("Analyzing and parsing text songs with Gemini 3.5 Flash...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analisis teks berikut yang berisi lagu-lagu gereja/rohani (dalam bahasa Indonesia, Inggris, atau bahasa daerah).
Ekstrak dan susun menjadi array objek JSON lagu yang valid.
Jika terdapat beberapa lagu, deteksi batas antar lagu secara akurat meskipun tanda pembatasnya tidak teratur atau hilang sama sekali.
Bagi lirik menjadi bait-bait yang terpisah (verse, chorus, reff, bridge, dll.) yang pas untuk dijadikan slide presentasi proyektor (setiap slide berisi sekitar 2 sampai 6 baris lirik).
Nama penyanyi/pencipta lagu harus dimasukkan di field artist jika tertulis, jika tidak ada isi dengan "Impor AI".

Teks lirik untuk diproses:
------
${text}
------`,
        config: {
          systemInstruction: "Anda adalah asisten operator LCD presentasi ibadah yang ahli dalam merapikan lirik lagu mentah menjadi slide-slide presentasi terstruktur (JSON array). Pastikan lirik bersih dari baris kosong berlebih.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Judul lagu yang bersih.",
                },
                artist: {
                  type: Type.STRING,
                  description: "Nama pencipta/penyanyi jika ada, jika tidak ada isi dengan 'Impor AI'.",
                },
                verses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description: "Setiap elemen adalah teks satu slide/bait lirik lengkap (2-6 baris lirik). Jangan gunakan sub-array.",
                },
                verseLabels: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description: "Label bait lirik tersebut, contoh: 'Bait 1', 'Chorus', 'Bait 2', 'Bridge', dll. Jumlahnya harus sama persis dengan jumlah verses.",
                }
              },
              required: ["title", "verses"],
            },
          },
        },
      });

      const parsedText = response.text;
      if (!parsedText) {
        throw new Error("Gemini tidak mengembalikan lirik atau format JSON yang valid.");
      }

      const songList = JSON.parse(parsedText);
      if (!Array.isArray(songList)) {
        throw new Error("Hasil parsing dari AI bukan merupakan array lagu.");
      }

      const songsWithIds = songList.map((s: any, idx: number) => ({
        id: `ai-song-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: s.title || "Lagu Tanpa Judul - Impor AI",
        artist: s.artist || "Impor AI",
        verses: Array.isArray(s.verses) ? s.verses : ["Lirik Kosong"],
        verseLabels: Array.isArray(s.verseLabels) ? s.verseLabels : (Array.isArray(s.verses) ? s.verses.map((_: any, i: number) => `Slide ${i + 1}`) : ["Slide 1"])
      }));

      console.log(`Successfully parsed ${songsWithIds.length} songs using AI.`);
      return res.json(songsWithIds);
    } catch (e: any) {
      console.error("AI song parsing error:", e);
      return res.status(500).json({ error: e.message || "Gagal merapikan lirik dengan AI." });
    }
  });

  // Helper: Backend parser to extract songs from plain text files (.txt)
  const backendParseTextSongs = (rawText: string): any[] => {
    if (!rawText || !rawText.trim()) return [];
    
    let sections = rawText.split(/(?:\r?\n){1,3}-+(?:\r?\n){1,3}/);
    if (sections.length <= 1) {
      sections = rawText.split(/(?:\r?\n)---+(?:\r?\n)/);
    }
    if (sections.length <= 1) {
      if (/^(?:Title|Judul):/im.test(rawText)) {
        sections = rawText.split(/(?=(?:Title:|Judul:))/i);
      } else {
        sections = [rawText];
      }
    }

    const parsedSongs: any[] = [];

    sections.forEach((sect, idx) => {
      const block = sect.trim();
      if (!block) return;
      
      const lines = block.split(/\r?\n/).map(l => l.trim());
      if (lines.length === 0) return;

      let title = "";
      let artist = "Impor Teks";
      const verses: string[] = [];
      const verseLabels: string[] = [];

      const hasKeyValue = lines.some(l => /^(?:title|judul|artist|author|artis|pencipta):/i.test(l));

      if (hasKeyValue) {
        let currentVerseLines: string[] = [];
        let currentLabel = "Slide 1";
        let slideCount = 1;

        lines.forEach((line) => {
          if (/^(?:title|judul):/i.test(line)) {
            title = line.replace(/^(?:title|judul):/i, "").trim();
          } else if (/^(?:artist|author|artis|pencipta):/i.test(line)) {
            artist = line.replace(/^(?:artist|author|artis|pencipta):/i, "").trim();
          } else if (/^(?:lirik|lyrics|verses|content|lirik_lagu):/i.test(line)) {
            // Skip
          } else {
            const isLabel = /^(?:verse|text|chorus|bridge|tag|ending|pre-chorus|refrain|slide|v\d+|c\d+|b\d+|split|reff|reffrain|bait|bait\s+\d+|reff\s+\d+|slide\s+\d+)/i.test(line) ||
                            (line.startsWith("[") && line.endsWith("]"));
            
            if (isLabel) {
              if (currentVerseLines.length > 0) {
                verses.push(currentVerseLines.join("\n"));
                verseLabels.push(currentLabel);
                currentVerseLines = [];
              }
              currentLabel = line.replace(/[\[\]]/g, "").trim();
            } else {
              if (line) {
                currentVerseLines.push(line);
              } else {
                if (currentVerseLines.length > 0) {
                  verses.push(currentVerseLines.join("\n"));
                  verseLabels.push(currentLabel);
                  currentVerseLines = [];
                  slideCount++;
                  currentLabel = `Slide ${slideCount}`;
                }
              }
            }
          }
        });

        if (currentVerseLines.length > 0) {
          verses.push(currentVerseLines.join("\n"));
          verseLabels.push(currentLabel);
        }
      } else {
        let lineIndex = 0;
        while (lineIndex < lines.length && !lines[lineIndex]) {
          lineIndex++;
        }
        
        if (lineIndex < lines.length) {
          title = lines[lineIndex];
          lineIndex++;
        }
        
        if (lineIndex < lines.length && lines[lineIndex] && !lines[lineIndex].includes(" ") && lines[lineIndex].length < 25) {
          artist = lines[lineIndex];
          lineIndex++;
        }

        let currentVerseLines: string[] = [];
        let slideCount = 1;

        for (let i = lineIndex; i < lines.length; i++) {
          const line = lines[i];
          if (line) {
            currentVerseLines.push(line);
          } else {
            if (currentVerseLines.length > 0) {
              verses.push(currentVerseLines.join("\n"));
              verseLabels.push(`Bait ${slideCount}`);
              currentVerseLines = [];
              slideCount++;
            }
          }
        }

        if (currentVerseLines.length > 0) {
          verses.push(currentVerseLines.join("\n"));
          verseLabels.push(`Bait ${slideCount}`);
        }
      }

      if (title) {
        parsedSongs.push({
          id: `ew-txt-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title,
          artist,
          verses: verses.length > 0 ? verses : ["Lirik kosong"],
          verseLabels: verseLabels.length > 0 ? verseLabels : ["Bait 1"]
        });
      }
    });

    return parsedSongs;
  };

  // 5. Server-side EasyWorship Songs SQLite Database / Binary Paradox / TXT / ZIP ewsx file parser (Super Robust & Unified!)
  app.post("/api/import/ew-songs", upload.any(), async (req: any, res) => {
    try {
      const files: any[] = req.files || [];
      if (req.file && !files.find((f: any) => f.path === req.file.path)) {
        files.push(req.file);
      }
      if (files.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const parseSQLiteWithLyrics = async (mainDbBuffer: Buffer, txDbBuffer?: Buffer) => {
        const songs: any[] = [];
        let lyricsMap = new Map<string, string>();

        if (txDbBuffer) {
          try {
            const txDb = await initSqlJsDatabase(txDbBuffer);
            const tablesRes = txDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (tablesRes.length > 0) {
              const txTables = tablesRes[0].values.map((v: any) => String(v[0]));
              console.log("Found tables in Songs.tx:", txTables);
              let wordsTable = txTables.find(t => t.toLowerCase() === "words" || t.toLowerCase() === "word");
              if (!wordsTable) wordsTable = txTables[0]; // fallback
              
              if (wordsTable) {
                const rows = txDb.exec(`SELECT * FROM "${wordsTable}"`);
                if (rows.length > 0 && rows[0].values.length > 0) {
                  const cols = rows[0].columns.map(c => c.toLowerCase());
                  const idIdx = cols.findIndex(c => c === "id" || c === "pci" || c === "key");
                  const wordIdx = cols.findIndex(c => c === "words" || c === "word" || c === "lyrics" || c === "rtf" || c === "text");
                  
                  if (idIdx !== -1 && wordIdx !== -1) {
                    rows[0].values.forEach((row: any) => {
                      const key = String(row[idIdx] || "").trim();
                      const content = String(row[wordIdx] || "").trim();
                      if (key && content) {
                        lyricsMap.set(key, content);
                      }
                    });
                    console.log(`Loaded ${lyricsMap.size} lyric keys from Songs.tx`);
                  }
                }
              }
            }
            txDb.close();
          } catch (txErr) {
            console.warn("Softouch secondary tx database reading warning/error:", txErr);
          }
        }

        const mainDb = await initSqlJsDatabase(mainDbBuffer);
        const mainTablesRes = mainDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
        if (mainTablesRes.length > 0) {
          const mainTables = mainTablesRes[0].values.map((v: any) => String(v[0]));
          console.log("Found tables in main database:", mainTables);
          let songTable = mainTables.find(t => t.toLowerCase() === "song" || t.toLowerCase() === "songs" || t.toLowerCase() === "lagu");
          if (!songTable) {
            songTable = mainTables.find(t => {
              const l = t.toLowerCase();
              return (l.includes("song") || l.includes("lagu")) && !l.includes("history") && !l.includes("search");
            });
          }
          if (!songTable) songTable = mainTables[0];

          if (songTable) {
            const rows = mainDb.exec(`SELECT * FROM "${songTable}"`);
            if (rows.length > 0 && rows[0].values.length > 0) {
              const cols = rows[0].columns.map(c => c.toLowerCase());
              console.log(`Detected columns in table "${songTable}":`, cols);
              
              let titleIdx = cols.findIndex(c => c === "title" || c === "judul" || c === "name");
              if (titleIdx === -1) titleIdx = 0;

              let wordsIdx = cols.findIndex(c => c === "words" || c === "lyrics" || c === "lyric" || c === "lirik" || c === "text");
              if (wordsIdx === -1) wordsIdx = cols.findIndex(c => c === "body" || c === "content" || c === "txt");

              let authorIdx = cols.findIndex(c => c === "author" || c === "artist" || c === "pencipta");

              let hasUnresolvedPCIs = false;

              rows[0].values.forEach((row: any, index: number) => {
                const rawTitle = String(row[titleIdx] || "").trim();
                const rawAuthor = authorIdx !== -1 && row[authorIdx] ? String(row[authorIdx]).trim() : "EasyWorship";
                let rawWords = wordsIdx !== -1 && row[wordsIdx] ? String(row[wordsIdx]) : "";
                
                if (!rawTitle) return;

                if (rawWords.startsWith("PCI-")) {
                  const resolved = lyricsMap.get(rawWords);
                  if (resolved) {
                    rawWords = resolved;
                  } else {
                    hasUnresolvedPCIs = true;
                  }
                }

                const plainLyrics = rawWords.startsWith("{\\rtf") ? cleanEWRtf(rawWords) : rawWords;
                const { verses, verseLabels } = parseEWSongVerses(plainLyrics || " ");

                songs.push({
                  id: `ew-sqlite-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  title: rawTitle,
                  artist: rawAuthor,
                  verses: verses.length > 0 ? verses : ["Lirik kosong (slide belum didefinisikan)"],
                  verseLabels: verseLabels.length > 0 ? verseLabels : ["Slide 1"]
                });
              });

              if (hasUnresolvedPCIs && !txDbBuffer) {
                (songs as any).requiresSongsTx = true;
              }
            }
          }
        }
        mainDb.close();
        return songs;
      };

      // Read all files into memory buffers and clean up from disk immediately!
      // This prevents any future ENOENT (File Not Found) errors due to pre-mature deletion or unlinking.
      const uploadedFiles = files.map((f: any) => {
        const buffer = fs.readFileSync(f.path);
        try {
          fs.unlinkSync(f.path);
        } catch (unlinkErr) {
          console.warn(`Unlinking temp file warning: ${f.path}`, unlinkErr);
        }
        return {
          name: f.originalname,
          buffer: buffer,
          ext: path.extname(f.originalname).toLowerCase()
        };
      });

      let importedSongs: any[] = [];
      let requiresSongsTx = false;

      // 1. Detect and parse SQLite databases in-memory (automatic table discovery & pairing)
      let mainDbBuffer: Buffer | null = null;
      let txDbBuffer: Buffer | null = null;
      let mainDbName = "unnamed.db";
      let txDbName = "unnamed.tx";

      for (const f of uploadedFiles) {
        const fileBuffer = f.buffer;
        const isSQLite = fileBuffer[0] === 0x53 && fileBuffer[1] === 0x51 && fileBuffer[2] === 0x4C && fileBuffer[3] === 0x69;
        
        if (isSQLite) {
          try {
            const db = await initSqlJsDatabase(fileBuffer);
            const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            let tables: string[] = [];
            if (tablesRes.length > 0) {
              tables = tablesRes[0].values.map((v: any) => String(v[0]).toLowerCase());
            }
            db.close();

            const hasWordsTable = tables.some(t => t === "words" || t === "word" || t.includes("word") || t.includes("lyric"));
            const hasSongTable = tables.some(t => t === "song" || t === "songs" || t.includes("song") || t.includes("lagu"));

            if (hasWordsTable && !hasSongTable) {
              txDbBuffer = fileBuffer;
              txDbName = f.name;
              console.log(`[Auto-Detect SQLite] Assigned ${f.name} as WORDS database (Songs.tx). Tables:`, tables);
            } else if (hasSongTable) {
              mainDbBuffer = fileBuffer;
              mainDbName = f.name;
              console.log(`[Auto-Detect SQLite] Assigned ${f.name} as SONG METADATA database (Songs.db). Tables:`, tables);
            } else {
              // Filename-based fallback
              const nameLower = f.name.toLowerCase();
              if (nameLower.endsWith(".tx") || nameLower.includes("tx")) {
                txDbBuffer = fileBuffer;
                txDbName = f.name;
              } else {
                if (!mainDbBuffer) {
                  mainDbBuffer = fileBuffer;
                  mainDbName = f.name;
                }
              }
            }
          } catch (err) {
            console.error(`Error inspecting SQLite tables for ${f.name}:`, err);
            // Filename fallback on error
            const nameLower = f.name.toLowerCase();
            if (nameLower.endsWith(".tx") || nameLower.includes("tx")) {
              txDbBuffer = fileBuffer;
              txDbName = f.name;
            } else {
              if (!mainDbBuffer) {
                mainDbBuffer = fileBuffer;
                mainDbName = f.name;
              }
            }
          }
        }
      }

      // Case A: SQLite Databases (Songs.db and optionally Songs.tx) found
      if (mainDbBuffer) {
        console.log(`Direct SQLite extraction of paired databases: Main: ${mainDbName}, Words: ${txDbBuffer ? txDbName : 'None'}`);
        const parsed = await parseSQLiteWithLyrics(mainDbBuffer, txDbBuffer || undefined);
        importedSongs = parsed;
        if ((parsed as any).requiresSongsTx) {
          requiresSongsTx = true;
        }
      }
      // Case B: Parse schedules/archives (.ewsx, .zip, etc.) or other single files
      else {
        for (const f of uploadedFiles) {
          const fileBuffer = f.buffer;
          const fileExt = f.ext;
          const isZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
          const fileContentStr = fileBuffer.toString("utf-8").trim();
          const cleanFileContentStr = fileContentStr.replace(/^\uFEFF/, "").trim();
          const isXML = cleanFileContentStr.startsWith("<") || fileExt === ".xml" || (fileExt === ".song" && (cleanFileContentStr.includes("<Song") || cleanFileContentStr.includes("<Item") || cleanFileContentStr.includes("<ScheduleItem")));

          if (isXML) {
            console.log("Parsing direct XML file:", f.name);
            importedSongs = parseRawXMLSongs(cleanFileContentStr);
          }
          else if (isZip || fileExt === ".ewsx" || fileExt === ".song" || fileExt === ".ewdb") {
            if (isZip) {
              console.log("ZIP/EWSX parsing triggered:", f.name);
              try {
                const zip = new AdmZip(fileBuffer);
                const zipEntries = zip.getEntries();

                let zipMainDbBuf: Buffer | null = null;
                let zipTxDbBuf: Buffer | null = null;

                // 1. First, check if ZIP has internal Songs.db / Songs.tx databases
                for (const entry of zipEntries) {
                  const entryNameLower = entry.entryName.toLowerCase();
                  const baseName = path.basename(entryNameLower);
                  if (baseName === "songs.db" || (baseName.endsWith(".db") && !baseName.includes("history") && !baseName.includes("search") && !baseName.endsWith(".tx"))) {
                    const data = entry.getData();
                    if (data[0] === 0x53 && data[1] === 0x51 && data[2] === 0x4C && data[3] === 0x69) {
                      zipMainDbBuf = data;
                    }
                  }
                  if (baseName === "songs.tx" || baseName.endsWith(".tx") || (baseName.endsWith(".db") && baseName.includes("songs.tx"))) {
                    const data = entry.getData();
                    if (data[0] === 0x53 && data[1] === 0x51 && data[2] === 0x4C && data[3] === 0x69) {
                      zipTxDbBuf = data;
                    }
                  }
                }

                if (zipMainDbBuf) {
                  console.log("Found Songs.db (and optionally Songs.tx) inside ZIP. Extracting...");
                  const parsed = await parseSQLiteWithLyrics(zipMainDbBuf, zipTxDbBuf || undefined);
                  importedSongs.push(...parsed);
                  if ((parsed as any).requiresSongsTx) {
                    requiresSongsTx = true;
                  }
                } else {
                  // 2. If no SQLite DB inside ZIP, process every XML/JSON/Plain lyric file inside the ZIP!
                  // We check magic headers / startsWith to support extensionless files seamlessly.
                  for (const entry of zipEntries) {
                    if (entry.isDirectory) continue;
                    
                    const entryData = entry.getData();
                    if (!entryData || entryData.length === 0) continue;

                    const fileContent = entryData.toString("utf-8");
                    const cleanContent = fileContent.replace(/^\uFEFF/, "").trim();

                    // A. Check if standard XML
                    if (cleanContent.startsWith("<")) {
                      const xmlSongs = parseRawXMLSongs(cleanContent);
                      if (xmlSongs && xmlSongs.length > 0) {
                        importedSongs.push(...xmlSongs);
                        console.log(`Parsed ${xmlSongs.length} XML songs from ZIP entry: ${entry.entryName}`);
                        continue;
                      }
                    }

                    // B. Check if JSON
                    if (cleanContent.startsWith("[") || cleanContent.startsWith("{")) {
                      try {
                        const parsed = JSON.parse(cleanContent);
                        if (Array.isArray(parsed)) {
                          parsed.forEach((s: any, entryIdx: number) => {
                            if (s && s.title && Array.isArray(s.verses)) {
                              importedSongs.push({
                                id: s.id || `ew-zip-json-${entryIdx}-${Date.now()}`,
                                title: s.title,
                                artist: s.artist || "EasyWorship Backup",
                                verses: s.verses,
                                verseLabels: s.verseLabels || s.verses.map((_: any, i: number) => `Bait ${i+1}`)
                              });
                            }
                          });
                        }
                      } catch (e) {}
                      continue;
                    }

                    // C. Support fallback RTF carving inside ZIP entries if they are binary lirik blocks
                    const entryNameLower = entry.entryName.toLowerCase();
                    if (entryNameLower.endsWith(".db") || entryNameLower.endsWith(".tx") || entryNameLower.endsWith(".dat") || entryNameLower.endsWith(".mb")) {
                      const carved = carveEWSongs(entryData);
                      if (carved && carved.length > 0) {
                        importedSongs.push(...carved);
                        console.log(`Carved ${carved.length} songs from ZIP entry: ${entry.entryName}`);
                      }
                    }
                  }
                }
              } catch (zipErr) {
                console.error("ZIP/EWSX decompression & parsing fail:", zipErr);
              }
            }

            // If zip parsing failed or yielded 0 songs, run binary carving fallback on the raw ZIP buffer
            if (importedSongs.length === 0) {
              importedSongs = carveEWSongs(fileBuffer);
            }
          }
          else if (fileExt === ".json" || fileBuffer[0] === 0x5B || fileBuffer[0] === 0x7B) {
            try {
              const parsed = JSON.parse(cleanFileContentStr);
              if (Array.isArray(parsed)) {
                parsed.forEach((s: any, entryIdx: number) => {
                  if (s && s.title && Array.isArray(s.verses)) {
                    importedSongs.push({
                      id: s.id || `ew-json-${entryIdx}-${Date.now()}`,
                      title: s.title,
                      artist: s.artist || "EasyWorship Backup",
                      verses: s.verses,
                      verseLabels: s.verseLabels || s.verses.map((_: any, i: number) => `Bait ${i+1}`)
                    });
                  }
                });
              }
            } catch (e: any) {
              console.error("Failed to parse JSON file:", e);
            }
          }
          else if (fileExt === ".txt") {
            try {
              const textContent = fileBuffer.toString("utf-8");
              importedSongs = backendParseTextSongs(textContent);
            } catch (e) {
              console.error("Failed to parse TXT file:", e);
            }
          }
          else {
            importedSongs = carveEWSongs(fileBuffer);
          }
        }
      }

      if (importedSongs.length === 0) {
        // Build detailed friendly report of what we parsed so the user knows exactly why it's not working!
        const sampleFile = uploadedFiles[0];
        const sampleBuffer = sampleFile.buffer;
        const sampleExt = sampleFile.ext;
        const isSampleSQLite = sampleBuffer[0] === 0x53 && sampleBuffer[1] === 0x51 && sampleBuffer[2] === 0x4C && sampleBuffer[3] === 0x69;
        const isSampleZip = sampleBuffer[0] === 0x50 && sampleBuffer[1] === 0x4B && sampleBuffer[2] === 0x03 && sampleBuffer[3] === 0x04;

        let hexSig = "";
        try {
          hexSig = sampleBuffer.slice(0, 16).toString("hex").toUpperCase();
        } catch (e) {}

        let fileHeaderSample = "";
        try {
          fileHeaderSample = sampleBuffer.slice(0, 50).toString("ascii").replace(/[^\x20-\x7E]/g, ".");
        } catch (e) {}

        let docTables: string[] = [];
        let sqliteErrorStr = "";
        if (isSampleSQLite) {
          try {
            const db = await initSqlJsDatabase(sampleBuffer);
            const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (tableRes.length > 0) {
              docTables = tableRes[0].values.map((rowArr: any) => String(rowArr[0]));
            }
            db.close();
          } catch (e: any) {
            sqliteErrorStr = e.message || String(e);
          }
        }

        let debugMsg = `Tidak ada lagu valid yang berhasil diekstrak.\n\nDetail Berkas:\n`;
        debugMsg += `- Nama Berkas: "${sampleFile.name}"\n`;
        debugMsg += `- Ekstensi: "${sampleExt}"\n`;
        debugMsg += `- Ukuran: ${(sampleBuffer.length / 1024).toFixed(1)} KB\n`;
        debugMsg += `- Signature Pertama (Hex): ${hexSig}\n`;
        debugMsg += `- Contoh Header: "${fileHeaderSample}"\n`;

        if (isSampleSQLite) {
          debugMsg += `- Jenis Berkas: Terdeteksi database SQLite\n`;
          if (sqliteErrorStr) {
            debugMsg += `- Galat SQLite: ${sqliteErrorStr}\n`;
          } else {
            debugMsg += `- Tabel Terdeteksi: ${docTables.length > 0 ? "[" + docTables.join(", ") + "]" : "(Tidak ada tabel)"}\n`;
            debugMsg += `\n💡 Saran: Pastikan database ini berisi data lagu lirik EasyWorship. Jika Anda menggunakan EasyWorship 6 atau 7, harap unggah Songs.db DAN Songs.tx bersama-sama agar lirik lagu dapat diekstrak.\n\n`;
            debugMsg += `💡 APAKAH BERKAS 'Songs.tx' TIDAK DITEMUKAN?\n`;
            debugMsg += `- Secara bawaan, Windows menyembunyikan ekstensi berkas. Di folder data Anda, akan terlihat DUA berkas yang namanya sama-sama hanya 'Songs'. Satu adalah Songs.db dan satunya Songs.tx (dengan tipe ikon / deskripsi file yang berbeda). Silakan pilih KEDUA berkas tersebut secara bersamaan saat mengunggah!\n`;
            debugMsg += `- Metode yang jauh LEBIH MUDAH: Di EasyWorship, kumpulkan lagu ke jadwal (Schedule), simpan jadwal sebagai berkas Jadwal (.ewsx), lalu unggah berkas .ewsx tersebut ke sini. Sistem akan langsung mengambil liriknya secara instan!`;
          }
        } else if (isSampleZip) {
          debugMsg += `- Jenis Berkas: ZIP / Jadwal (.ewsx)\n`;
          debugMsg += `\n💡 Saran: Pastikan file Jadwal (.ewsx) atau file ZIP tersebut berisi lirik lagu yang valid.\n`;
        } else {
          debugMsg += `- Jenis Berkas: Biner Non-SQLite (DBISAM / Paradox / Format Lain)\n`;
          debugMsg += `\n💡 Saran EasyWorship 2009: Jangan upload berkas 'Songs.db' saja! Di EasyWorship 2009, lirik lagunya disimpan di berkas 'Songs.MB'. \n👉 Harap pilih dan unggah berkas berkas 'Songs.MB' sebagai gantinya agar liriknya dapat diekstrak oleh sistem!\n`;
        }

        return res.status(400).json({ error: debugMsg });
      }

      const songsPath = path.join(process.cwd(), "uploads", "custom_songs.json");
      let existingSongs: any[] = [];
      if (fs.existsSync(songsPath)) {
        try {
          const raw = fs.readFileSync(songsPath, "utf-8");
          existingSongs = JSON.parse(raw);
          if (!Array.isArray(existingSongs)) {
            existingSongs = [];
          }
        } catch (err) {
          existingSongs = [];
        }
      }

      const incomingTitles = new Set(importedSongs.map((s: any) => s.title.toLowerCase()));
      const filteredExisting = existingSongs.filter((s: any) => s && s.title && !incomingTitles.has(s.title.toLowerCase()));
      const mergedSongs = [...importedSongs, ...filteredExisting];

      fs.writeFileSync(songsPath, JSON.stringify(mergedSongs, null, 2), "utf-8");

      // Cleanup all uploaded files on success
      files.forEach((f: any) => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });

      console.log(`Backend successfully processed & SAVED EasyWorship: extracted ${importedSongs.length} songs, total library on disk: ${mergedSongs.length}`);
      return res.json({ songs: importedSongs, requiresSongsTx });
    } catch (e: any) {
      console.error("Backend process EW songs fail:", e);
      const filesToCleanup: any[] = req.files || [];
      if (req.file && !filesToCleanup.find((f: any) => f.path === req.file.path)) {
        filesToCleanup.push(req.file);
      }
      filesToCleanup.forEach((f: any) => {
        try { fs.unlinkSync(f.path); } catch (err) {}
      });
      return res.status(500).json({ error: e.message || "Gagal memproses lagu." });
    }
  });

  // 6. Server-side EasyWorship Bibles SQLite file parser (Super Robust!)
  app.post("/api/import/ew-bible", upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileBuffer = fs.readFileSync(file.path);
      let finalSqliteBuffer = fileBuffer;

      // 1. Check if the uploaded file is a ZIP archive (like an EasyWorship .ewb file or zipped database)
      const isZip = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
      if (isZip) {
        console.log("Uploaded Bible file is a ZIP (.ewb). Extracting SQLite database inside...");
        try {
          const zip = new AdmZip(file.path);
          const zipEntries = zip.getEntries();
          
          // Find any entry with extension .db or .sqlite or containing "bible"
          let dbEntry = zipEntries.find((entry) => {
            const name = entry.entryName.toLowerCase();
            return !entry.isDirectory && (name.endsWith(".db") || name.endsWith(".sqlite") || name.includes("bible"));
          });

          // Fallback to first non-directory file if no .db/.sqlite extension
          if (!dbEntry) {
            dbEntry = zipEntries.find(entry => !entry.isDirectory && entry.entryName.length > 0);
          }

          if (dbEntry) {
            console.log(`Found database inside ZIP: ${dbEntry.entryName}`);
            finalSqliteBuffer = dbEntry.getData();
          } else {
            try { fs.unlinkSync(file.path); } catch (e) {}
            return res.status(400).json({ error: "Berkas .ewb tidak berisi database (.db / .sqlite) Alkitab yang valid di dalamnya." });
          }
        } catch (zipErr: any) {
          console.error("Gagal mengekstrak berkas ZIP .ewb:", zipErr);
          try { fs.unlinkSync(file.path); } catch (e) {}
          return res.status(500).json({ error: `Gagal mengekstrak berkas .ewb: ${zipErr.message || zipErr}` });
        }
      }

      // Check SQLite Header on the resulting buffer
      if (finalSqliteBuffer[0] !== 0x53 || finalSqliteBuffer[1] !== 0x51 || finalSqliteBuffer[2] !== 0x4C || finalSqliteBuffer[3] !== 0x69) {
        try { fs.unlinkSync(file.path); } catch (e) {}
        return res.status(400).json({ error: "Berkas yang diunggah atau hasil ekstraksi bukan database SQLite (.db / .ewb) yang valid." });
      }

      // Load SQL.js in Node
      const db = await initSqlJsDatabase(finalSqliteBuffer);

      // Fetch tables
      const tableRes = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tableRes.length === 0) {
        db.close();
        try { fs.unlinkSync(file.path); } catch (e) {}
        return res.status(400).json({ error: "Berkas SQLite Alkitab ini kosong." });
      }

      const originalTables = tableRes[0].values.map((rowArr: any) => String(rowArr[0]));
      console.log("Bible SQLite original tables:", originalTables);

      let verseTable = "";
      let bookTable = "";
      let vBookIdIdx = -1;
      let vChapIdx = -1;
      let vVerseIdx = -1;
      let vTextIdx = -1;
      let bookIdIdx = -1;
      let bookNameIdx = -1;

      // Super Robust Score-based table and column matching for verses
      let bestVerseScore = -1;
      for (const tableName of originalTables) {
        let columnsRes;
        try {
          columnsRes = db.exec(`SELECT * FROM "${tableName}" LIMIT 1`);
        } catch (_) {
          continue;
        }
        if (columnsRes.length === 0) continue;
        const columns = columnsRes[0].columns.map((c: string) => c.toLowerCase());
        console.log(`Analyzing database table "${tableName}" with columns:`, columns);

        // Find Book ID column score
        let bestBScore = -1;
        let bestBIndex = -1;
        columns.forEach((c: string, idx: number) => {
          let score = 0;
          if (c === "b" || c === "book" || c === "book_id" || c === "bookid" || c === "kitab" || c === "id_kitab" || c === "volume" || c === "vol") score = 100;
          else if (c.includes("book") || c.includes("kitab") || c.includes("volume") || c.includes("vol") || c.includes("b_id") || c.includes("book_id")) score = 80;
          else if (c === "b_id" || c === "bid" || c === "id_buku" || c === "buku") score = 70;
          else if (c === "id") score = 20;

          if (score > bestBScore) {
            bestBScore = score;
            bestBIndex = idx;
          }
        });

        // Find Chapter column score
        let bestCScore = -1;
        let bestCIndex = -1;
        columns.forEach((c: string, idx: number) => {
          let score = 0;
          if (c === "c" || c === "chapter" || c === "pasal" || c === "ch") score = 100;
          else if (c.includes("chapter") || c.includes("pasal") || c.includes("chap") || c.includes("pasal_id")) score = 80;
          else if (c === "c_id" || c === "cid") score = 70;

          if (score > bestCScore) {
            bestCScore = score;
            bestCIndex = idx;
          }
        });

        // Find Verse column score
        let bestVScore = -1;
        let bestVIndex = -1;
        columns.forEach((c: string, idx: number) => {
          let score = 0;
          if (c === "v" || c === "verse" || c === "ayat" || c === "ver") score = 100;
          else if (c.includes("verse") || c.includes("ayat") || c.includes("ver")) score = 80;
          else if (c === "v_id" || c === "vid") score = 70;

          if (score > bestVScore) {
            bestVScore = score;
            bestVIndex = idx;
          }
        });

        // Find Text column score
        let bestTScore = -1;
        let bestTIndex = -1;
        columns.forEach((c: string, idx: number) => {
          let score = 0;
          if (c === "t" || c === "text" || c === "words" || c === "content" || c === "isi" || c === "body" || c === "lyrics") score = 100;
          else if (c.includes("text") || c.includes("word") || c.includes("content") || c.includes("isi") || c.includes("body") || c.includes("lyrics") || c.includes("rtf")) score = 80;
          else if (c === "w" || c === "t_id") score = 60;

          if (score > bestTScore) {
            bestTScore = score;
            bestTIndex = idx;
          }
        });

        // Total score calculation
        if (bestBIndex !== -1 && bestCIndex !== -1 && bestVIndex !== -1 && bestTIndex !== -1) {
          const indices = new Set([bestBIndex, bestCIndex, bestVIndex, bestTIndex]);
          if (indices.size === 4) {
            let totalScore = bestBScore + bestCScore + bestVScore + bestTScore;
            // Additional bonus if tableName is typical
            const lTable = tableName.toLowerCase();
            if (lTable.includes("verse") || lTable === "v" || lTable.includes("alkitab") || lTable.includes("bible")) {
              totalScore += 100;
            }
            if (totalScore > bestVerseScore) {
              bestVerseScore = totalScore;
              verseTable = tableName;
              vBookIdIdx = bestBIndex;
              vChapIdx = bestCIndex;
              vVerseIdx = bestVIndex;
              vTextIdx = bestTIndex;
            }
          }
        }
      }

      console.log(`Detected best candidate verseTable: "${verseTable}" with score ${bestVerseScore}`);

      // Fallback if we still haven't found a verse table by score
      if (!verseTable) {
        verseTable = originalTables.find((t: string) => 
          t.toLowerCase().includes("verse") || t.toLowerCase() === "v" || t.toLowerCase().includes("content") || t.toLowerCase().includes("detail") || t.toLowerCase().includes("tb") || t.toLowerCase().includes("alkitab") || t.toLowerCase().includes("bible")
        ) || originalTables[0];

        let columnsRes = db.exec(`SELECT * FROM "${verseTable}" LIMIT 1`);
        if (columnsRes.length > 0) {
          const columns = columnsRes[0].columns.map((c: string) => c.toLowerCase());
          vBookIdIdx = columns.findIndex((c: string) => c === "b" || c.includes("book") || c.includes("kitab") || c === "b_id" || c === "book_id" || c === "bookid" || c === "id_kitab" || c === "volume");
          vChapIdx = columns.findIndex((c: string) => c === "c" || c.includes("chap") || c.includes("pasal") || c === "chapter" || c === "pasal_id");
          vVerseIdx = columns.findIndex((c: string) => c === "v" || c.includes("verse") || c.includes("ayat"));
          vTextIdx = columns.findIndex((c: string) => c === "t" || c.includes("text") || c.includes("words") || c.includes("body") || c.includes("content") || c.includes("isi"));
          
          if (vBookIdIdx === -1) vBookIdIdx = 0;
          if (vChapIdx === -1) vChapIdx = columns.length > 1 ? 1 : 0;
          if (vVerseIdx === -1) vVerseIdx = columns.length > 2 ? 2 : 0;
          if (vTextIdx === -1) vTextIdx = columns.length - 1;
        }
        console.log(`Fallback selected verses table: "${verseTable}"`);
      }

      // Look for a candidate of "books" table using robust score-based approach
      let bestBookTableScore = -1;
      for (const tableName of originalTables) {
        if (tableName === verseTable) continue;
        let columnsRes;
        try {
          columnsRes = db.exec(`SELECT * FROM "${tableName}" LIMIT 1`);
        } catch (_) {
          continue;
        }
        if (columnsRes.length === 0) continue;
        const columns = columnsRes[0].columns.map((c: string) => c.toLowerCase());

        let tableBestIdIdx = -1;
        let tableBestIdScore = 0;
        columns.forEach((col, idx) => {
          let score = 0;
          if (col === "id" || col === "book_id" || col === "bookid" || col === "volume" || col === "vol" || col === "b_id" || col === "id_kitab" || col === "id_buku") {
            score = 100;
          } else if (col === "key" || col === "code" || col === "num" || col === "number" || col === "b" || col === "bid") {
            score = 80;
          } else if (col.includes("id") || col.includes("volume") || col.includes("code") || col.includes("key") || col.includes("num")) {
            score = 50;
          }
          if (score > tableBestIdScore) {
            tableBestIdScore = score;
            tableBestIdIdx = idx;
          }
        });

        let tableBestNameIdx = -1;
        let tableBestNameScore = 0;
        columns.forEach((col, idx) => {
          let score = 0;
          if (col === "name" || col === "title" || col === "nama" || col === "book" || col === "book_name" || col === "bookname" || col === "nama_kitab") {
            score = 100;
          } else if (col === "label" || col === "shortname" || col === "short_name" || col === "abbrev" || col === "abbreviation") {
            score = 80;
          } else if (col.includes("name") || col.includes("nama") || col.includes("title") || col.includes("label") || col.includes("kitab") || col.includes("buku")) {
            score = 60;
          }
          if (score > tableBestNameScore) {
            tableBestNameScore = score;
            tableBestNameIdx = idx;
          }
        });

        if (tableBestIdIdx !== -1 && tableBestNameIdx !== -1 && tableBestIdIdx !== tableBestNameIdx) {
          let tableScore = tableBestIdScore + tableBestNameScore;
          const lTable = tableName.toLowerCase();
          if (lTable.includes("book") || lTable.includes("kitab") || lTable.includes("buku") || lTable.includes("volume") || lTable === "b") {
            tableScore += 100;
          }
          if (tableScore > bestBookTableScore) {
            bestBookTableScore = tableScore;
            bookTable = tableName;
            bookIdIdx = tableBestIdIdx;
            bookNameIdx = tableBestNameIdx;
          }
        }
      }
      if (bookTable) {
        console.log(`Selected books table: "${bookTable}" (ID col: ${bookIdIdx}, Name col: ${bookNameIdx}) with score ${bestBookTableScore}`);
      }

      // Read books map if bookTable exists
      const bookMap: { [key: number]: string } = {};
      if (bookTable) {
        try {
          const booksRes = db.exec(`SELECT * FROM "${bookTable}"`);
          if (booksRes.length > 0) {
            booksRes[0].values.forEach((rowArr: any) => {
              const id = parseInt(rowArr[bookIdIdx]);
              const rawName = rowArr[bookNameIdx] || "";
              if (!isNaN(id)) {
                bookMap[id] = normalizeBibleBookName(id, rawName);
              }
            });
          }
        } catch (err) {
          console.error("Error reading books table, will fallback to ID mapping:", err);
        }
      }

      // Read verses
      const versesQuery = `SELECT * FROM "${verseTable}"`;
      const versesRes = db.exec(versesQuery);
      if (versesRes.length === 0) {
        db.close();
        try { fs.unlinkSync(file.path); } catch (e) {}
        return res.status(400).json({ error: `Tidak menemukan data ayat pada tabel (${verseTable}).` });
      }

      const parsedBooks: any = {};
      versesRes[0].values.forEach((rowArr: any) => {
        const val = rowArr[vBookIdIdx];
        let bookName = "";
        if (val !== null && val !== undefined) {
          const numVal = Number(val);
          if (!isNaN(numVal) && String(val).trim() !== "") {
            const bookId = Math.round(numVal);
            bookName = bookMap[bookId] || normalizeBibleBookName(bookId, "");
          } else {
            bookName = normalizeBibleBookName(0, String(val));
          }
        }
        if (!bookName) bookName = "Alkitab";

        const chapter = String(rowArr[vChapIdx] || "1");
        const verseNum = parseInt(rowArr[vVerseIdx] || "1") || 1;
        const rawText = rowArr[vTextIdx] || "";
        const cleanText = rawText.startsWith("{\\rtf") ? cleanEWRtf(rawText) : rawText;

        if (!parsedBooks[bookName]) {
          parsedBooks[bookName] = {};
        }
        if (!parsedBooks[bookName][chapter]) {
          parsedBooks[bookName][chapter] = [];
        }
        parsedBooks[bookName][chapter][verseNum - 1] = cleanText;
      });

      // Fill empty verses
      Object.keys(parsedBooks).forEach(bName => {
        Object.keys(parsedBooks[bName]).forEach(cNum => {
          const arr = parsedBooks[bName][cNum];
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === undefined) {
              arr[i] = `[Pasal ${cNum}:${i + 1} kosong]`;
            }
          }
        });
      });

      db.close();
      try { fs.unlinkSync(file.path); } catch (e) {}

      const origName = file.originalname.replace(/\.[^/.]+$/, "").toUpperCase();
      const bibleId = `ew-${origName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      
      const newBibleFull = {
        id: bibleId,
        name: `EasyWorship Alkitab - ${origName}`,
        books: parsedBooks
      };

      const newBibleMetadata = {
        id: bibleId,
        name: `EasyWorship Alkitab - ${origName}`,
        bookNames: Object.keys(parsedBooks)
      };

      // 1. Write the full-text Bible to its isolated Database file on the server
      try {
        const biblesDir = path.join(process.cwd(), "uploads", "bibles");
        if (!fs.existsSync(biblesDir)) {
          fs.mkdirSync(biblesDir, { recursive: true });
        }
        const individualPath = path.join(biblesDir, `${bibleId}.json`);
        fs.writeFileSync(individualPath, JSON.stringify(newBibleFull, null, 2), "utf-8");
        console.log(`Backend sukses menyimpan isolated bible: ${individualPath}`);
      } catch (err) {
        console.error("Gagal menyimpan isolated bible file:", err);
      }

      // 2. Background persistence of lightweight metadata to custom_bibles.json
      const biblesPath = path.join(process.cwd(), "uploads", "custom_bibles.json");
      let currentBibles: any[] = [];
      try {
        if (fs.existsSync(biblesPath)) {
          const contents = fs.readFileSync(biblesPath, "utf-8");
          currentBibles = JSON.parse(contents);
          if (!Array.isArray(currentBibles)) {
            currentBibles = [];
          }
        }
      } catch (err) {
        console.error("Gagal membaca database custom_bibles.json:", err);
      }

      // Filter out duplicate or matching IDs and write the lightweight entry
      currentBibles = currentBibles.filter((b: any) => b.id !== bibleId);
      currentBibles.unshift(newBibleMetadata);

      // Write back the clean list to the server index
      try {
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        fs.writeFileSync(biblesPath, JSON.stringify(currentBibles, null, 2), "utf-8");
        console.log(`Backend sukses menyimpan metadata '${newBibleMetadata.name}' ke index (${biblesPath})`);
      } catch (writeErr) {
        console.error("Gagal menyimpan alkitab ke index kustom:", writeErr);
      }

      console.log(`Backend successfully processed EasyWorship Bible: ${newBibleMetadata.name}`);
      return res.json({ bible: newBibleMetadata });
    } catch (e: any) {
      console.error("Backend process EW bible fail:", e);
      try { if (req.file) fs.unlinkSync(req.file.path); } catch (err) {}
      return res.status(500).json({ error: e.message || "Gagal memproses database Alkitab." });
    }
  });

  // Endpoint to parse schedule files (.chr, .pptx, .ewsx)
  app.post("/api/import/schedule-file", upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const originalName = file.originalname;
      const ext = path.extname(originalName).toLowerCase();
      const fileBuffer = fs.readFileSync(file.path);
      
      // Cleanup temp disk file
      try { fs.unlinkSync(file.path); } catch (err) {}

      let scheduleItems: any[] = [];

      if (ext === ".chr") {
        // Simple .chr presentation format (JSON)
        try {
          const content = fileBuffer.toString("utf-8");
          const parsed = JSON.parse(content);
          if (parsed && parsed.format === "church-presenter" && Array.isArray(parsed.schedule)) {
            scheduleItems = parsed.schedule;
          } else if (Array.isArray(parsed)) {
            scheduleItems = parsed;
          } else {
            throw new Error("Invalid .chr file structure");
          }
        } catch (err: any) {
          return res.status(400).json({ error: "Gagal membaca berkas .chr: " + err.message });
        }
      } 
      else if (ext === ".pptx") {
        // Parse PPTX slides using adm-zip
        try {
          const zip = new AdmZip(fileBuffer);
          const zipEntries = zip.getEntries();
          
          // Filter entries for slides: ppt/slides/slide1.xml, slide2.xml, etc.
          const slideEntries = zipEntries.filter(entry => 
            /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName)
          );
          
          if (slideEntries.length === 0) {
            throw new Error("Tidak ditemukan slide terbaca dalam PowerPoint ini.");
          }

          // Sort numerically
          slideEntries.sort((a, b) => {
            const numA = parseInt(a.entryName.match(/\d+/)?.[0] || "0", 10);
            const numB = parseInt(b.entryName.match(/\d+/)?.[0] || "0", 10);
            return numA - numB;
          });

          const decodeXmlEntities = (str: string) => {
            return str
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&nbsp;/g, " ");
          };

          const verses: string[] = [];
          slideEntries.forEach((entry) => {
            const xmlContent = entry.getData().toString("utf-8");
            const matches = xmlContent.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
            const slideText = matches
              .map(m => m.replace(/<a:t>|<\/a:t>/g, "").trim())
              .filter(Boolean)
              .map(decodeXmlEntities)
              .join(" ");

            if (slideText) {
              verses.push(slideText);
            }
          });

          if (verses.length === 0) {
            verses.push("Empty Slide Content (No text frame detected)");
          }

          const baseTitle = path.basename(originalName, ext);
          scheduleItems.push({
            id: `pptx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: baseTitle,
            type: "slide",
            verses: verses,
            verseLabels: verses.map((_, i) => `Slide ${i + 1}`)
          });
        } catch (err: any) {
          return res.status(400).json({ error: "Gagal memproses PowerPoint (.pptx): " + err.message });
        }
      } 
      else if (ext === ".ewsx" || ext === ".zip") {
        // Parse EasyWorship schedule zip .ewsx
        try {
          const zip = new AdmZip(fileBuffer);
          const zipEntries = zip.getEntries();
          
          let parsedDone = false;

          const decodeXmlEntities = (str: string) => {
            return str
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'")
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .replace(/&nbsp;/g, " ");
          };

          // 1. Look for Schedule.json or schedule.json first (modern EW formats)
          const scheduleJsonEntry = zipEntries.find(entry => 
            /schedule\.json$/i.test(entry.entryName)
          );

          if (scheduleJsonEntry) {
            try {
              const textContent = scheduleJsonEntry.getData().toString("utf-8");
              const parsed = JSON.parse(textContent.replace(/^\uFEFF/, ""));
              
              const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.ScheduleItems || []);
              if (Array.isArray(list)) {
                list.forEach((item: any, idx: number) => {
                  const title = item.title || item.Title || item.name || item.Name || `EW Slide ${idx + 1}`;
                  const rawWords = item.words || item.Words || item.lyrics || item.Lyrics || item.text || item.Text || "";
                  const plainLyrics = rawWords.startsWith("{\\rtf") ? cleanEWRtf(rawWords) : rawWords;
                  const { verses, verseLabels } = parseEWSongVerses(plainLyrics || " ");

                  scheduleItems.push({
                    id: `ew-json-item-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    title: title,
                    type: "song",
                    verses: verses,
                    verseLabels: verseLabels
                  });
                });
                parsedDone = true;
              }
            } catch (jsonErr) {
              console.warn("Failed parsing schedule.json from .ewsx:", jsonErr);
            }
          }

          // 2. Check XML entries (especially Schedule.xml inside the .ewsx / .zip)
          if (!parsedDone) {
            // Get all xml files inside zip
            const xmlEntries = zipEntries.filter(entry => 
              entry.entryName.toLowerCase().endsWith(".xml")
            );

            // Sort so schedule.xml or Schedule.xml comes first
            xmlEntries.sort((a, b) => {
              const nameA = a.entryName.toLowerCase();
              const nameB = b.entryName.toLowerCase();
              if (nameA.endsWith("schedule.xml") && !nameB.endsWith("schedule.xml")) return -1;
              if (!nameA.endsWith("schedule.xml") && nameB.endsWith("schedule.xml")) return 1;
              return 0;
            });

            for (const entry of xmlEntries) {
              if (entry.isDirectory) continue;
              const textContent = entry.getData().toString("utf-8");
              const cleanContent = textContent.replace(/^\uFEFF/, "").trim();

              if (cleanContent.startsWith("<")) {
                const results = parseEWXmlSchedule(cleanContent, decodeXmlEntities);
                if (results && results.length > 0) {
                  scheduleItems.push(...results);
                  parsedDone = true;
                  // If we processed schedule.xml specifically, we might be totally done.
                  if (entry.entryName.toLowerCase().endsWith("schedule.xml")) {
                    break;
                  }
                }
              }
            }
          }

          if (scheduleItems.length === 0) {
            throw new Error("Format jadwal .ewsx tidak dikenali atau rincian item jadwal kosong.");
          }
        } catch (err: any) {
          return res.status(400).json({ error: "Gagal memproses EasyWorship (.ewsx): " + err.message });
        }
      } 
      else {
        return res.status(400).json({ error: "Ekstensi file tidak didukung. Unggah .chr, .pptx, atau .ewsx." });
      }

      console.log(`Successfully parsed schedule file: ${originalName} with ${scheduleItems.length} items.`);
      return res.json({ success: true, schedule: scheduleItems });
    } catch (e: any) {
      console.error("Schedule parsing route failed:", e);
      return res.status(500).json({ error: e.message || "Gagal memproses file jadwal." });
    }
  });

  app.get("/api/hkbp", async (req, res) => {
    const rawEndpoint = Array.isArray(req.query?.endpoint)
      ? req.query.endpoint[0]
      : req.query?.endpoint;
    const endpoint = String(rawEndpoint || "").replace(/^\/+/, "").trim();
    if (!/^(buku-ende|buku-nyanyian)\/songs(\/[a-zA-Z0-9_-]+)?$/.test(endpoint)) {
      return res.status(400).json({ error: "Invalid HKBP endpoint" });
    }
    try {
      const targetUrl = `https://api.hkbp.or.id/api/v1/${endpoint}`;
      const upstream = await fetch(targetUrl, {
        headers: {
          Origin: "https://hkbp.or.id",
          Referer: "https://hkbp.or.id/",
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ChurchPresenter/1.0)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `HKBP upstream HTTP ${upstream.status}` });
      }
      const data = await upstream.json();
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || "Failed to fetch from HKBP API" });
    }
  });

  app.post("/api/ai/scripture", async (req, res) => {
    const { query, book, chapter, version, displayBook } = req.body;
    const bibleVersion = version || "tb";
    const isBatak = bibleVersion === "toba";
    const isGNTD = bibleVersion === "gntd";
    const versionLabel = isBatak ? "Batak Toba" : isGNTD ? "Good News (GNTD)" : "Terjemahan Baru (TB)";
    const bookTitle = displayBook || book;
    
    // Mapping for Bible Slugs (English) for API compatibility
    const BIBLE_SLUGS: Record<string, string> = {
      "Kejadian": "genesis", "Keluaran": "exodus", "Imamat": "leviticus", "Bilangan": "numbers", "Ulangan": "deuteronomy",
      "Yosua": "joshua", "Hakim-hakim": "judges", "Rut": "rut", "1 Samuel": "1samuel", "2 Samuel": "2samuel",
      "1 Raja-raja": "1kings", "2 Raja-raja": "2kings", "1 Tawarikh": "1chronicles", "2 Tawarikh": "2chronicles",
      "Ezra": "ezra", "Nehemia": "nehemiah", "Ester": "esther", "Ayub": "job", "Mazmur": "psalms", "Amsal": "proverbs",
      "Pengkhotbah": "ecclesiastes", "Kidung Agung": "song-of-solomon", "Yesaya": "isaiah", "Yeremia": "jeremiah", "Ratapan": "lamentations",
      "Yehezkiel": "ezekiel", "Daniel": "daniel", "Hosea": "hosea", "Yoel": "joel", "Amos": "amos", "Obaja": "obadiah",
      "Yunus": "jonah", "Mikha": "micah", "Nahum": "nahum", "Habakuk": "habakkuk", "Zefanya": "zephaniah", "Hagai": "haggai",
      "Zakharia": "zechariah", "Maleakhi": "malachi",
      "Matius": "matthew", "Markus": "mark", "Lukas": "lucas", "Yohanes": "john", "Kisah Para Rasul": "acts",
      "Roma": "romans", "1 Korintus": "1corinthians", "2 Korintus": "2corinthians", "Galatia": "galatians", "Efesus": "ephesians",
      "Filipi": "philippians", "Kolose": "colossians", "1 Tesalonika": "1thessalonians", "2 Tesalonika": "2thessalonians",
      "1 Timotius": "1timothy", "2 Timotius": "2timothy", "Titus": "titus", "Filemon": "philemon", "Ibrani": "hebrews",
      "Yakobus": "james", "1 Petrus": "1peter", "2 Petrus": "2peter", "1 Yohanes": "1john", "2 Yohanes": "2john", 
      "3 Yohanes": "3john", "Yudas": "jude", "Wahyu": "revelation"
    };

    // Mapping for Bible IDs for official alkitab.or.id API
    const BIBLE_IDS: Record<string, string> = {
      "Kejadian": "01", "Keluaran": "02", "Imamat": "03", "Bilangan": "04", "Ulangan": "05",
      "Yosua": "06", "Hakim-hakim": "07", "Rut": "08", "1 Samuel": "09", "2 Samuel": "10",
      "1 Raja-raja": "11", "2 Raja-raja": "12", "1 Tawarikh": "13", "2 Tawarikh": "14",
      "Ezra": "15", "Nehemia": "16", "Ester": "17", "Ayub": "18", "Mazmur": "19", "Amsal": "20",
      "Pengkhotbah": "21", "Kidung Agung": "22", "Yesaya": "23", "Yeremia": "24", "Ratapan": "25",
      "Yehezkiel": "26", "Daniel": "27", "Hosea": "28", "Yoel": "29", "Amos": "30", "Obaja": "31",
      "Yunus": "32", "Mikha": "33", "Nahum": "34", "Habakuk": "35", "Zefanya": "36", "Hagai": "37",
      "Zakharia": "38", "Maleakhi": "39",
      "Matius": "40", "Markus": "41", "Lukas": "42", "Yohanes": "43", "Kisah Para Rasul": "44",
      "Roma": "45", "1 Korintus": "46", "2 Korintus": "47", "Galatia": "48", "Efesus": "49",
      "Filipi": "50", "Kolose": "51", "1 Tesalonika": "52", "2 Tesalonika": "53",
      "1 Timotius": "54", "2 Timotius": "55", "Titus": "56", "Filemon": "57", "Ibrani": "58",
      "Yakobus": "59", "1 Petrus": "60", "2 Petrus": "61", "1 Yohanes": "62", "2 Yohanes": "63", 
      "3 Yohanes": "64", "Yudas": "65", "Wahyu": "66"
    };

    // Mapping for Bible IDs for Bolls.life and others
    const BIBLE_IDS_INT: Record<string, number> = {
      "Kejadian": 1, "Keluaran": 2, "Imamat": 3, "Bilangan": 4, "Ulangan": 5,
      "Yosua": 6, "Hakim-hakim": 7, "Rut": 8, "1 Samuel": 9, "2 Samuel": 10,
      "1 Raja-raja": 11, "2 Raja-raja": 12, "1 Tawarikh": 13, "2 Tawarikh": 14,
      "Ezra": 15, "Nehemia": 16, "Ester": 17, "Ayub": 18, "Mazmur": 19, "Amsal": 20,
      "Pengkhotbah": 21, "Kidung Agung": 22, "Yesaya": 23, "Yeremia": 24, "Ratapan": 25,
      "Yehezkiel": 26, "Daniel": 27, "Hosea": 28, "Yoel": 29, "Amos": 30, "Obaja": 31,
      "Yunus": 32, "Mikha": 33, "Nahum": 34, "Habakuk": 35, "Zefanya": 36, "Hagai": 37,
      "Zakharia": 38, "Maleakhi": 39,
      "Matius": 40, "Markus": 41, "Lukas": 42, "Yohanes": 43, "Kisah Para Rasul": 44,
      "Roma": 45, "1 Korintus": 46, "2 Korintus": 47, "Galatia": 48, "Efesus": 49,
      "Filipi": 50, "Kolose": 51, "1 Tesalonika": 52, "2 Tesalonika": 53,
      "1 Timotius": 54, "2 Timotius": 55, "Titus": 56, "Filemon": 57, "Ibrani": 58,
      "Yakobus": 59, "1 Petrus": 60, "2 Petrus": 61, "1 Yohanes": 62, "2 Yohanes": 63, 
      "3 Yohanes": 64, "Yudas": 65, "Wahyu": 66
    };

    const apiVersion = isBatak ? "tob" : "tb";
    const bookSlug = BIBLE_SLUGS[book] || book.toLowerCase().replace(/\s+/g, '-');
    const bookId = BIBLE_IDS[book] || "01";
    const bookIdInt = BIBLE_IDS_INT[book] || 1;
    
    // Check cache first
    const cacheKey = `${bibleVersion}-${book}-${chapter}-${query}`;
    if (scriptureCache.has(cacheKey)) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(scriptureCache.get(cacheKey));
    }
    
    // If book and chapter are provided, use real Alkitab API for accuracy
    if (book && chapter) {
      try {
        const fetchOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
          }
        };

        // 0. Primary source: HKBP Alkitab CDN (https://hkbp.or.id/alkitab) separating pericope titles from verses
        if (!isGNTD) {
          try {
            const matchedBatakEntry = Object.entries(BIBLE_BOOKS_BATAK_GLOBAL).find(
              ([, v]) => v.toLowerCase() === String(book).trim().toLowerCase()
            );
            const canonicalIndoBook = matchedBatakEntry ? matchedBatakEntry[0] : String(book).trim();
            const hkbpSlug = canonicalIndoBook.replace(/\s+/g, "");
            const hkbpVer = isBatak ? "toba" : "tb";
            const hkbpUrl = `https://cdn.jsdelivr.net/gh/pandapotan/ktb@main/bib/${hkbpVer}/book/${encodeURIComponent(hkbpSlug)}/${chapter}.json`;
            const hkbpRes = await fetch(hkbpUrl, { signal: AbortSignal.timeout(6000) });
            if (hkbpRes.ok) {
              const hkbpJson = await hkbpRes.json() as any;
              const rawEntries = Array.isArray(hkbpJson?.verses) ? hkbpJson.verses : [];
              const verseOnly = rawEntries.filter((entry: any) => String(entry?.type || "content").toLowerCase() !== "title" && entry?.text);
              if (verseOnly.length > 0) {
                const formatted = verseOnly.map((entry: any) => ({
                  title: `${bookTitle} ${chapter}:${entry.verse}`,
                  content: String(entry.text).trim()
                }));
                scriptureCache.set(cacheKey, formatted);
                return res.json(formatted);
              }
            }
          } catch (hkbpErr) {
            console.warn("HKBP Alkitab CDN fetch failed, falling back:", hkbpErr);
          }
        }

        // Scraper fallback for alkitab.me/bbc-toba
        if (isBatak) {
          try {
            const tobaBook = BIBLE_BOOKS_BATAK_GLOBAL[book] || book;
            const alkitabMeUrl = `https://alkitab.me/bbc-toba/${encodeURIComponent(tobaBook)}/${chapter}`;
            console.log(`Scraping Batak verses from: ${alkitabMeUrl}`);
            const resMe = await fetch(alkitabMeUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
            if (resMe.ok) {
              const html = await resMe.text();
              const verseRegex = /<div\s+[^>]*class="vw\s*"[^>]*data-verse="(\d+)"[^>]*>([\s\S]*?)<\/div>/gi;
              let match;
              const scraperVerses = [];
              while ((match = verseRegex.exec(html)) !== null) {
                const verseNum = parseInt(match[1]);
                const blockContent = match[2];
                const pMatch = blockContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
                const text = pMatch ? pMatch[1].replace(/<[^>]*>/g, "").trim() : "";
                if (text) {
                  scraperVerses.push({
                    title: `${bookTitle} ${chapter}:${verseNum}`,
                    content: text
                  });
                }
              }
              if (scraperVerses.length > 0) {
                console.log(`Scraped success from alkitab.me! Verses count: ${scraperVerses.length}`);
                scriptureCache.set(cacheKey, scraperVerses);
                return res.json(scraperVerses);
              }
            }
          } catch (scrapeErr) {
            console.error("Failed to scrape from alkitab.me/bbc-toba:", scrapeErr);
          }
        }

        // 1. If it's TB (Indonesian) or Batak (TOBA/BT), Bolls.life is currently the most stable!
        if (!isGNTD) {
            try {
                // Try different common Batak Toba codes on Bolls.life if isBatak
                const bollsTranslations = isBatak ? ["TOBA", "BT"] : ["TB"];
                for (const bTranslation of bollsTranslations) {
                    const bollsUrl = `https://bolls.life/get-text/${bTranslation}/${bookIdInt}/${chapter}/`;
                    console.log(`Trying Bolls.life: ${bollsUrl}`);
                    const bollsRes = await fetch(bollsUrl, { ...fetchOptions, signal: AbortSignal.timeout(5000) });
                    if (bollsRes.ok) {
                        const data = await bollsRes.json() as any;
                        if (Array.isArray(data) && data.length > 0) {
                            const formatted = data.map((v: any) => ({
                                title: `${bookTitle} ${chapter}:${v.verse}`,
                                content: v.text
                            }));
                            scriptureCache.set(cacheKey, formatted);
                            return res.json(formatted);
                        }
                    }
                }
            } catch (e) {
                console.warn("Bolls.life fetch failed");
            }
        }

        // 2. If it's GNTD, try bible-api.com as it's very reliable for English
        if (isGNTD) {
            try {
                const bookSlugGntd = BIBLE_SLUGS[book] || book;
                const gntdUrl = `https://bible-api.com/${encodeURIComponent(bookSlugGntd)}+${chapter}`;
                const gntdRes = await fetch(gntdUrl);
                if (gntdRes.ok) {
                    const data = await gntdRes.json() as any;
                    const verses = data.verses || [];
                    if (verses.length > 0) {
                        const formatted = verses.map((v: any) => ({
                            title: `${bookTitle} ${chapter}:${v.verse}`,
                            content: v.text
                        }));
                        scriptureCache.set(cacheKey, formatted);
                        return res.json(formatted);
                    }
                }
            } catch (e) {
                console.warn("GNTD fetch failed from bible-api.com");
            }
        }

        // 3. Fallback Patterns
        const patterns = [
          `https://bible-api.alkitab.or.id/bible-api/api/v1/bible/${apiVersion}/${bookId}/${chapter}`,
          `https://bible-api.alkitab.or.id/bible-api/api/v1/bible/${apiVersion}/${bookSlug}/${chapter}`,
        ];

        for (const url of patterns) {
          try {
            console.log(`Trying Pattern: ${url}`);
            const apiResponse = await fetch(url, { 
              ...fetchOptions, 
              headers: { ...fetchOptions.headers, 'Referer': 'https://alkitab.or.id/' },
              signal: AbortSignal.timeout(4000) 
            });
            if (apiResponse.ok) {
              const data = await apiResponse.json() as any;
              const verses = data.data?.verses || data.verses || [];
              
              if (verses && verses.length > 0) {
                const formatted = verses.map((v: any) => ({
                  title: `${bookTitle} ${chapter}:${v.verse || v.number}`,
                  content: v.content || v.text
                }));

                if (isBatak) {
                  const sampleText = formatted[0].content.toLowerCase();
                  // More comprehensive Batak keyword list
                  const containsBatakKeywords = [
                    "debata", "jahowa", "ninna", "hata", "unang", "angka", "tongtong", "ibana", "molo", 
                    "dohot", "jala", "dung", "hu", "hon", "on", "na", "ai", "tu", "ma", "do", "ni", "paralok"
                  ].some(w => sampleText.includes(w));
                  if (containsBatakKeywords) {
                    scriptureCache.set(cacheKey, formatted);
                    return res.json(formatted);
                  }
                } else {
                  scriptureCache.set(cacheKey, formatted);
                  return res.json(formatted);
                }
              }
            }
          } catch (e) {
            // Silently try next pattern
          }
        }
        
        // Backup API: ayatapp.com or others
        const tobaBook = BIBLE_BOOKS_BATAK_GLOBAL[book] || book;
        const backupUrls = [
          `https://alkitab-api.sonnylazuardi.com/passage/${encodeURIComponent(isBatak ? tobaBook : book)}/${chapter}?version=${isBatak ? 'toba' : 'tb'}`,
          `https://api-alkitab.herokuapp.com/passage/${encodeURIComponent(isBatak ? tobaBook : book)}/${chapter}?version=${isBatak ? 'toba' : 'tb'}`,
          `https://alkitab.run/api/${isBatak ? 'toba' : 'tb'}/${encodeURIComponent(book.toLowerCase())}/${chapter}`,
          `https://api.ayat.app/v1/passage/${isBatak ? 'toba' : 'tb'}/${encodeURIComponent(book.toLowerCase())}/${chapter}`
        ];

        for (const url of backupUrls) {
          try {
            console.log(`Trying Backup: ${url}`);
            const backupRes = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(4000) });
            if (backupRes.ok) {
              const data = await backupRes.json() as any;
              const verses = data.verses || data.data?.verses || [];
              if (verses.length > 0) {
                const formatted = verses.map((v: any) => ({
                  title: `${bookTitle} ${chapter}:${v.verse || v.number || v.verse_number}`,
                  content: v.content || v.text
                }));
                scriptureCache.set(cacheKey, formatted);
                return res.json(formatted);
              }
            }
          } catch (e) {
             // Silently try next backup
          }
        }
      } catch (apiError) {
        console.error("Alkitab API Fetch Error:", apiError);
      }
    }

    // Attempt real API Search if no book/chapter provided
    if (query && !book) {
      try {
        const searchUrls = [
            `https://alkitab-api.sonnylazuardi.com/search?q=${encodeURIComponent(query)}&version=${bibleVersion}`,
            `https://alkitab.deno.dev/api/search?q=${encodeURIComponent(query)}&version=${bibleVersion}`
        ];
        for (const url of searchUrls) {
            try {
                const apiResponse = await fetch(url);
                if (apiResponse.ok) {
                  const data = await apiResponse.json() as any;
                  const verses = data.verses || [];
                  if (verses.length > 0) {
                    const formatted = verses.map((v: any) => ({
                      title: `${v.book} ${v.chapter}:${v.verse}`,
                      content: v.content
                    }));
                    scriptureCache.set(cacheKey, formatted);
                    return res.json(formatted);
                  }
                }
            } catch (e) { }
        }
      } catch (e) {
        console.warn("API Search failed, using AI fallback");
      }
    }

    // Otherwise use AI (Gemini)
    let promptText = "";

    if (book && chapter) {
      if (isBatak) {
        promptText = `Bible Batak Toba (Versi Nommensen) ${bookTitle} Pasal ${chapter}. 
        Format: JSON array of objects {title, content}. 
        HANYA teks asli Batak (Debata, Jahowa, molo, na). Dilarang teks Indonesia.`;
      } else {
        promptText = `Alkitab Terjemahan Baru (TB) LAI ${bookTitle} Pasal ${chapter}. 
        Format: JSON array of objects {title, content}.`;
      }
    } else {
      promptText = `Ayat Alkitab ${versionLabel} relevan dengan: "${query}". 
      Format: JSON array of objects {title, content}.`;
      if (isBatak) promptText += " Gunakan Bahasa Batak Toba otentik.";
    }

    promptText += `\nOutput JSON array [ { "title": "...", "content": "..." } ]`;

    try {
      // Retry logic for Gemini with model rotation to handle quota limits
      const getAIResponse = async (prompt: string, retries = 2) => {
        let lastError;
        // List of models to try in order of preference
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-lite-preview"];
        
        for (let i = 0; i <= retries; i++) {
          // Select model based on retry attempt
          const modelName = models[i % models.length];
          try {
            console.log(`AI Attempt ${i+1} using ${modelName}`);
            
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                temperature: 0.1, // Lower temperature for more accuracy
              },
            });
            
            const text = response.text || "[]";
            
            // Clean AI response if it wrapped in markdown
            const jsonStr = text.startsWith("```") ? text.replace(/^```[a-z]*\n/i, "").replace(/```$/, "").trim() : text;
            const parsed = JSON.parse(jsonStr);
            
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            throw new Error("AI returned empty results");
          } catch (e: any) {
            lastError = e;
            console.warn(`AI Attempt ${i+1} (${modelName}) failed: ${e.message}`);
            
            // If it's a quota error, we definitely want to try a different model if possible
            const isQuotaError = e.message?.includes("429") || e.status === 429 || e.code === 429 || JSON.stringify(e).includes("RESOURCE_EXHAUSTED");
            
            if (i < retries) {
              const waitTime = isQuotaError ? 3000 : 1500;
              await new Promise(r => setTimeout(r, waitTime * (i + 1))); 
            }
          }
        }
        throw lastError;
      };

      const scriptures = await getAIResponse(promptText);
      
      if (Array.isArray(scriptures) && scriptures.length > 0) {
        scriptureCache.set(cacheKey, scriptures);
        return res.json(scriptures);
      }
      throw new Error("Invalid AI response after retries");
    } catch (error: any) {
      console.error("Final AI Error:", error);
      const errorMsg = JSON.stringify(error).includes("RESOURCE_EXHAUSTED") || error?.message?.includes("429")
        ? "Batas penggunaan AI (Quota) terlampaui. Mohon tunggu 1-2 menit atau coba lagi nanti."
        : "Gagal memuat Alkitab dari AI. Mohon pastikan koneksi internet stabil dan coba lagi.";
      res.status(error?.status || 500).json({ error: errorMsg });
    }

  });

  io.on("connection", (socket) => {
    let clientAccountId = "acc_default";

    // Handle client joining account-specific socket room
    socket.on("join:account", ({ accountId }: { accountId?: string }) => {
      const targetAccount = accountId || "acc_default";
      socket.leave("room_" + clientAccountId);
      clientAccountId = targetAccount;
      socket.join("room_" + clientAccountId);
      if (activeOperators.has(socket.id)) {
        operatorAccountMap.set(socket.id, clientAccountId);
      }

      const storedSlide = currentSlideMap.get(clientAccountId);
      const shift = currentShiftMap.get(clientAccountId) || {
        active: false,
        name: "",
        endTime: "",
        token: ""
      };
      const storedSettings = currentSettingsMap.get(clientAccountId);
      const isOpActiveNow = isOperatorConsideredActive(clientAccountId);
      const storedOpStatus = operatorStatusMap.get(clientAccountId);
      const opStatus = isOpActiveNow
        ? {
            active: storedOpStatus ? storedOpStatus.active : true,
            isLive: storedOpStatus ? storedOpStatus.isLive : (storedSlide ? storedSlide.isLive !== false : true),
            ts: Date.now(),
          }
        : storedOpStatus || null;

      if (storedSlide) {
        const slideToSend =
          isOpActiveNow && opStatus?.isLive && storedSlide.isLive === false && storedSlide.content !== "System Offline"
            ? { ...storedSlide, isLive: true }
            : storedSlide;
        socket.emit("slide:update", slideToSend);
      } else if (isOpActiveNow) {
        socket.emit("slide:update", {
          content: "Selamat Datang di Ibadah Hari Ini",
          title: "Welcome",
          background: "https://images.unsplash.com/photo-1438232992991-995b7058633e?auto=format&fit=crop&q=80&w=2069",
          type: "lyrics",
          isLive: opStatus ? opStatus.isLive : true
        });
      }
      if (storedSettings) {
        socket.emit("settings:update", storedSettings);
      }
      socket.emit("shift:update", shift);
      if (opStatus) {
        socket.emit("operator:status", opStatus);
      }
    });

    // Default join room_acc_default
    socket.join("room_acc_default");

    // Emit initial count
    io.emit("clients:count", io.engine.clientsCount);

    socket.on("register:operator", (data?: { accountId?: string; isLive?: boolean }) => {
      const accId = data?.accountId || clientAccountId;
      const pendingTimer = operatorDisconnectTimers.get(accId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        operatorDisconnectTimers.delete(accId);
      }
      activeOperators.add(socket.id);
      operatorAccountMap.set(socket.id, accId);
      const statusPayload = {
        active: true,
        isLive: data?.isLive !== false,
        ts: Date.now(),
      };
      operatorStatusMap.set(accId, statusPayload);
      io.to("room_" + accId).emit("operator:status", statusPayload);
    });

    socket.on("operator:status", (data: { accountId?: string; active?: boolean; isLive?: boolean }) => {
      const accId = data?.accountId || clientAccountId;
      const isOpActive = Boolean(data?.active);
      if (isOpActive) {
        const pendingTimer = operatorDisconnectTimers.get(accId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          operatorDisconnectTimers.delete(accId);
        }
        activeOperators.add(socket.id);
        operatorAccountMap.set(socket.id, accId);
      } else {
        activeOperators.delete(socket.id);
        operatorAccountMap.delete(socket.id);
      }
      const statusPayload = {
        active: isOpActive,
        isLive: isOpActive ? data?.isLive !== false : false,
        ts: Date.now(),
      };
      operatorStatusMap.set(accId, statusPayload);
      io.to("room_" + accId).emit("operator:status", statusPayload);
    });

    socket.on("slide:change", (data: any) => {
      const accId = data?.accountId || clientAccountId;
      const slide = data?.slide !== undefined ? data.slide : data;
      const existingSlide = currentSlideMap.get(accId);
      if (!shouldAcceptMonotonicUpdate(existingSlide, slide)) {
        return;
      }
      currentSlideMap.set(accId, slide);
      io.to("room_" + accId).emit("slide:update", slide);
    });

    socket.on("settings:change", (data: any) => {
      const accId = data?.accountId || clientAccountId;
      const settings = data?.settings !== undefined ? data.settings : data;
      const existingSettings = currentSettingsMap.get(accId);
      if (!shouldAcceptMonotonicUpdate(existingSettings, settings)) {
        return;
      }
      currentSettingsMap.set(accId, settings);
      io.to("room_" + accId).emit("settings:update", settings);
    });

    socket.on("shift:change", (data: any) => {
      const accId = data?.accountId || clientAccountId;
      const shift = data?.shift !== undefined ? data.shift : data;
      currentShiftMap.set(accId, shift);
      io.to("room_" + accId).emit("shift:update", shift);
    });

    socket.on("disconnect", () => {
      if (activeOperators.has(socket.id)) {
        const opAcc = operatorAccountMap.get(socket.id) || clientAccountId;
        activeOperators.delete(socket.id);
        operatorAccountMap.delete(socket.id);
        if (!hasActiveOperatorForAccount(opAcc)) {
          const prevTimer = operatorDisconnectTimers.get(opAcc);
          if (prevTimer) clearTimeout(prevTimer);
          const timer = setTimeout(() => {
            operatorDisconnectTimers.delete(opAcc);
            if (!isOperatorConsideredActive(opAcc)) {
              const offlineStatus = { active: false, isLive: false, ts: Date.now() };
              operatorStatusMap.set(opAcc, offlineStatus);
              io.to("room_" + opAcc).emit("operator:status", offlineStatus);
            }
          }, 3000);
          operatorDisconnectTimers.set(opAcc, timer);
        }
      }
      io.emit("clients:count", io.engine.clientsCount);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
