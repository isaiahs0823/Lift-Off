import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installCanvasShim, uninstallCanvasShim } from "./canvasShim.js";
import { SHARE_SIZES, pickFeaturedLift, listFeaturableLifts, renderWorkoutShareCard } from "../workoutShareCard.js";

const exMap = {
  bench: { id: "bench", name: "Barbell bench press", type: "compound", muscle: "Chest" },
  squat: { id: "squat", name: "Back squat", type: "compound", muscle: "Legs" },
  long_ex: {
    id: "long_ex",
    name: "Hammer Strength Iso-Lateral Super Incline Chest Press Machine (Left Side Only)",
    type: "compound",
    muscle: "Chest",
  },
  curl: { id: "curl", name: "Dumbbell curl", type: "isolation", muscle: "Arms" },
  shoulder_press: { id: "shoulder_press", name: "Dumbbell shoulder press", type: "compound", muscle: "Shoulders" },
  no_name: { id: "no_name", muscle: "Chest" }, // real but minimal exercise record — no `name` field
};

function entry(exId, sets, extra = {}) {
  return { id: `log_${exId}`, exId, date: "2026-11-08T12:00:00.000Z", sets, targetReps: sets[0]?.reps ?? 8, ...extra };
}

function baseSession(overrides = {}) {
  return {
    id: "session_1",
    planName: "Push Day",
    startedAt: "2026-11-08T12:00:00.000Z",
    finishedAt: "2026-11-08T13:00:00.000Z",
    durationSec: 3600,
    exerciseCount: 2,
    workingSets: 5,
    totalReps: 40,
    totalVolume: 12000,
    prs: [],
    isVolumePR: false,
    mainMuscles: ["Chest"],
    avgRir: 2,
    perfDeltaPct: null,
    bestLift: { exId: "bench", weight: 225, reps: 5 },
    entries: [entry("bench", [{ weight: 225, reps: 5 }, { weight: 205, reps: 8 }]), entry("squat", [{ weight: 315, reps: 5 }])],
    ...overrides,
  };
}

beforeEach(() => installCanvasShim());
afterEach(() => uninstallCanvasShim());

describe("pickFeaturedLift — deterministic PR ranking", () => {
  it("returns null for a session with no entries and no bestLift", () => {
    expect(pickFeaturedLift({ entries: [] }, exMap)).toBeNull();
  });

  it("zero PRs: falls back to the heaviest compound top set", () => {
    const session = baseSession({ prs: [] });
    const featured = pickFeaturedLift(session, exMap);
    expect(featured.isPR).toBe(false);
    expect(featured.exId).toBe("squat"); // 315x5 (e1RM 367.5) beats bench's 225x5 (e1RM 262.5)
  });

  it("one PR: that exercise is always featured regardless of entry order", () => {
    const session = baseSession({
      prs: [{ exId: "squat", type: "weight", weight: 315, reps: 5, prev: 295 }],
    });
    const featured = pickFeaturedLift(session, exMap);
    expect(featured.isPR).toBe(true);
    expect(featured.exId).toBe("squat");
    expect(featured.pr.type).toBe("weight");
  });

  it("multiple PRs: the exercise matching session.bestLift wins over PR-type priority alone", () => {
    const session = baseSession({
      bestLift: { exId: "squat", weight: 315, reps: 5 },
      prs: [
        { exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 },
        { exId: "squat", type: "reps", weight: 315, reps: 5, prev: 3 },
      ],
    });
    const featured = pickFeaturedLift(session, exMap);
    expect(featured.exId).toBe("squat"); // bestLift match wins even though its PR type (reps) is lower priority than bench's (weight)
  });

  it("multiple PRs, no bestLift match: falls back to PR-type priority (weight > reps > e1rm > volume)", () => {
    const session = baseSession({
      bestLift: { exId: "curl", weight: 30, reps: 12 }, // matches neither PR'd exercise
      prs: [
        { exId: "squat", type: "e1rm", value: 400, prev: 390 },
        { exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 },
      ],
    });
    const featured = pickFeaturedLift(session, exMap);
    expect(featured.exId).toBe("bench"); // weight (priority 0) beats e1rm (priority 2)
  });

  it("missing previous-record comparison: PR renders without throwing when pr.prev is absent", () => {
    const session = baseSession({ prs: [{ exId: "bench", type: "weight", weight: 225, reps: 5 }] });
    expect(() => renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" })).not.toThrow();
  });

  it("listFeaturableLifts marks exactly the PR'd exercises and preserves real top sets", () => {
    const session = baseSession({ prs: [{ exId: "squat", type: "weight", weight: 315, reps: 5, prev: 295 }] });
    const list = listFeaturableLifts(session, exMap);
    const squat = list.find((l) => l.exId === "squat");
    const bench = list.find((l) => l.exId === "bench");
    expect(squat.isPR).toBe(true);
    expect(bench.isPR).toBe(false);
    expect(squat.weight).toBe(315);
    expect(bench.weight).toBe(225); // the heavier of its two logged sets (top set, not first set)
  });
});

describe("renderWorkoutShareCard — rendering safety across edge cases", () => {
  const cases = [
    ["zero PRs", baseSession({ prs: [] })],
    ["one PR", baseSession({ prs: [{ exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 }] })],
    [
      "multiple PRs",
      baseSession({
        prs: [
          { exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 },
          { exId: "squat", type: "weight", weight: 315, reps: 5, prev: 295 },
        ],
      }),
    ],
    [
      "long exercise name",
      baseSession({
        bestLift: { exId: "long_ex", weight: 315, reps: 8 },
        entries: [entry("long_ex", [{ weight: 315, reps: 8 }])],
        prs: [{ exId: "long_ex", type: "weight", weight: 315, reps: 8, prev: 295 }],
      }),
    ],
    ["very short workout (one set, no PRs)", baseSession({ workingSets: 1, totalVolume: 225, entries: [entry("bench", [{ weight: 225, reps: 1 }])] })],
    [
      "very long workout (many exercises)",
      baseSession({
        workingSets: 40,
        entries: Array.from({ length: 10 }, (_, i) => entry(["bench", "squat", "curl"][i % 3], [{ weight: 100 + i, reps: 8 }])),
      }),
    ],
    ["no entries at all", baseSession({ entries: [], bestLift: null, workingSets: 0, totalVolume: 0 })],
    ["zero volume / zero duration", baseSession({ totalVolume: 0, durationSec: 0, entries: [] })],
    ["missing mainMuscles (old/pre-field session)", baseSession({ mainMuscles: undefined })],
    ["perfDeltaPct present but no prior logs in state", baseSession({ perfDeltaPct: 12.5 })],
  ];

  for (const [label, session] of cases) {
    it(`${label} — performance template renders at every size without throwing`, () => {
      for (const size of SHARE_SIZES) {
        let dataUrl;
        expect(() => {
          dataUrl = renderWorkoutShareCard({ session, exMap, state: { logs: [] }, template: "performance", sizeId: size.id });
        }).not.toThrow();
        expect(typeof dataUrl).toBe("string");
        expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      }
    });
  }

  it("minimal and social templates also render without throwing", () => {
    const session = baseSession({ prs: [{ exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 }] });
    for (const template of ["minimal", "social"]) {
      expect(() => renderWorkoutShareCard({ session, exMap, state: {}, template, sizeId: "story" })).not.toThrow();
    }
  });
});

describe("renderWorkoutShareCard — export dimensions (task: 1080x1920 and friends)", () => {
  for (const size of SHARE_SIZES) {
    it(`sets canvas.width/height to the real ${size.label} export size (${size.width}x${size.height})`, () => {
      const { contexts } = installCanvasShim();
      const session = baseSession();
      renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: size.id });
      const ctx = contexts[contexts.length - 1];
      expect(ctx.canvas.width).toBe(size.width);
      expect(ctx.canvas.height).toBe(size.height);
    });
  }
});

describe("renderWorkoutShareCard — no clipping / fitted text", () => {
  it("the hero weight×reps text is sized to fit within the hero panel width at Story size", () => {
    const { contexts } = installCanvasShim();
    const session = baseSession({
      bestLift: { exId: "bench", weight: 1245, reps: 12 },
      prs: [{ exId: "bench", type: "weight", weight: 1245, reps: 12, prev: 1200 }],
    });
    renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" });
    const ctx = contexts[contexts.length - 1];
    const heroCall = ctx.__calls.fillText.find((c) => c.text === "1245 × 12");
    expect(heroCall).toBeTruthy();
    const measuredWidth = heroCall.text.length * heroCall.fontSize * 0.58;
    const heroPanelW = 1080 * 0.88;
    expect(measuredWidth).toBeLessThanOrEqual(heroPanelW * 0.84 + 1);
  });

  it("a very long exercise name does not get drawn at an unclamped size", () => {
    const { contexts } = installCanvasShim();
    const session = baseSession({
      bestLift: { exId: "long_ex", weight: 315, reps: 8 },
      entries: [entry("long_ex", [{ weight: 315, reps: 8 }])],
      prs: [{ exId: "long_ex", type: "weight", weight: 315, reps: 8, prev: 295 }],
    });
    renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" });
    const ctx = contexts[contexts.length - 1];
    const nameCall = ctx.__calls.fillText.find((c) => c.text.includes("Hammer Strength"));
    expect(nameCall).toBeTruthy();
    expect(nameCall.fontSize).toBeLessThanOrEqual(34); // the configured max for this field — never overshoots its own cap
  });
});

describe("renderWorkoutShareCard — accurate data, never fabricated", () => {
  it("draws the real PR type label, weight×reps, and previous/delta — never invents them", () => {
    const { contexts } = installCanvasShim();
    const session = baseSession({
      prs: [{ exId: "bench", type: "weight", weight: 225, reps: 5, prev: 220 }],
    });
    renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" });
    const ctx = contexts[contexts.length - 1];
    const texts = ctx.__calls.fillText.map((c) => c.text);
    expect(texts).toContain("225 × 5");
    expect(texts.some((t) => t.includes("Weight PR"))).toBe(true); // PR_TYPE_LABEL's real casing — never invented here
    expect(texts.some((t) => t.includes("Previous: 220"))).toBe(true);
    expect(texts.some((t) => t.includes("+5 lb"))).toBe(true);
    expect(texts.join(" ")).not.toContain("NaN");
    expect(texts.join(" ")).not.toContain("undefined");
  });

  it("draws the real session volume (toLocaleString formatted) and working-set count, never fabricated numbers", () => {
    const { contexts } = installCanvasShim();
    const session = baseSession({ totalVolume: 24395, workingSets: 12, prs: [] });
    renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" });
    const ctx = contexts[contexts.length - 1];
    const texts = ctx.__calls.fillText.map((c) => c.text);
    expect(texts).toContain((24395).toLocaleString());
    expect(texts).toContain("12");
  });

  it("a no-PR session never shows a NEW PR label, and shows BEST SET instead", () => {
    const { contexts } = installCanvasShim();
    const session = baseSession({ prs: [] });
    renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" });
    const ctx = contexts[contexts.length - 1];
    const texts = ctx.__calls.fillText.map((c) => c.text);
    expect(texts).not.toContain("NEW PR");
    expect(texts).toContain("BEST SET");
  });
});

describe("renderWorkoutShareCard — anatomy highlight reflects all actually-trained muscles", () => {
  it("a session spanning multiple real muscle groups (chest + shoulders) renders without throwing on every template", () => {
    const session = baseSession({
      entries: [entry("bench", [{ weight: 225, reps: 5 }]), entry("shoulder_press", [{ weight: 95, reps: 8 }])],
    });
    for (const template of ["performance", "minimal", "social"]) {
      expect(() => renderWorkoutShareCard({ session, exMap, state: {}, template, sizeId: "story" })).not.toThrow();
    }
  });

  it("falls back cleanly when an entry's exercise record has no `name` field", () => {
    const session = baseSession({ entries: [entry("no_name", [{ weight: 135, reps: 10 }])] });
    expect(() => renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" })).not.toThrow();
  });

  it("falls back to the broad mainMuscles category when exMap can't resolve any entry (e.g. a stale/missing catalog id)", () => {
    const session = baseSession({ entries: [entry("unknown_ex_id", [{ weight: 100, reps: 10 }])], mainMuscles: ["Back"] });
    expect(() => renderWorkoutShareCard({ session, exMap, state: {}, template: "performance", sizeId: "story" })).not.toThrow();
  });
});

describe("branding — BRK FIT, not BRK LIFT", () => {
  it("renders the BRK FIT wordmark, never BRK LIFT, on every template", () => {
    for (const template of ["performance", "minimal", "social"]) {
      const { contexts } = installCanvasShim();
      const session = baseSession();
      renderWorkoutShareCard({ session, exMap, state: {}, template, sizeId: "story" });
      const ctx = contexts[contexts.length - 1];
      const texts = ctx.__calls.fillText.map((c) => c.text);
      expect(texts).toContain("FIT");
      expect(texts).not.toContain("LIFT");
      expect(texts.some((t) => t.includes("KEEP THE PROMISES YOU MAKE TO YOURSELF"))).toBe(true);
      uninstallCanvasShim();
    }
  });
});
