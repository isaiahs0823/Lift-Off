import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import TodayTab from "../TodayTab.jsx";

// react-test-renderer runs in plain Node, with no requestAnimationFrame — SlideInPanel (used
// directly by the real readinessSheetOpen view, not mocked below) calls it for its slide-in
// animation. jsdom-based tests elsewhere in this app get this for free from the browser-like
// environment; this file doesn't use jsdom, so it needs the same minimal stand-in other
// react-test-renderer tests don't happen to need yet.
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// Regression coverage for the "Today nav tap doesn't close Swap Workout / Readiness Check-in"
// bug: swapOpen and readinessSheetOpen are the two TodayTab-local views that render full-screen
// with NO backdrop (see TodayTab.jsx's early returns), so the bottom nav stays visible and
// tappable over them — but re-tapping the already-active "Today" icon used to be a dead end,
// because setTab("today") in App.jsx is a no-op while tab is already "today" and never reached
// TodayTab's own state. The fix: LiftLog bumps a `todayTapToken` prop on every Today-icon tap;
// TodayTab resets both flags in a `useEffect` keyed on that token. These tests re-render with a
// bumped token, exactly as App.jsx's nav button does on a same-tab re-tap.
//
// SwapWorkoutSheet and ReadinessCheckIn are mocked to minimal stand-ins — this is about whether
// TodayTab opens/closes them in response to the token, not their own internal UI. The mock swap
// sheet's "back" button calls the real onClose prop TodayTab wires up, so it still exercises the
// real "back chevron closes via onClose, applies nothing" wiring.
vi.mock("../SwapWorkoutSheet.jsx", () => ({
  default: ({ onClose }) => (
    <div>
      MOCK SWAP SHEET OPEN
      <button onClick={onClose}>Mock swap back chevron</button>
    </div>
  ),
}));
// TodayTab also renders the REAL ReadinessCheckIn inline, in `compact` mode, as the always-
// visible dashboard tile (see CompactReadinessTile's sibling usage) — only the non-compact usage
// is the dedicated full-screen sheet gated by readinessSheetOpen, so the mock must tell them
// apart or it would falsely report the sheet as "open" on every normal dashboard render too.
vi.mock("../ReadinessCheckIn.jsx", () => ({
  default: ({ compact }) => (compact ? <div>mock compact readiness tile</div> : <div>MOCK READINESS SHEET OPEN</div>),
}));

function text(node) {
  if (node == null || typeof node === "string" || typeof node === "number") return String(node ?? "");
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "object") return text(node.children);
  return "";
}
function findAllButtons(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== "object") return;
    if (n.type === "button") out.push(n);
    for (const child of [].concat(n.children || [])) walk(child);
  })(node);
  return out;
}
function clickByText(root, label) {
  const btn = findAllButtons(root.toJSON()).find((b) => text(b.children).includes(label));
  expect(btn, `button containing "${label}" should exist`).toBeTruthy();
  act(() => btn.props.onClick());
}
function bodyHas(root, needle) {
  return text(root.toJSON()).includes(needle);
}

const programA = {
  id: "program_A",
  name: "Program A",
  days: [{ label: "A Day 1", exercises: [{ exId: "bench", sets: 4, reps: 6 }] }],
};
const exMap = { bench: { id: "bench", name: "Bench press", muscle: "Chest", type: "compound" } };

function makeState(extra = {}) {
  return {
    currentProgram: { programId: "program_A", programName: "Program A", source: "custom", dayIndex: 0, totalDays: 1, startDate: new Date().toISOString() },
    customPrograms: [programA],
    programs: [],
    workoutSessions: [],
    recoverySessions: [],
    readinessLogs: [],
    bodyweightLogs: [],
    goals: [],
    hasSeenOnboarding: true,
    ...extra,
  };
}

function baseProps(overrides = {}) {
  return {
    state: makeState(),
    updateState: vi.fn(),
    exMap,
    allExercises: [],
    activeRun: null,
    onResumeWorkout: vi.fn(),
    onStartRun: vi.fn(),
    onStartRecovery: vi.fn(),
    onNavigate: vi.fn(),
    onViewWorkout: vi.fn(),
    onOpenNutrition: vi.fn(),
    onOpenAthleteRating: vi.fn(),
    activationNotice: null,
    onDismissActivationNotice: vi.fn(),
    accountSyncNotice: null,
    onDismissAccountSyncNotice: vi.fn(),
    authCallbackError: null,
    onDismissAuthCallbackError: vi.fn(),
    onGoToAccount: vi.fn(),
    programEndedNotice: null,
    onDismissProgramEndedNotice: vi.fn(),
    onChooseProgram: vi.fn(),
    todayTapToken: 0,
    ...overrides,
  };
}

describe("TodayTab — re-tapping Today closes Swap Workout / Readiness Check-in (nav trap fix)", () => {
  it("Swap Workout: a bumped todayTapToken closes it and returns to the dashboard, without ever calling updateState", () => {
    const props = baseProps();
    let root;
    act(() => {
      root = TestRenderer.create(<TodayTab {...props} />);
    });
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(false);
    // TodayTab's own unrelated mount-time effects (coach-memory sync, rolling-schedule sync) can
    // legitimately call updateState once on mount — that's not what this test is about. Compare
    // the count before/after the open+reset sequence instead of asserting zero calls overall.
    const callsAfterMount = props.updateState.mock.calls.length;

    clickByText(root, "Swap workout");
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(true);

    // Same tab, bumped token — exactly what App.jsx's bottom nav does on a same-tab re-tap of Today.
    act(() => {
      root.update(<TodayTab {...props} todayTapToken={1} />);
    });
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(false);
    expect(bodyHas(root, "Swap workout")).toBe(true); // back on the normal Today dashboard

    // Re-tapping Today must never apply a swap: no NEW updateState call from this sequence.
    expect(props.updateState.mock.calls.length).toBe(callsAfterMount);
  });

  it("Swap Workout: the sheet's own back chevron closes it the same way (onClose), applying nothing", () => {
    const props = baseProps();
    let root;
    act(() => {
      root = TestRenderer.create(<TodayTab {...props} />);
    });
    const callsAfterMount = props.updateState.mock.calls.length;
    clickByText(root, "Swap workout");
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(true);

    clickByText(root, "Mock swap back chevron");
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(false);
    expect(props.updateState.mock.calls.length).toBe(callsAfterMount);
  });

  it("Readiness Check-in: a bumped todayTapToken closes it and returns to the dashboard, without ever calling updateState", () => {
    const props = baseProps();
    let root;
    act(() => {
      root = TestRenderer.create(<TodayTab {...props} />);
    });
    expect(bodyHas(root, "MOCK READINESS SHEET OPEN")).toBe(false);
    const callsAfterMount = props.updateState.mock.calls.length;

    clickByText(root, "Check in");
    expect(bodyHas(root, "MOCK READINESS SHEET OPEN")).toBe(true);

    act(() => {
      root.update(<TodayTab {...props} todayTapToken={1} />);
    });
    expect(bodyHas(root, "MOCK READINESS SHEET OPEN")).toBe(false);

    // Re-tapping Today must never submit a check-in: no NEW updateState call from this sequence.
    expect(props.updateState.mock.calls.length).toBe(callsAfterMount);
  });

  it("switching to another tab (unmount) always starts the next Today mount with both closed", () => {
    // In the real app, tab !== "today" unmounts TodayTab entirely (see LiftLog's {tab === "today"
    // && <TodayTab .../>}), which is how every OTHER nav tab already escapes these screens fine —
    // only the same-tab "Today" re-tap needed the token fix. A fresh mount after that always
    // starts clean (useState(false) initial values), same as before this fix existed.
    const props = baseProps();
    let root;
    act(() => {
      root = TestRenderer.create(<TodayTab {...props} />);
    });
    clickByText(root, "Swap workout");
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(true);

    act(() => root.unmount());
    act(() => {
      root = TestRenderer.create(<TodayTab {...baseProps()} />);
    });
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(false);
  });

  it("an unrelated todayTapToken bump (e.g. a normal mount at token 0) does not itself open either sheet", () => {
    const props = baseProps({ todayTapToken: 5 });
    let root;
    act(() => {
      root = TestRenderer.create(<TodayTab {...props} />);
    });
    expect(bodyHas(root, "MOCK SWAP SHEET OPEN")).toBe(false);
    expect(bodyHas(root, "MOCK READINESS SHEET OPEN")).toBe(false);
  });
});
