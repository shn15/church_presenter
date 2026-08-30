sed -i '764,774c\
        if (!matchedBookKey) {\
          let targetIdx = BIBLE_BOOKS.findIndex(\
            b => b.toLowerCase() === String(book).toLowerCase()\
          );\
          if (targetIdx === -1) {\
            const batakKeys = Object.keys(BIBLE_BOOKS_BATAK_GLOBAL);\
            const isBatakName = batakKeys.find(b => {\
              const bBatak = BIBLE_BOOKS_BATAK_GLOBAL[b];\
              return bBatak && bBatak.toLowerCase() === String(book).toLowerCase();\
            });\
            if (isBatakName) {\
              targetIdx = BIBLE_BOOKS.findIndex(b => b === isBatakName);\
            }\
          }\
          if (targetIdx !== -1) {\
            const numericKey = String(targetIdx + 1);\
            if (booksMap[numericKey]) {\
              matchedBookKey = numericKey;\
            }\
          }\
        }' server.ts
