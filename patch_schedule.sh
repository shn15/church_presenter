sed -i '2886,2889c\
    const isBatak = bibleVersion === "toba" || bibleVersion.toLowerCase().includes("batak");\
    const bookTitle = isBatak ? BIBLE_BOOKS_BATAK[selectedBibleBook] || selectedBibleBook : selectedBibleBook;' src/components/Operator/Dashboard.tsx
