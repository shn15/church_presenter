const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Define global BIBLE_BOOKS_BATAK
code = code.replace(
  'const app = express();',
  `const BIBLE_BOOKS_BATAK_GLOBAL: Record<string, string> = {
  "Kejadian": "1 Musa", "Keluaran": "2 Musa", "Imamat": "3 Musa", "Bilangan": "4 Musa", "Ulangan": "5 Musa",
  "Yosua": "Josua", "Hakim-hakim": "Panguhum", "Rut": "Rut", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",
  "1 Raja-raja": "1 Raja-raja", "2 Raja-raja": "2 Raja-raja", "1 Tawarikh": "1 Kronika", "2 Tawarikh": "2 Kronika",
  "Ezra": "Esra", "Nehemia": "Nehemia", "Ester": "Ester", "Ayub": "Job", "Mazmur": "Psalmen", "Amsal": "Poda",
  "Pengkhotbah": "Parjamita", "Kidung Agung": "Logulogu", "Yesaya": "Jesaya", "Yeremia": "Jeremia",
  "Ratapan": "Andungabung", "Yehezkiel": "Hesekiel", "Daniel": "Daniel", "Hosea": "Hosea", "Yoel": "Joel",
  "Amos": "Amos", "Obaja": "Obaja", "Yunus": "Jona", "Mikha": "Mika", "Nahum": "Nahum", "Habakuk": "Habakuk",
  "Zefanya": "Sepania", "Hagai": "Hagai", "Zakharia": "Sakaria", "Maleakhi": "Maleaki",
  "Matius": "Mateus", "Markus": "Markus", "Lukas": "Lukas", "Yohanes": "Johannes", "Kisah Para Rasul": "Ulaon ni Apostel",
  "Roma": "Roma", "1 Korintus": "1 Korintus", "2 Korintus": "2 Korintus", "Galatia": "Galatia", "Efesus": "Efesus",
  "Filipi": "Pilippi", "Kolose": "Kolosse", "1 Tesalonika": "1 Tesalonika", "2 Tesalonika": "2 Tesalonika",
  "1 Timotius": "1 Timotius", "2 Timotius": "2 Timotius", "Titus": "Titus", "Filemon": "Pilemon", "Ibrani": "Heber",
  "Yakobus": "Jakobus", "1 Petrus": "1 Petrus", "2 Petrus": "2 Petrus", "1 Yohanes": "1 Johannes",
  "2 Yohanes": "2 Johannes", "3 Yohanes": "3 Johannes", "Yudas": "Judas", "Wahyu": "Pangungkapon"
};
const app = express();`
);

// 2. Add local-bibles
code = code.replace(
  '  // Get custom backgrounds from public/backgrounds folder',
  `  // Get local custom bibles from public/bibles folder
  app.get("/api/local-bibles", (req, res) => {
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
              id: file.replace(".json", ""),
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

  // Get custom backgrounds from public/backgrounds folder`
);

// 3. Try to find local bibles in chapter API
code = code.replace(
  '      // 2. Fallback to monolithic custom_bibles.json',
  `      // 1.5 Try to find it in public/bibles
      const localPath = path.join(process.cwd(), "public", "bibles", \`\${bibleId}.json\`);
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
          console.error(\`Error reading local Bible file \${bibleId}:\`, err);
        }
      }

      // 2. Fallback to monolithic custom_bibles.json`
);

// 4. Update retrieveChapterVerses to support batak targetIdx
code = code.replace(
  `        if (!matchedBookKey) {
          const targetIdx = BIBLE_BOOKS.findIndex(
            b => b.toLowerCase() === String(book).toLowerCase()
          );
          if (targetIdx !== -1) {
            const numericKey = String(targetIdx + 1);
            if (booksMap[numericKey]) {
              matchedBookKey = numericKey;
            }
          }
        }`,
  `        if (!matchedBookKey) {
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
        }`
);

// 5. Replace other references
code = code.replace(/const BIBLE_BOOKS_BATAK: Record<string, string> = {[\s\S]*?};\n/g, 'const BIBLE_BOOKS_BATAK: Record<string, string> = BIBLE_BOOKS_BATAK_GLOBAL;\n');
code = code.replace(/BIBLE_BOOKS_BATAK\[/g, 'BIBLE_BOOKS_BATAK_GLOBAL[');

fs.writeFileSync('server.ts', code, 'utf8');
