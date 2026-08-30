sed -i '2579,2624c\
  const mapBookNamesList = (list: string[], isBatak: boolean) => {\
    const defaultBooks = isBatak \
      ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) \
      : BIBLE_BOOKS;\
    if (!list || list.length === 0) return defaultBooks;\
    const isNumericList = list.every((item) => /^\\d+$/.test(item.trim()));\
    if (isNumericList) {\
      return list.map((item) => {\
        const idx = parseInt(item.trim()) - 1;\
        if (idx >= 0 && idx < defaultBooks.length) {\
          return defaultBooks[idx];\
        }\
        return item;\
      });\
    }\
    return list;\
  };\
\
  const getAvailableBooks = () => {\
    const isBatak = bibleVersion === "toba" || bibleVersion.toLowerCase().includes("batak");\
    const matched = customBibles.find((cb) => cb.id === bibleVersion);\
    if (matched) {\
      if (matched.bookNames && matched.bookNames.length > 0) {\
        return mapBookNamesList(matched.bookNames, isBatak);\
      }\
      if (matched.books) {\
        const keys = Object.keys(matched.books);\
        if (keys.length > 0) {\
          return mapBookNamesList(keys, isBatak);\
        }\
      }\
    }\
    return isBatak ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) : BIBLE_BOOKS;\
  };\
\
  const getEditorAvailableBooks = () => {\
    const isBatak = editorScripVersion === "toba" || editorScripVersion.toLowerCase().includes("batak");\
    const matched = customBibles.find((cb) => cb.id === editorScripVersion);\
    if (matched) {\
      if (matched.bookNames && matched.bookNames.length > 0) {\
        return mapBookNamesList(matched.bookNames, isBatak);\
      }\
      if (matched.books) {\
        const keys = Object.keys(matched.books);\
        if (keys.length > 0) {\
          return mapBookNamesList(keys, isBatak);\
        }\
      }\
    }\
    return isBatak ? BIBLE_BOOKS.map(book => BIBLE_BOOKS_BATAK[book] || book) : BIBLE_BOOKS;\
  };\
' src/components/Operator/Dashboard.tsx
