sed -i '2593,2601c\
    }\
    return list.map(item => {\
      let idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === item.trim().toLowerCase());\
      if (idx === -1) {\
        const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);\
        const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === item.trim().toLowerCase());\
        if (matchBatak) {\
          idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());\
        }\
      }\
      if (idx !== -1 && idx < defaultBooks.length) {\
        return defaultBooks[idx];\
      }\
      return item;\
    });\
  };' src/components/Operator/Dashboard.tsx
