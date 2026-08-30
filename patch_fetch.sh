sed -i '3083,3088c\
          } else {\
            let targetIdx = BIBLE_BOOKS.findIndex(\
              (b) => b.toLowerCase() === book.toLowerCase(),\
            );\
            if (targetIdx === -1) {\
              const batakEntries = Object.entries(BIBLE_BOOKS_BATAK);\
              const matchBatak = batakEntries.find(([tb, batak]) => batak.toLowerCase() === book.toLowerCase());\
              if (matchBatak) targetIdx = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === matchBatak[0].toLowerCase());\
            }' src/components/Operator/Dashboard.tsx
