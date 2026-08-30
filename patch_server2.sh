sed -i '712,714c\
          let targetIdx = BIBLE_BOOKS.findIndex(\
            b => b.toLowerCase() === String(book).toLowerCase()\
          );\
          if (targetIdx === -1) {\
            const isBatakName = BIBLE_BOOKS.find(b => {\
              const bBatak = BIBLE_BOOKS_BATAK[b];\
              return bBatak && bBatak.toLowerCase() === String(book).toLowerCase();\
            });\
            if (isBatakName) {\
              targetIdx = BIBLE_BOOKS.findIndex(b => b === isBatakName);\
            }\
          }' server.ts
