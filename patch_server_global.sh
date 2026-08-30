sed -i '12i\
const BIBLE_BOOKS_BATAK_GLOBAL: Record<string, string> = {\
  "Kejadian": "1 Musa", "Keluaran": "2 Musa", "Imamat": "3 Musa", "Bilangan": "4 Musa", "Ulangan": "5 Musa",\
  "Yosua": "Josua", "Hakim-hakim": "Panguhum", "Rut": "Rut", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",\
  "1 Raja-raja": "1 Raja-raja", "2 Raja-raja": "2 Raja-raja", "1 Tawarikh": "1 Kronika", "2 Tawarikh": "2 Kronika",\
  "Ezra": "Esra", "Nehemia": "Nehemia", "Ester": "Ester", "Ayub": "Job", "Mazmur": "Psalmen", "Amsal": "Poda",\
  "Pengkhotbah": "Parjamita", "Kidung Agung": "Logulogu", "Yesaya": "Jesaya", "Yeremia": "Jeremia",\
  "Ratapan": "Andungabung", "Yehezkiel": "Hesekiel", "Daniel": "Daniel", "Hosea": "Hosea", "Yoel": "Joel",\
  "Amos": "Amos", "Obaja": "Obaja", "Yunus": "Jona", "Mikha": "Mika", "Nahum": "Nahum", "Habakuk": "Habakuk",\
  "Zefanya": "Sepania", "Hagai": "Hagai", "Zakharia": "Sakaria", "Maleakhi": "Maleaki",\
  "Matius": "Mateus", "Markus": "Markus", "Lukas": "Lukas", "Yohanes": "Johannes", "Kisah Para Rasul": "Ulaon ni Apostel",\
  "Roma": "Roma", "1 Korintus": "1 Korintus", "2 Korintus": "2 Korintus", "Galatia": "Galatia", "Efesus": "Efesus",\
  "Filipi": "Pilippi", "Kolose": "Kolosse", "1 Tesalonika": "1 Tesalonika", "2 Tesalonika": "2 Tesalonika",\
  "1 Timotius": "1 Timotius", "2 Timotius": "2 Timotius", "Titus": "Titus", "Filemon": "Pilemon", "Ibrani": "Heber",\
  "Yakobus": "Jakobus", "1 Petrus": "1 Petrus", "2 Petrus": "2 Petrus", "1 Yohanes": "1 Johannes",\
  "2 Yohanes": "2 Johannes", "3 Yohanes": "3 Johannes", "Yudas": "Judas", "Wahyu": "Pangungkapon"\
};' server.ts
