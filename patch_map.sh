sed -i '2593,2595c\
    }\
    return list.map(item => {\
      const idx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === item.trim().toLowerCase());\
      if (idx !== -1 && idx < defaultBooks.length) {\
        return defaultBooks[idx];\
      }\
      return item;\
    });\
  };' src/components/Operator/Dashboard.tsx
