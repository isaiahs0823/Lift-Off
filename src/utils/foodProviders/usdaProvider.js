// ---------------- USDA provider (client side) ----------------
// Talks only to BRK's own /api/food-search proxy — never to USDA directly, never with an API
// key in this bundle. The proxy already normalizes the response, so this file's only job is
// the fetch + failure handling. Kept separate from foodSearchService.js so a second provider
// (a different food database, later) can be added there without this file changing.
export async function searchUsdaFoods(query, { signal } = {}) {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error || "Food database lookup failed.");
    error.status = res.status;
    throw error;
  }
  const json = await res.json();
  return json.foods || [];
}
