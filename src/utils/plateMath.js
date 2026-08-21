// ---------------- PLATE MATH ----------------
// Pure math for both plate-calculator directions: the original "target weight -> which plates"
// (platesPerSide, unchanged from its original App.jsx home — still used as-is) and the new
// tap-to-build direction, "which plates are loaded -> total weight" (totalFromStack and
// friends), which is how the rebuilt calculator actually works: the athlete builds the bar by
// tapping plates, and the total is derived from what's loaded, not typed in.
//
// A "stack" is a plain object mapping plate size -> number of PAIRS loaded (one pair = one
// plate on each side). { 45: 2, 25: 1 } means two 45s and one 25 per side.
export const PLATE_SIZES = [45, 35, 25, 10, 5, 2.5];
export const BAR_WEIGHT_OPTIONS = [45, 35, 25, 15];

export function platesPerSide(targetWeight, barWeight) {
  let remaining = (targetWeight - barWeight) / 2;
  if (remaining <= 0) return { plates: [], remainder: 0 };
  const plates = [];
  for (const size of PLATE_SIZES) {
    while (remaining >= size - 0.001) {
      plates.push(size);
      remaining -= size;
    }
  }
  return { plates, remainder: Math.round(remaining * 100) / 100 };
}

export function emptyStack() {
  return {};
}

export function addPlatePair(stack, size) {
  return { ...stack, [size]: (stack[size] || 0) + 1 };
}

// Removes one pair at a time (never goes negative, drops the key entirely once it hits zero so
// stackToList doesn't render a lingering "x 0" row).
export function removePlatePair(stack, size) {
  const next = (stack[size] || 0) - 1;
  const copy = { ...stack };
  if (next <= 0) delete copy[size];
  else copy[size] = next;
  return copy;
}

export function totalFromStack(barWeight, stack) {
  const perSide = Object.entries(stack).reduce((sum, [size, pairs]) => sum + Number(size) * pairs, 0);
  return barWeight + perSide * 2;
}

// Sorted (largest first, matching PLATE_SIZES order) list of only the denominations actually
// loaded — what the "Per side" stack display renders.
export function stackToList(stack) {
  return PLATE_SIZES.filter((size) => (stack[size] || 0) > 0).map((size) => ({ size, pairs: stack[size] }));
}
