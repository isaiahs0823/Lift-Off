// ---------------- USDA FoodData Central search proxy ----------------
// Vercel serverless function (Node runtime). Exists for one reason: a USDA FDC API key must
// never ship in the frontend bundle — anyone could pull it out of the JS and burn the shared
// rate limit. This function holds the key server-side (process.env.USDA_FDC_API_KEY, set in
// the Vercel project's environment variables, never committed) and hands the browser back
// only normalized food data, no key, no raw USDA payload shape to couple the UI to.
import { normalizeUsdaSearchResponse } from "../src/utils/foodProviders/usdaNormalize.js";

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DATA_TYPES = ["Foundation", "SR Legacy", "Branded", "Survey (FNDDS)"];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) {
    res.status(200).json({ foods: [] });
    return;
  }

  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) {
    // Never invent results — an unconfigured key is a real "the food database isn't
    // available right now" state, not a silent empty search.
    res.status(503).json({ error: "Food database is not configured on the server." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(USDA_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        dataType: DATA_TYPES,
        pageSize: 25,
        api_key: apiKey,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      res.status(upstream.status === 429 ? 429 : 502).json({ error: "Food database lookup failed." });
      return;
    }

    const json = await upstream.json();
    const foods = normalizeUsdaSearchResponse(json);
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ foods });
  } catch (e) {
    const isAbort = e?.name === "AbortError";
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? "Food database lookup timed out." : "Food database lookup failed." });
  } finally {
    clearTimeout(timeout);
  }
}
