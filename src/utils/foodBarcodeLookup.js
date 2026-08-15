// ---------------- BARCODE → FOOD LOOKUP ----------------
// Open Food Facts (world.openfoodfacts.org) is a free, open, CORS-enabled product database —
// no API key, no backend of ours required. Real product data for a huge range of UPC/EAN
// barcodes. This is the "configured food provider" for barcode lookups until BRK has its own
// backend food database (section 15 of the original nutrition spec explicitly deferred that).

const LOOKUP_URL = (barcode) => `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v != null && v !== "") return v;
  }
  return null;
}

// Open Food Facts nutriment fields are inconsistent per-product — some report true per-serving
// values, many only report per-100g. Prefers `_serving` fields when present (already scaled to
// the product's own labeled serving); falls back to `_100g` fields labeled as "per 100g" rather
// than silently mislabeling them as the serving amount.
function extractNutrition(product) {
  const n = product.nutriments || {};
  const hasServing = n["energy-kcal_serving"] != null || n["proteins_serving"] != null;
  const basis = hasServing ? "serving" : "100g";
  const suffix = hasServing ? "_serving" : "_100g";
  return {
    basis, // "serving" | "100g" — caller must show this so the athlete knows what the numbers mean
    calories: n[`energy-kcal${suffix}`] != null ? Math.round(n[`energy-kcal${suffix}`]) : null,
    protein: n[`proteins${suffix}`] != null ? Math.round(n[`proteins${suffix}`]) : null,
    carbs: n[`carbohydrates${suffix}`] != null ? Math.round(n[`carbohydrates${suffix}`]) : null,
    fat: n[`fat${suffix}`] != null ? Math.round(n[`fat${suffix}`]) : null,
    fiber: n[`fiber${suffix}`] != null ? Math.round(n[`fiber${suffix}`]) : null,
  };
}

// Returns { found: false, barcode } when the barcode was read but no product exists in the
// database, { found: true, ... } with real product fields otherwise. Throws only on an actual
// network/HTTP failure — a legitimate "not found" is a normal result, not an error.
export async function lookupBarcode(barcode) {
  const res = await fetch(LOOKUP_URL(barcode), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    return { found: false, barcode };
  }
  const product = data.product;
  const nutrition = extractNutrition(product);
  return {
    found: true,
    barcode,
    name: firstNonEmpty(product.product_name, product.product_name_en, product.generic_name) || "Unknown product",
    brand: firstNonEmpty(product.brands) || "",
    servingDesc: firstNonEmpty(product.serving_size) || (nutrition.basis === "100g" ? "100g" : ""),
    ...nutrition,
  };
}
