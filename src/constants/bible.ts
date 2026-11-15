export const BIBLE_BOOKS = [
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

export const BIBLE_BOOKS_BATAK: Record<string, string> = {
  "Kejadian": "1 Musa",
  "Keluaran": "2 Musa",
  "Imamat": "3 Musa",
  "Bilangan": "4 Musa",
  "Ulangan": "5 Musa",
  "Yosua": "Josua",
  "Hakim-hakim": "Panguhum",
  "Rut": "Rut",
  "1 Samuel": "1 Samuel",
  "2 Samuel": "2 Samuel",
  "1 Raja-raja": "1 Raja-raja",
  "2 Raja-raja": "2 Raja-raja",
  "1 Tawarikh": "1 Kronika",
  "2 Tawarikh": "2 Kronika",
  "Ezra": "Esra",
  "Nehemia": "Nehemia",
  "Ester": "Ester",
  "Ayub": "Job",
  "Mazmur": "Psalmen",
  "Amsal": "Poda",
  "Pengkhotbah": "Parjamita",
  "Kidung Agung": "Angka Ende",
  "Yesaya": "Jesaya",
  "Yeremia": "Jeremia",
  "Ratapan": "Andung-andung",
  "Yehezkiel": "Hesekiel",
  "Daniel": "Daniel",
  "Hosea": "Hosea",
  "Yoel": "Joel",
  "Amos": "Amos",
  "Obaja": "Obaja",
  "Yunus": "Jona",
  "Mikha": "Mika",
  "Nahum": "Nahum",
  "Habakuk": "Habakuk",
  "Zefanya": "Sepania",
  "Hagai": "Haggai",
  "Zakharia": "Sakaria",
  "Maleakhi": "Maleaki",
  "Matius": "Mateus",
  "Markus": "Markus",
  "Lukas": "Lukas",
  "Yohanes": "Johannes",
  "Kisah Para Rasul": "Ulaon ni Apostel",
  "Roma": "Rom",
  "1 Korintus": "1 Korint",
  "2 Korintus": "2 Korint",
  "Galatia": "Galatia",
  "Efesus": "Epesus",
  "Filipi": "Pilippi",
  "Kolose": "Kolosse",
  "1 Tesalonika": "1 Tessalonik",
  "2 Tesalonika": "2 Tessalonik",
  "1 Timotius": "1 Timoteus",
  "2 Timotius": "2 Timoteus",
  "Titus": "Titus",
  "Filemon": "Pilemon",
  "Ibrani": "Heber",
  "Yakobus": "Jakobus",
  "1 Petrus": "1 Petrus",
  "2 Petrus": "2 Petrus",
  "1 Yohanes": "1 Johannes",
  "2 Yohanes": "2 Johannes",
  "3 Yohanes": "3 Johannes",
  "Yudas": "Judas",
  "Wahyu": "Pangungkapon"
};

export const BIBLE_BOOK_ALIASES: Record<string, string> = {
  "logulogu": "Kidung Agung",
  "angka ende": "Kidung Agung",
  "andungabung": "Ratapan",
  "andung-andung": "Ratapan",
  "hagai": "Hagai",
  "haggai": "Hagai",
  "roma": "Roma",
  "rom": "Roma",
  "1 korintus": "1 Korintus",
  "1 korint": "1 Korintus",
  "2 korintus": "2 Korintus",
  "2 korint": "2 Korintus",
  "efesus": "Efesus",
  "epesus": "Efesus",
  "1 tesalonika": "1 Tesalonika",
  "1 tessalonik": "1 Tesalonika",
  "2 tesalonika": "2 Tesalonika",
  "2 tessalonik": "2 Tesalonika",
  "1 timotius": "1 Timotius",
  "1 timoteus": "1 Timotius",
  "2 timotius": "2 Timotius",
  "2 timoteus": "2 Timotius",
};

export function resolveCanonicalIndoBook(bookName: string): string {
  const clean = (bookName || "").trim();
  if (!clean) return "Kejadian";
  const lower = clean.toLowerCase();

  const directIndo = BIBLE_BOOKS.find((b) => b.toLowerCase() === lower);
  if (directIndo) return directIndo;

  const matchedBatak = Object.entries(BIBLE_BOOKS_BATAK).find(
    ([, batak]) => batak.toLowerCase() === lower,
  );
  if (matchedBatak) return matchedBatak[0];

  if (BIBLE_BOOK_ALIASES[lower]) return BIBLE_BOOK_ALIASES[lower];
  return clean;
}
