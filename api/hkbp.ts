const HKBP_API_BASE = "https://api.hkbp.or.id/api/v1";

const ALLOWED_ENDPOINT_PATTERN =
  /^(buku-ende|buku-nyanyian)\/songs(\/[a-zA-Z0-9_-]+)?$/;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawEndpoint = Array.isArray(req.query?.endpoint)
    ? req.query.endpoint[0]
    : req.query?.endpoint;

  const endpoint = String(rawEndpoint || "").replace(/^\/+/, "").trim();
  if (!ALLOWED_ENDPOINT_PATTERN.test(endpoint)) {
    res.status(400).json({ error: "Invalid HKBP endpoint" });
    return;
  }

  try {
    const targetUrl = `${HKBP_API_BASE}/${endpoint}`;
    const upstream = await fetch(targetUrl, {
      headers: {
        Origin: "https://hkbp.or.id",
        Referer: "https://hkbp.or.id/",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ChurchPresenter/1.0)",
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `HKBP upstream HTTP ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Failed to fetch from HKBP API" });
  }
}
