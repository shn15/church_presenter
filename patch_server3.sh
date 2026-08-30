sed -i '727,749c\
    } catch (e: any) {\
      return res.status(500).json({ error: e.message });\
    }\
  });' server.ts
