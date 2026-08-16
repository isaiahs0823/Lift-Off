// ---------------- FOOD SEARCH SERVICE ----------------
// Orchestration layer between the Add Food screen and the food data sources. The screen never
// touches a provider or USDA-shaped data directly — it calls searchFoods() and gets back a
// single ordered list of already-normalized food objects. Adding a second database provider
// later means adding one more call in here, not touching any UI.
//
// Priority (spec section 4): Recent > Favorites > My Foods > remote database results. Recent/
// Favorites/My Foods are BRK's own local data, so they're instant and always shown first —
// exactly the foods this user actually eats. Within the remote tier we rely on USDA's own
// relevance-scored ordering (branded exact matches and strong matches naturally sort before
// generic entries in FDC's own results) rather than re-implementing text relevance ranking.
import { searchUsdaFoods } from "./foodProviders/usdaProvider.js";

function norm(s) {
  return (s || "").toLowerCase().trim();
}

function matchesQuery(food, q) {
  if (!q) return true;
  const needle = norm(q);
  return norm(food.name).includes(needle) || norm(food.brand).includes(needle);
}

// Distinct foods from the most recently logged entries, most-recent first. Derived on the fly
// from foodLogs rather than persisted separately — one source of truth, and it self-updates
// the moment something new is logged.
export function deriveRecentFoods(state, limit = 8) {
  const foodLogs = state.foodLogs || [];
  const seen = new Set();
  const recent = [];
  for (const f of foodLogs) {
    const key = f.food_id || f.food;
    if (!f.food || seen.has(key)) continue;
    seen.add(key);
    recent.push({
      id: `recent_${f.id}`,
      matchSource: "recent",
      name: f.food,
      brand: f.brand || null,
      servingDesc: f.servingDesc,
      basis: "label",
      servingGrams: f.serving_grams ?? null,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber ?? null,
      source: f.source === "usda" ? "usda" : "recent",
      fdcId: f.fdcId || null,
      relogFrom: f, // the original log entry, in case a caller wants full fidelity
    });
    if (recent.length >= limit) break;
  }
  return recent;
}

function favoritesAsMatches(state) {
  return (state.favoriteFoods || []).map((f) => ({ ...f, matchSource: "favorite" }));
}

function myFoodsAsMatches(state) {
  return (state.savedFoods || []).map((f) => ({ ...f, matchSource: "myFoods", source: f.source || "custom" }));
}

// Local (instant, offline) matches only — recent/favorites/myFoods, deduped so a food that's
// both a favorite and recently logged only shows once, under the higher-priority tier.
export function localFoodMatches(query, state) {
  const tiers = [deriveRecentFoods(state, 8), favoritesAsMatches(state), myFoodsAsMatches(state)];
  const seenKeys = new Set();
  const results = [];
  for (const tier of tiers) {
    for (const food of tier) {
      const key = norm(food.name) + "|" + norm(food.brand);
      if (seenKeys.has(key)) continue;
      if (!matchesQuery(food, query)) continue;
      seenKeys.add(key);
      results.push(food);
    }
  }
  return results;
}

// Full search: local matches (instant) + remote USDA matches (only once the query is long
// enough to be worth a network round trip — the Add Food screen is expected to debounce the
// keystrokes themselves; this is a second, cheap guard against firing on 1-character queries).
export async function searchFoods(query, state, { signal } = {}) {
  const local = localFoodMatches(query, state);
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) {
    return { local, remote: [], remoteError: null };
  }
  try {
    const remote = await searchUsdaFoods(trimmed, { signal });
    // Don't show a remote result that's really just the same food already listed locally.
    const localKeys = new Set(local.map((f) => norm(f.name) + "|" + norm(f.brand)));
    const dedupedRemote = remote.filter((f) => !localKeys.has(norm(f.name) + "|" + norm(f.brand)));
    return { local, remote: dedupedRemote, remoteError: null };
  } catch (e) {
    if (e?.name === "AbortError") throw e; // caller's own debounce superseded this request
    return { local, remote: [], remoteError: e };
  }
}
