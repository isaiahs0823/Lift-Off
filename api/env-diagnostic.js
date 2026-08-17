// ---------------- TEMPORARY DIAGNOSTIC ENDPOINT ----------------
// Exists only to answer one question: why can't Vercel production serverless
// functions see OPENAI_API_KEY / USDA_FDC_API_KEY even though both are set in
// Project Settings? Never returns or logs any environment variable VALUE —
// only presence/length booleans and variable NAMES (as JSON.stringify, so
// stray whitespace in a name is visible). Safe to leave attached to a public
// URL, but should be removed once the root cause is found.
const MATCH_SUBSTRINGS = ["OPENAI", "USDA", "FDC", "COACH"];

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const relevantKeys = Object.keys(process.env)
    .filter((key) => MATCH_SUBSTRINGS.some((s) => key.includes(s)))
    .map((key) => {
      const value = process.env[key];
      const hasValue = typeof value === "string" && value.length > 0;
      return {
        key: JSON.stringify(key),
        hasValue,
        valueLength: typeof value === "string" ? value.length : 0,
      };
    });

  res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelTargetEnv: process.env.VERCEL_TARGET_ENV ?? null,
    expected: {
      OPENAI_API_KEY: typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.length > 0,
      USDA_FDC_API_KEY: typeof process.env.USDA_FDC_API_KEY === "string" && process.env.USDA_FDC_API_KEY.length > 0,
      COACH_MODEL: typeof process.env.COACH_MODEL === "string" && process.env.COACH_MODEL.length > 0,
    },
    relevantKeys,
  });
}
