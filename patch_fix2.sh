sed -i '3241,3257c\
          if (matchedKey) {\
            bookChapterObj = customMatch.books[matchedKey];\
          } else {\
            let targetIdx = BIBLE_BOOKS.findIndex(\
              (b) => b.toLowerCase() === book.toLowerCase(),\
            );\
            if (targetIdx === -1) {\
              const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);\
              const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === book.toLowerCase());\
              if (matchBatak) targetIdx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());\
            }\
            if (targetIdx !== -1) {\
              const numericKey = String(targetIdx + 1);\
              if (customMatch.books[numericKey]) {\
                bookChapterObj = customMatch.books[numericKey];\
              }\
            }\
          }' src/components/Operator/Dashboard.tsx
