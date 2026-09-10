// ---------------- NUTRITION FEATURE FLAGS (v1 scope cut) ----------------
// For the first App-Store-ready release, BRK's food database (search + USDA lookup, barcode
// scanning, nutrition-label OCR) and the detailed per-food logging built on top of it aren't
// reliable enough to ship. Nutrition PLANNING — the assessment, calorie/macro targets, meal
// structure, the curated recommended meal plan, and food-category guidance — is unaffected: none
// of it depends on the food database, so it stays fully live.
//
// This flag gates ONLY the food-lookup/logging UI surface (FoodLogScreen, AddFoodScreen,
// FoodDetailScreen, BarcodeScannerScreen, NutritionLabelScannerScreen, ScanFoodChooser, and every
// "Log Food"/"Scan Food"/"Add Food" entry point that leads to them). Nothing behind it was
// deleted — every route, component, and util still exists and is fully wired. To bring the
// feature back once the database is reliable, flip this back to true; every gated entry point
// and route render (see App.jsx's NUTRITION_FOOD_LOGGING_ENABLED checks, NutritionHome.jsx,
// NutritionCard.jsx) picks it back up automatically.
//
// Existing food logs, saved/favorite foods, and barcode history are never touched by this flag —
// it only controls whether the UI to create MORE of them is shown.
export const NUTRITION_FOOD_LOGGING_ENABLED = false;
