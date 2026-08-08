// api/openrouter-proxy.js  (Vercel Serverless function - Node)
const fetch = globalThis.fetch || require("node-fetch");

module.exports = async (req, res) => {
  // اقرأ Origins المسموحة من env (comma-separated) أو استخدم "*" للسماح كله
  const allowed = (process.env.SUPABASE_FUNCTIONS_ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || "";

  const allowAll = allowed.includes("*");
  const originAllowed = allowAll || allowed.includes(origin);

  if (!originAllowed) {
    res.status(403).setHeader("Content-Type", "text/plain").end("Forbidden");
    return;
  }

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_API_BASE =
    process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1/chat/completions";

  if (!OPENROUTER_API_KEY) {
    res
      .status(500)
      .json({ ok: false, error: "Server misconfiguration: OPENROUTER_API_KEY not set." });
    return;
  }

  try {
    const forward = await fetch(OPENROUTER_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(req.body || {}),
    });

    const text = await forward.text();
    const contentType = forward.headers.get("content-type") || "application/json";
    res.status(forward.status).setHeader("Content-Type", contentType).send(text);
  } catch (err) {
    console.error("openrouter proxy error:", err);
    res.status(502).json({ ok: false, error: "Bad gateway contacting OpenRouter." });
  }
};
