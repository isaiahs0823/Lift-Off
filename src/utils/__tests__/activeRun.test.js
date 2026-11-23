import { it, expect } from "vitest";
import { sanitizeActiveRun } from "../activeRun.js";

// sanitizeActiveRun defends every field individually against a corrupted/partial/pre-existing
// `liftlog-active-run` value — see its own file comment. `skipped` (added for the Skip Exercise
// feature) follows the exact same pattern as draftByIndex/swaps right next to it.
const base = { id: "r1", exercises: [], startedAt: "2026-11-20T00:00:00.000Z" };

it("defaults skipped to {} for a run saved before this field existed", () => {
  expect(sanitizeActiveRun(base).skipped).toEqual({});
});

it("preserves a valid skipped map", () => {
  const raw = { ...base, skipped: { a: "2026-11-20T00:00:00.000Z" } };
  expect(sanitizeActiveRun(raw).skipped).toEqual({ a: "2026-11-20T00:00:00.000Z" });
});

it.each([null, "corrupt", 42])("discards a malformed skipped value (%j) rather than throwing", (bad) => {
  expect(sanitizeActiveRun({ ...base, skipped: bad }).skipped).toEqual({});
});

it("returns null for a non-object input rather than throwing", () => {
  expect(sanitizeActiveRun(null)).toBeNull();
  expect(sanitizeActiveRun("garbage")).toBeNull();
});
