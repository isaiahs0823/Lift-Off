// Optional integration checks against a locally built preview. Install Playwright outside
// the checkout, then set BRK_PLAYWRIGHT_MODULE to its index.mjs if it is not locally installed.
// Run: node --test scripts/workoutIntegrity.browser.mjs
// No external requests or existing browser profiles are used.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { chromium } = await import(process.env.BRK_PLAYWRIGHT_MODULE || "playwright");
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.BRK_CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => browser?.close());

const origin = process.env.BRK_PREVIEW_ORIGIN || "http://127.0.0.1:4173";
const program = {
  id: "integrity-program", name: "Integrity fixture", isCustom: true,
  days: [
    { id: "day-a", label: "Day A", exercises: [{ exId: "bench", sets: 3, reps: "8" }, { exId: "squat", sets: 3, reps: "8" }] },
    { id: "day-b", label: "Day B", exercises: [{ exId: "bench", sets: 3, reps: "8" }] },
  ],
};

async function fixture(t, recovery = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(() => context.close());
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(({ program, recovery }) => {
    if (localStorage.getItem("liftlog-data")) return;
    if (recovery) program.days[0] = { id: "recovery", label: "Recovery", type: "recovery", routineId: "lower_body_recovery" };
    const startedAt = new Date().toISOString();
    localStorage.setItem("liftlog-data", JSON.stringify({
      hasSeenOnboarding: true, customPrograms: [program],
      currentProgram: { programId: program.id, programName: program.name, source: "custom", dayIndex: 0, totalDays: 2, startDate: startedAt },
      exerciseNotes: { bench: { general: "Preserve my bench cue" } },
      workoutSessions: [{ id: "existing-session", planName: "Existing workout", startedAt: "2025-01-01T10:00:00Z", finishedAt: "2025-01-01T11:00:00Z", entries: [], workingSets: 0, totalVolume: 0, prs: [], mainMuscles: [] }],
    }));
  }, { program, recovery });
  const page = await context.newPage();
  page.on("dialog", (dialog) => { if (dialog.type() === "beforeunload") dialog.accept(); });
  await page.goto(origin);
  await page.getByRole("button", { name: "Train", exact: true }).last().click();
  return page;
}
const data = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("liftlog-data")));
const run = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("liftlog-active-run")));
async function start(page) { await page.getByRole("button", { name: "Start", exact: true }).click(); }
async function save(page, weight = "100") {
  await page.locator('input[type="number"]').first().fill(weight);
  await page.getByRole("button", { name: "Save set", exact: true }).click();
}
async function finish(page) {
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: /^(Finish Anyway|Finish Workout)$/ }).last().click();
  await page.getByRole("button", { name: "Reopen workout", exact: true }).waitFor();
  const celebration = page.getByRole("button", { name: "Keep Going", exact: true });
  if (await celebration.isVisible()) await celebration.click();
}

test("Today Start resumes the existing run without replacing saved sets or notes", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  const before = await run(page);
  await page.getByRole("button", { name: "Today", exact: true }).last().click();
  await page.getByRole("button", { name: /^(Start workout|Resume workout)$/i }).first().click();
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  assert.equal((await run(page)).startedAt, before.startedAt);
  assert.equal((await data(page)).exerciseNotes.bench.general, "Preserve my bench cue");
});

test("Save Set followed immediately by Finish includes the saved set once", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await finish(page);
  const state = await data(page), session = state.workoutSessions[0];
  assert.equal(session.workingSets, 1); assert.equal(session.totalVolume, 800);
  assert.equal(state.logs.length, 1); assert.equal(session.entries[0].sets.length, 1);
});

test("completed and partial exercises are combined without duplicate or missing sets", async (t) => {
  const page = await fixture(t); const history = (await data(page)).workoutSessions;
  await start(page); await save(page); await save(page);
  await page.getByRole("button", { name: /Finish exercise now/ }).click();
  await save(page, "150"); await save(page, "150"); await finish(page);
  const state = await data(page), session = state.workoutSessions[0];
  assert.equal(session.workingSets, 4); assert.equal(session.totalVolume, 4000);
  assert.deepEqual(session.entries.map((e) => e.sets.length), [2, 2]);
  assert.equal(new Set(state.logs.map((l) => l.id)).size, 2);
  assert.deepEqual(state.workoutSessions.slice(1), history);
  await page.getByRole("button", { name: "Back to plans", exact: true }).click();
  await page.getByRole("button", { name: "Train", exact: true }).last().click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  assert.match(await page.locator("body").innerText(), /4 sets/);
  await page.getByRole("button", { name: "Progress", exact: true }).last().click();
  await page.getByRole("tab", { name: "Performance", exact: true }).click();
  assert.match(await page.locator("body").innerText(), /4,000/);
});

test("interrupted workout restores saved sets and typed exercise state", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.locator('input[type="number"]').first().fill("115");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  const before = await run(page);
  await page.reload();
  assert.equal(await page.locator('input[type="number"]').first().inputValue(), "115");
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  await finish(page); assert.equal((await data(page)).workoutSessions[0].workingSets, 1);
});

test("finishing a preserved workout never reactivates its ended program", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).last().click();
  await page.getByRole("button", { name: "View Program", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Program", exact: true }).click();
  assert.equal((await data(page)).currentProgram, null);
  await page.getByRole("button", { name: "Train", exact: true }).last().click();
  await page.getByRole("button", { name: "Resume workout", exact: true }).click();
  await finish(page);
  assert.equal((await data(page)).currentProgram, null);
  assert.equal((await data(page)).workoutSessions[0].sourceProgramId, program.id);
});

test("workout chooser routes recovery to the recovery runner", async (t) => {
  const page = await fixture(t, true), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Start workout today", exact: true }).click();
  await page.getByRole("button", { name: /^(Start programmed workout|Start recovery session)$/i }).click();
  await page.waitForTimeout(100);
  assert.deepEqual(errors, []);
  assert.equal(await page.getByRole("button", { name: "Save set", exact: true }).count(), 0);
  assert.match(await page.locator("body").innerText(), /Lower Body Recovery/i);
  assert.equal(await run(page), null);
});

test("Save Set is persisted before its click handler returns", async (t) => {
  const page = await fixture(t); await start(page);
  await page.locator('input[type="number"]').first().fill("100");
  const immediatelySaved = await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim().toLowerCase() === "save set").click();
    return JSON.parse(localStorage.getItem("liftlog-active-run")).draftByIndex[0].confirmedSets;
  });
  assert.equal(immediatelySaved.length, 1); assert.equal(immediatelySaved[0].weight, 100);
  await finish(page); assert.equal((await data(page)).workoutSessions[0].workingSets, 1);
});

test("repeated Finish in one event does not duplicate sessions, sets or program advancement", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish Anyway");
    button.click(); button.click();
  });
  await page.getByRole("button", { name: "Reopen workout", exact: true }).waitFor();
  const state = await data(page);
  assert.equal(state.workoutSessions.length, 2); assert.equal(state.logs.length, 1);
  assert.equal(state.workoutSessions[0].workingSets, 1); assert.equal(state.currentProgram.dayIndex, 1);
});

test("reopen and finish again preserves saved sets exactly once", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await finish(page);
  const before = (await data(page)).workoutSessions[0];
  await page.getByRole("button", { name: "Reopen workout", exact: true }).click();
  await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions.length, 2); assert.equal(state.logs.length, 1);
  assert.equal(state.workoutSessions[0].id, before.id);
  assert.equal(state.workoutSessions[0].workingSets, 1);
  assert.equal(state.currentProgram.dayIndex, 1);
});

test("failed history write retains a recoverable checkpoint and succeeds after reload", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-data") throw new DOMException("Synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  assert.equal((await data(page)).workoutSessions.length, 1);
  assert.equal((await run(page)).finished, false);
  assert.equal((await run(page)).sessionEntries[0].entry.sets.length, 1);
  await page.reload(); await finish(page);
  assert.equal((await data(page)).workoutSessions.length, 2);
  assert.equal((await data(page)).workoutSessions[0].workingSets, 1);
});

test("interrupted finished-marker write recovers durable history without another session", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run" && JSON.parse(value).finished) throw new DOMException("Synthetic quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await finish(page);
  assert.equal((await run(page)).completionPending, true);
  await page.reload();
  await page.getByRole("button", { name: "Reopen workout", exact: true }).waitFor();
  const state = await data(page);
  assert.equal(state.workoutSessions.length, 2); assert.equal(state.logs.length, 1);
  assert.equal(state.currentProgram.dayIndex, 1);
  assert.equal((await run(page)).finished, true);
});

test("an interrupted exercise-log write resumes into the same log, including subsequent saved sets", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run" && JSON.parse(value).sessionEntries.length) throw new DOMException("Synthetic interruption", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: /Finish exercise now/ }).click();
  assert.equal((await data(page)).logs.length, 1);
  assert.equal((await run(page)).sessionEntries.length, 0);
  await page.reload(); await save(page); await finish(page);
  const state = await data(page);
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].sets.length, 2);
  assert.equal(state.workoutSessions[0].workingSets, 2);
});

test("a new Start action from another program day resumes rather than replaces the run", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  const before = await run(page);
  const beforeState = await data(page);
  await page.getByRole("button", { name: "Today", exact: true }).last().click();
  await page.getByRole("button", { name: "View Program", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Day B" }).first().click();
  await page.getByRole("button", { name: "Start This Workout", exact: true }).click();
  assert.equal((await run(page)).id, before.id);
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  const afterState = await data(page);
  assert.deepEqual(afterState.currentProgram, beforeState.currentProgram);
  assert.deepEqual(afterState.programDayOverride, beforeState.programDayOverride);
});

test("a failed Save Set write stays visible as unsaved and can be recovered without losing in-memory sets", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    window.restoreSyntheticStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run") throw new DOMException("Synthetic quota", "QuotaExceededError");
      return window.restoreSyntheticStorage.call(this, key, value);
    };
  });
  await save(page);
  assert.match(await page.locator("body").innerText(), /not saved/i);
  assert.equal((await run(page)).draftByIndex[0].confirmedSets.length, 1);
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreSyntheticStorage; });
  await finish(page);
  assert.equal((await data(page)).workoutSessions[0].workingSets, 2);
});

test("combined exercise checkpoint and history failures retain every saved set on retry", async (t) => {
  const page = await fixture(t), history = (await data(page)).workoutSessions;
  await start(page); await save(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run" && JSON.parse(value).sessionEntries.length) throw new DOMException("Synthetic checkpoint interruption", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: /Finish exercise now/ }).click();
  await page.reload(); await save(page);
  assert.equal((await run(page)).draftByIndex[0].confirmedSets.length, 2);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-data") throw new DOMException("Synthetic history write failure", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  assert.equal((await run(page)).sessionEntries[0].entry.sets.length, 2);
  await page.reload(); await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions[0].workingSets, 2);
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].sets.length, 2);
  assert.deepEqual(state.workoutSessions.slice(1), history);
});

test("multiple history failures across reloads produce one complete session", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await save(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "liftlog-data") throw new DOMException("Sequential synthetic failure", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Finish workout", exact: true }).click();
    await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
    assert.equal((await run(page)).sessionEntries[0].entry.sets.length, 2);
    assert.equal((await data(page)).workoutSessions.length, 1);
    await page.reload();
  }
  await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions.length, 2); assert.equal(state.logs.length, 1);
  assert.equal(state.workoutSessions[0].workingSets, 2);
});

test("unknown durable conflicts preserve both copies, persist on reload and export recovery data", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("liftlog-data")), r = JSON.parse(localStorage.getItem("liftlog-active-run"));
    state.logs = [{ id: `log_${r.id}_${r.exercises[0].workoutSlotId}`, exId: "bench", date: r.startedAt, targetReps: 8, sets: r.draftByIndex[0].confirmedSets.map((s) => ({ ...s, weight: 999 })) }];
    localStorage.setItem("liftlog-data", JSON.stringify(state));
  });
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  await page.getByRole("alert").first().waitFor();
  assert.equal((await data(page)).logs[0].sets[0].weight, 999);
  assert.equal((await run(page)).finished, false);
  assert.equal(await page.getByRole("button", { name: "Finish workout", exact: true }).isDisabled(), true);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("liftlog-data"));
    state.logs[0].sets[0].weight = 888;
    localStorage.setItem("liftlog-data", JSON.stringify(state));
  });
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export persistence recovery", exact: true }).click();
  const download = await downloading;
  const recovered = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(JSON.parse(recovered.conflicts[0].observed).logs[0].sets[0].weight, 999);
  assert.equal(JSON.parse(recovered.observed.find(([key]) => key === "liftlog-data")[1]).logs[0].sets[0].weight, 888);
  assert.equal(JSON.parse(recovered.base.find(([key]) => key === "liftlog-active-run")[1]).sessionEntries[0].entry.sets[0].weight, 100);
  const preserved = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("brk-recovery:")));
  assert.ok(preserved.length > 0);
  await page.reload(); await page.getByRole("alert").first().waitFor();
  assert.equal((await data(page)).workoutSessions.length, 1);
  assert.equal((await run(page)).finished, false);
});

test("storage unavailable during completion read-back keeps the checkpoint for safe retry", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    let fail = false;
    Storage.prototype.setItem = function (key, value) {
      set.call(this, key, value);
      if (key === "liftlog-data" && JSON.parse(value).workoutSessions.length > 1) fail = true;
    };
    Storage.prototype.getItem = function (key) {
      if (key === "liftlog-data" && fail) { fail = false; throw new DOMException("Read-back unavailable", "SecurityError"); }
      return get.call(this, key);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  assert.equal((await run(page)).finished, false);
  assert.equal((await data(page)).workoutSessions[0].workingSets, 1);
  await page.reload(); await finish(page);
  assert.equal((await data(page)).workoutSessions.length, 2);
  assert.equal((await data(page)).logs.length, 1);
});

test("legacy ambiguous checkpoints remain recoverable instead of choosing the shorter canonical log", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await save(page);
  // Seed an older-build snapshot while no editor owns storage, not as an uncoordinated live edit.
  await page.getByRole("button", { name: "Release editing", exact: true }).click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("liftlog-data")), r = JSON.parse(localStorage.getItem("liftlog-active-run"));
    const entry = { id: `log_${r.id}_${r.exercises[0].workoutSlotId}`, exId: "bench", date: r.startedAt, targetReps: 8, sets: r.draftByIndex[0].confirmedSets };
    state.logs = [{ ...entry, sets: entry.sets.slice(0, 1) }];
    delete r.draftByIndex[0].recoveryBases;
    r.summaryId = `session_${r.id}`; r.sessionEntries = [{ index: 0, exId: "bench", entry }];
    localStorage.setItem("liftlog-data", JSON.stringify(state)); localStorage.setItem("liftlog-active-run", JSON.stringify(r));
  });
  await page.reload();
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  await page.getByRole("alert").first().waitFor();
  assert.equal((await run(page)).sessionEntries[0].entry.sets.length, 2);
  assert.equal((await run(page)).draftByIndex[0].confirmedSets.length, 2);
  assert.equal((await data(page)).logs[0].sets.length, 1);
  assert.equal((await data(page)).workoutSessions.length, 1);
});

test("failed canonical exercise write followed by another saved exercise recovers both on reload", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    window.restoreExerciseStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-data") throw new DOMException("Synthetic exercise write failure", "QuotaExceededError");
      return window.restoreExerciseStorage.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: /Finish exercise now/ }).click();
  assert.equal((await data(page)).logs.length, 0);
  assert.equal((await run(page)).sessionEntries[0].entry.sets.length, 1);
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreExerciseStorage; });
  await save(page, "150"); await page.reload(); await finish(page);
  const state = await data(page);
  assert.equal(state.logs.length, 2); assert.equal(state.workoutSessions[0].workingSets, 2);
  assert.equal(state.workoutSessions[0].totalVolume, 2000);
});

async function swapExercise(page, name = "Incline barbell bench press") {
  await page.getByRole("button", { name: "Swap exercise", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

test("swapping before Save Set clears only unconfirmed input and keeps the slot count", async (t) => {
  const page = await fixture(t); await start(page);
  await page.locator('input[type="number"]').first().fill("175");
  await swapExercise(page);
  assert.equal((await run(page)).exercises.length, 2);
  assert.equal((await run(page)).sessionEntries.length, 0);
  await save(page, "150"); await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions[0].workingSets, 1);
  assert.notEqual(state.logs[0].exId, "bench");
  assert.equal(state.logs[0].sets[0].weight, 150);
});

for (const count of [1, 3]) test(`swap preserves ${count} saved sets through reload and Finish`, async (t) => {
  const page = await fixture(t); await start(page);
  for (let i = 0; i < count; i++) await save(page);
  const before = await run(page), history = (await data(page)).workoutSessions;
  await swapExercise(page); await page.reload();
  const preserved = (await run(page)).sessionEntries[0].entry;
  assert.equal(preserved.exId, "bench");
  assert.equal(preserved.date, before.draftByIndex[0].entryDate);
  assert.deepEqual(preserved.sets, before.draftByIndex[0].confirmedSets);
  await finish(page);
  const state = await data(page), session = state.workoutSessions[0];
  assert.equal(session.workingSets, count); assert.equal(session.totalVolume, count * 800);
  assert.equal(state.logs.length, 1); assert.equal(session.entries[0].exId, "bench");
  assert.deepEqual(state.workoutSessions.slice(1), history);
});

test("repeated swaps and replacement saves keep independent ordered logs without duplicates", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await save(page);
  await swapExercise(page); await save(page, "150");
  const first = await run(page), replacementId = first.exercises[1].exId;
  await swapExercise(page, "Flat dumbbell press"); await save(page, "60");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await page.getByRole("button", { name: "Resume workout", exact: true }).click();
  await page.reload(); await finish(page);
  const state = await data(page), session = state.workoutSessions[0];
  assert.deepEqual(session.entries.map((e) => e.exId), ["bench", replacementId, (await run(page)).exercises[2].exId]);
  assert.deepEqual(session.entries.map((e) => e.sets.length), [2, 1, 1]);
  assert.equal(session.workingSets, 4); assert.equal(session.totalVolume, 3280);
  assert.equal(state.logs.length, 3); assert.equal(new Set(state.logs.map((l) => l.id)).size, 3);
  const before = structuredClone(session);
  await page.getByRole("button", { name: "Reopen workout", exact: true }).click();
  await finish(page);
  assert.equal((await data(page)).workoutSessions[0].id, before.id);
  assert.equal((await data(page)).workoutSessions[0].workingSets, 4);
  assert.equal((await data(page)).logs.length, 3);
});

test("swap after interrupted exercise checkpoint reconciles older canonical work and later sets", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run" && JSON.parse(value).sessionEntries.length) throw new DOMException("Synthetic checkpoint failure", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: /Finish exercise now/ }).click();
  await page.reload(); await save(page); await swapExercise(page);
  await save(page, "150"); await page.reload(); await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions[0].workingSets, 3);
  assert.equal(state.workoutSessions[0].totalVolume, 2800);
  assert.deepEqual(state.workoutSessions[0].entries.map((e) => e.sets.length), [2, 1]);
  assert.equal(state.logs.length, 2);
});

test("failed swap checkpoint retains original durable work and recovers when storage returns", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  const before = await run(page);
  await page.evaluate(() => {
    window.restoreSwapStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run") throw new DOMException("Synthetic swap failure", "QuotaExceededError");
      return window.restoreSwapStorage.call(this, key, value);
    };
  });
  await swapExercise(page);
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  await page.getByText("Not saved", { exact: true }).waitFor();
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreSwapStorage; });
  await save(page, "150"); await page.reload(); await finish(page);
  assert.deepEqual((await data(page)).workoutSessions[0].entries.map((e) => e.sets.length), [1, 1]);
  assert.equal((await data(page)).workoutSessions[0].totalVolume, 2000);
});

test("swap preserves historical logs and calculates PRs for the performed exercise", async (t) => {
  const page = await fixture(t);
  await page.getByRole("button", { name: "Release editing", exact: true }).click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("liftlog-data"));
    state.logs = [{ id: "old-bench", exId: "bench", date: "2025-01-01T10:00:00Z", sets: [{ weight: 50, reps: 8, setType: "working" }], targetReps: 8 }];
    localStorage.setItem("liftlog-data", JSON.stringify(state));
  });
  await page.reload(); await page.getByRole("button", { name: "Train", exact: true }).last().click();
  const old = await data(page); await start(page); await save(page); await swapExercise(page);
  await save(page, "150"); await finish(page);
  const state = await data(page), session = state.workoutSessions[0];
  assert.equal(session.totalVolume, 2000); assert.equal(session.workingSets, 2);
  assert.ok(session.prs.some((pr) => pr.exId === "bench"));
  assert.deepEqual(state.logs.find((l) => l.id === "old-bench"), old.logs[0]);
  assert.deepEqual(state.workoutSessions.slice(1), old.workoutSessions);
});

test("removing an exercise with saved draft sets explicitly warns and Cancel preserves them", async (t) => {
  const page = await fixture(t); await start(page); await save(page);
  const before = await run(page);
  await page.getByRole("button", { name: "Remove Barbell bench press", exact: true }).click();
  assert.match(await page.locator("body").innerText(), /remove the exercise and its logged sets/i);
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  await finish(page); assert.equal((await data(page)).workoutSessions[0].workingSets, 1);
});

test("reload after a rejected swap write restores the last durable original sets", async (t) => {
  const page = await fixture(t); await start(page); await save(page); await save(page);
  const before = await run(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "liftlog-active-run") throw new DOMException("Synthetic unavailable storage", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await swapExercise(page); await page.reload();
  assert.equal((await run(page)).exercises.length, 2); // rejected swap was never durable
  assert.deepEqual((await run(page)).draftByIndex[0].confirmedSets, before.draftByIndex[0].confirmedSets);
  await finish(page);
  const state = await data(page);
  assert.equal(state.workoutSessions[0].workingSets, 2);
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].exId, "bench");
});

async function competingTab(page, init) {
  const tab = await page.context().newPage();
  tab.on("dialog", (dialog) => { if (dialog.type() === "beforeunload") dialog.accept(); });
  if (init) await tab.addInitScript(init);
  await tab.goto(origin);
  await tab.getByRole("heading", { name: /^(Read-only|Initialization failed)$/ }).waitFor();
  return tab;
}
async function handoff(a, b) {
  await a.getByRole("button", { name: "Release editing", exact: true }).click();
  await a.getByRole("heading", { name: "Read-only", exact: true }).waitFor();
  await b.getByRole("button", { name: "Enable editing", exact: true }).click();
  await b.getByRole("button", { name: "Save set", exact: true }).waitFor();
}

test("single editor prevents the original two-tab overwrite and transfers fresh confirmed data", async (t) => {
  const a = await fixture(t); await start(a); await save(a);
  const b = await competingTab(a, () => {
    window.writerCalls = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) { window.writerCalls.push(key); return original.call(this,key,value); };
  });
  assert.equal(await b.getByRole("button", { name: "Save set", exact: true }).count(), 0);
  assert.doesNotMatch(await b.locator("body").innerText(), /Saved ✓/i);
  assert.deepEqual(await b.evaluate(() => window.writerCalls), []); // no startup migration, auth or timer writer
  await b.getByRole("button", { name: "Enable editing", exact: true }).click();
  await b.getByRole("heading", { name: "Read-only", exact: true }).waitFor();
  await save(a, "150");
  assert.deepEqual((await run(a)).draftByIndex[0].confirmedSets.map((s) => s.weight), [100,150]);
  // Pending typed input is synchronously flushed during an explicit handoff.
  await a.locator('input[type="number"]').first().fill("175");
  await handoff(a,b);
  assert.equal(await b.locator('input[type="number"]').first().inputValue(), "175");
  await save(b,"200"); await finish(b);
  assert.deepEqual((await data(b)).workoutSessions[0].entries[0].sets.map((s) => s.weight), [100,150,200]);
  assert.equal((await data(b)).logs.length,1);
  await a.reload(); await a.getByRole("heading", { name: "Read-only", exact: true }).waitFor();
  await b.reload(); await b.getByRole("button", { name: "Reopen workout", exact: true }).waitFor();
  assert.deepEqual((await data(b)).logs[0].sets.map((s) => s.weight), [100,150,200]);
});

test("closing the owning tab releases the browser lock and resumes the durable workout", async (t) => {
  const a = await fixture(t); await start(a); await save(a);
  const before = await run(a), b = await competingTab(a);
  await a.close();
  await b.getByRole("button", { name: "Enable editing", exact: true }).click();
  await b.getByRole("button", { name: "Save set", exact: true }).waitFor();
  assert.equal((await run(b)).id,before.id);
  assert.deepEqual((await run(b)).draftByIndex[0].confirmedSets,before.draftByIndex[0].confirmedSets);
  await finish(b); assert.equal((await data(b)).workoutSessions[0].workingSets,1);
});

test("reload reacquires ownership before restoring an unfinished editor", async (t) => {
  const a = await fixture(t); await start(a); await save(a);
  const before = await run(a), b = await competingTab(a);
  await a.reload(); await a.getByRole("button", { name: "Save set", exact: true }).waitFor();
  assert.equal((await run(a)).id,before.id);
  await save(a,"150");
  assert.equal(await b.getByRole("button", { name: "Save set", exact: true }).count(),0);
  await finish(a); assert.equal((await data(a)).workoutSessions[0].workingSets,2);
});

test("a stale captured Finish handler cannot write after ownership transfer", async (t) => {
  const a = await fixture(t); await start(a); await save(a);
  await a.getByRole("button", { name: "Finish workout", exact: true }).click();
  await a.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish Anyway");
    const props = button[Object.keys(button).find((key) => key.startsWith("__reactProps$"))];
    window.staleFinish = props.onClick; // real handler, retained as a late asynchronous callback
  });
  const b = await competingTab(a); await handoff(a,b); await save(b,"150");
  const before = await b.evaluate(() => [localStorage.getItem("liftlog-data"),localStorage.getItem("liftlog-active-run")]);
  await a.evaluate(() => window.staleFinish());
  assert.deepEqual(await b.evaluate(() => [localStorage.getItem("liftlog-data"),localStorage.getItem("liftlog-active-run")]),before);
  await finish(b); assert.equal((await data(b)).workoutSessions[0].workingSets,2);
});

test("a delayed backup reader cannot replace history after its editor releases ownership", async (t) => {
  const a = await fixture(t);
  await a.getByRole("button", { name: "More", exact: true }).last().click();
  await a.getByText("Settings", { exact: true }).click();
  await a.evaluate(() => {
    window.FileReader = class {
      readAsText() { window.lateBackup = () => { this.result=JSON.stringify({data:{logs:[],workoutSessions:[]}}); this.onload(); }; }
    };
  });
  await a.locator('input[type="file"][accept*="json"]').setInputFiles({name:"synthetic.json",mimeType:"application/json",buffer:Buffer.from("{}")});
  const b = await competingTab(a);
  await a.getByRole("button", { name: "Release editing", exact: true }).click();
  await b.getByRole("button", { name: "Enable editing", exact: true }).click();
  await b.getByRole("button", { name: "Train", exact: true }).last().click();
  await start(b); await save(b); await finish(b);
  const before = await data(b);
  a.once("dialog", (dialog) => dialog.accept()); await a.evaluate(() => window.lateBackup());
  assert.deepEqual(await data(b),before);
});

test("complete write rejection stays Not saved, refuses transfer, and Finish retry retains all sets", async (t) => {
  const a = await fixture(t); await start(a); await save(a); const b = await competingTab(a);
  await a.evaluate(() => {
    window.restorePersistence = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("Synthetic total rejection","QuotaExceededError"); };
  });
  await save(a,"150"); await a.getByText("Not saved",{exact:true}).waitFor();
  assert.doesNotMatch(await a.locator("body").innerText(), /Saved ✓/i);
  a.once("dialog",(dialog) => dialog.accept());
  await a.getByRole("button",{name:"Finish workout",exact:true}).click();
  await a.getByRole("button",{name:"Finish Anyway",exact:true}).click();
  await a.waitForTimeout(500);
  assert.match(await a.locator("body").innerText(),/not saved/i);
  assert.doesNotMatch(await a.locator("body").innerText(),/SAVING…|Saved ✓/i);
  assert.equal(await a.getByRole("button",{name:"Save set",exact:true}).count(),1); // original exercise remains editable
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  assert.equal(await a.getByRole("heading",{name:"Read-only",exact:true}).count(),0);
  await b.getByRole("button",{name:"Enable editing",exact:true}).click();
  await b.getByRole("heading",{name:"Read-only",exact:true}).waitFor();
  assert.equal((await data(a)).workoutSessions.length,1);
  await a.evaluate(() => { Storage.prototype.setItem=window.restorePersistence; });
  await finish(a); assert.deepEqual((await data(a)).logs[0].sets.map((s) => s.weight),[100,150]);
});

test("a silent dropped checkpoint never earns Saved and can be retried without duplicate sets", async (t) => {
  const a = await fixture(t); await start(a); await save(a);
  await a.evaluate(() => {
    window.restoreSilent = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k,v) { if(k!=="liftlog-active-run") return window.restoreSilent.call(this,k,v); };
  });
  await save(a,"150"); await a.getByText("Not saved",{exact:true}).waitFor();
  assert.equal((await run(a)).draftByIndex[0].confirmedSets.length,1);
  await a.evaluate(() => {Storage.prototype.setItem=window.restoreSilent;});
  await finish(a); assert.equal((await data(a)).workoutSessions[0].workingSets,2);
});

for (const failure of ["unavailable", "request-rejected"]) test(`coordination ${failure} fails closed before startup writers`, async (t) => {
  const a = await fixture(t); const original = await data(a);
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  const b = await competingTab(a, failure === "unavailable" ? () => {
    Object.defineProperty(navigator,"locks",{value:undefined});
  } : () => {
    navigator.locks.request = () => Promise.reject(new Error("Synthetic ownership failure"));
  });
  assert.match(await b.locator("body").innerText(),/coordination is unavailable/i);
  assert.equal(await b.getByRole("button",{name:"Train",exact:true}).count(),0);
  assert.deepEqual(await data(b),original);
});

test("unreadable revision snapshot prevents default-state writes", async (t) => {
  const a = await fixture(t), before=await data(a);
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  const b = await competingTab(a, () => {
    window.getBeforeFailure=Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if(key==="liftlog-data") throw new Error("Synthetic revision read failure"); return window.getBeforeFailure.call(this,key); };
  });
  assert.match(await b.locator("body").innerText(),/No data has been reset/i);
  await b.evaluate(() => {Storage.prototype.getItem=window.getBeforeFailure;});
  assert.deepEqual(await data(b),before);
});

test("pagehide fences the old realm and BFCache restore reloads before editing", async (t) => {
  const a = await fixture(t); await start(a); await save(a); const b=await competingTab(a);
  await a.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true})));
  await a.getByRole("heading",{name:"Read-only",exact:true}).waitFor();
  await b.getByRole("button",{name:"Enable editing",exact:true}).click();
  await b.getByRole("button",{name:"Save set",exact:true}).waitFor(); await save(b,"150");
  await a.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})));
  await a.getByRole("heading",{name:"Read-only",exact:true}).waitFor();
  await finish(b); assert.equal((await data(b)).workoutSessions[0].workingSets,2);
});

test("photo metadata uses the verified owner store and survives a handoff", async (t) => {
  const a=await fixture(t);
  await a.getByRole("button",{name:"Progress",exact:true}).last().click();
  await a.getByRole("tab",{name:"Body",exact:true}).click();
  await a.getByText("Progress photos",{exact:true}).click();
  const png=await a.evaluate(() => {const c=document.createElement("canvas"); c.width=16;c.height=16;c.getContext("2d").fillRect(0,0,16,16);return c.toDataURL().split(",")[1];});
  await a.locator('input[type="file"][accept="image/*"]').setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await a.waitForFunction(() => JSON.parse(localStorage.getItem("liftlog-data")).photos?.length===1);
  const before=await data(a), b=await competingTab(a);
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  await b.getByRole("button",{name:"Enable editing",exact:true}).click();
  await b.getByRole("button",{name:"Train",exact:true}).last().waitFor();
  assert.deepEqual((await data(b)).photos,before.photos);
  assert.deepEqual((await data(b)).workoutSessions,before.workoutSessions);
});

test("an uncoordinated external storage writer triggers read-only recovery without replacing either copy", async (t) => {
  const a=await fixture(t); await start(a); await save(a); const b=await competingTab(a);
  await b.evaluate(() => {
    const state=JSON.parse(localStorage.getItem("liftlog-data"));
    state.exerciseNotes.bench.general="Synthetic external correction";
    localStorage.setItem("liftlog-data",JSON.stringify(state));
  });
  await a.getByRole("status").filter({hasText:"Read-only"}).waitFor();
  assert.equal(await a.getByRole("button",{name:"Save set",exact:true}).isDisabled(),true);
  assert.equal((await data(a)).exerciseNotes.bench.general,"Synthetic external correction");
  assert.equal((await run(a)).draftByIndex[0].confirmedSets.length,1);
  const downloadPromise=a.waitForEvent("download");
  await a.getByRole("button",{name:"Export persistence recovery",exact:true}).click();
  const download=await downloadPromise;
  const exported=JSON.parse(await readFile(await download.path(),"utf8"));
  assert.equal(JSON.parse(exported.conflicts[0].base).exerciseNotes.bench.general,"Preserve my bench cue");
  assert.equal(JSON.parse(exported.conflicts[0].observed).exerciseNotes.bench.general,"Synthetic external correction");
});

test("photo processing prevents voluntary transfer until its metadata is safely persisted", async (t) => {
  const a=await fixture(t);
  await a.getByRole("button",{name:"Progress",exact:true}).last().click();
  await a.getByRole("tab",{name:"Body",exact:true}).click();
  await a.getByText("Progress photos",{exact:true}).click();
  await a.evaluate(() => {
    const original=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");
    Object.defineProperty(HTMLImageElement.prototype,"src",{...original,set(value) {
      if(value.startsWith("blob:")) window.resumePhoto=()=>original.set.call(this,value);
      else original.set.call(this,value);
    }});
  });
  const png=await a.evaluate(() => {const c=document.createElement("canvas");c.width=16;c.height=16;return c.toDataURL().split(",")[1];});
  await a.locator('input[type="file"][accept="image/*"]').setInputFiles({name:"pending.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  const b=await competingTab(a);
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  assert.equal(await a.getByRole("heading",{name:"Read-only",exact:true}).count(),0);
  assert.equal(((await data(a)).photos || []).length,0);
  await a.evaluate(()=>window.resumePhoto());
  await a.waitForFunction(()=>JSON.parse(localStorage.getItem("liftlog-data")).photos.length===1);
  const photo=(await data(a)).photos[0];
  await a.getByRole("button",{name:"Release editing",exact:true}).click();
  await b.getByRole("button",{name:"Enable editing",exact:true}).click();
  await b.getByRole("button",{name:"Train",exact:true}).last().waitFor();
  assert.deepEqual((await data(b)).photos,[photo]);
});

test("startup migration failure must not authorize overwriting valid workout history", async (t) => {
 const page=await fixture(t);
 await page.getByRole("button",{name:"Release editing",exact:true}).click();
 const before=await page.evaluate(() => {
   const state=JSON.parse(localStorage.getItem("liftlog-data"));
   state.customPlans=[{id:"synthetic-legacy-plan",exercises:[]}];
   state.logs=[{id:"synthetic-existing-log",exId:"bench",date:"2026-01-01T12:00:00Z",sets:[{weight:150,reps:8}],targetReps:8}];
   state.workoutSessions[0].entries=[{exId:"bench",sets:[{weight:150,reps:8}],targetReps:8}];
   state.workoutSessions[0].workingSets=1; state.workoutSessions[0].totalVolume=1200;
   const raw=JSON.stringify(state); localStorage.setItem("liftlog-data",raw); return raw;
 });
 await page.reload();
 await page.getByRole("button",{name:"More",exact:true}).last().click();
 await page.getByText("Settings",{exact:true}).click();
 const loaded=await data(page), original=JSON.parse(before);
 assert.deepEqual(loaded.workoutSessions,original.workoutSessions);
 assert.deepEqual(loaded.logs,original.logs);
 assert.equal(loaded.customPlans[0].name,"Custom workout");
 await page.getByRole("button",{name:"RPE",exact:true}).click();
 const after=await data(page);
 assert.deepEqual(after.workoutSessions,original.workoutSessions,"Changing effort tracking after a startup failure must preserve existing sessions");
 assert.deepEqual(after.logs,original.logs,"Changing settings must preserve confirmed historical sets");
});

async function initializationFixture(t, canonical, {active=null,fault=null,credential=false}={}) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  t.after(()=>context.close());
  const external=[];
  await context.route("**/*",route=>{
    if(new URL(route.request().url()).origin===origin) return route.continue();
    external.push(route.request().url());return route.abort();
  });
  await context.addInitScript(({canonical,active,fault,credential})=>{
    if(!localStorage.getItem("brk-synthetic-seeded")) {
      if(canonical!==null) localStorage.setItem("liftlog-data",canonical);
      if(active!==null) localStorage.setItem("liftlog-active-run",active);
      if(credential) localStorage.setItem("sb-synthetic-auth-token","synthetic-private-credential");
      if(fault) localStorage.setItem("brk-synthetic-fault",fault);
      localStorage.setItem("brk-synthetic-seeded","yes");
    }
    window.initialWrites=[];
    const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value) {
      window.initialWrites.push(key);
      const mode=localStorage.getItem("brk-synthetic-fault");
      if(mode==="stage-dropped"&&key.startsWith("brk-initialization-stage:"))return;
      if(mode==="canonical-rejected"&&key==="liftlog-data")throw new DOMException("Synthetic migration quota failure","QuotaExceededError");
      return set.call(this,key,value);
    };
    Storage.prototype.removeItem=function(key) {window.initialWrites.push(key);return remove.call(this,key);};
    if(localStorage.getItem("brk-synthetic-fault")==="halfway") {
      const indexOf=String.prototype.indexOf;
      String.prototype.indexOf=function(search,...args) {
        if(String(this)==="Superman — fault"&&search===" — ")throw new Error("Synthetic migration exception after first plan");
        return indexOf.call(this,search,...args);
      };
    }
  },{canonical,active,fault,credential});
  const page=await context.newPage();
  page.on("dialog",dialog=>{if(dialog.type()==="beforeunload")dialog.accept();});
  await page.goto(origin);
  return {page,external};
}
function startupHistory(extra={}) {
  return {hasSeenOnboarding:true,logs:[{id:"previous-log",exId:"bench",date:"2026-01-01T12:00:00Z",sets:[{weight:150,reps:8}],targetReps:8}],
    workoutSessions:[{id:"previous-session",planName:"Previous workout",startedAt:"2026-01-01T12:00:00Z",finishedAt:"2026-01-01T13:00:00Z",entries:[{exId:"bench",sets:[{weight:150,reps:8}],targetReps:8}],workingSets:1,totalVolume:1200,prs:[],mainMuscles:[]}],...extra};
}
async function initializationFailed(page) {
  await page.getByRole("heading",{name:"Initialization failed",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"RPE",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:/^(Start|Save set|Finish workout)$/}).count(),0);
  assert.equal(await page.getByRole("button",{name:"More",exact:true}).count(),0);
  assert.doesNotMatch(await page.locator("body").innerText(),/SAVED ✓/i);
}
async function exportInitialization(page) {
  const pending=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export original saved data",exact:true}).click();
  const download=await pending;
  return JSON.parse(await readFile(await download.path(),"utf8"));
}

test("a genuinely new installation can initialize and save without an existing snapshot",async(t)=>{
  const {page}=await initializationFixture(t,null);
  await page.getByRole("button",{name:"Train",exact:true}).last().click();
  assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),null);
  await page.getByRole("button",{name:"More",exact:true}).last().click();
  await page.getByText("Settings",{exact:true}).click();await page.getByRole("button",{name:"RPE",exact:true}).click();
  assert.equal((await data(page)).settings.rirSystem,"rpe");assert.deepEqual((await data(page)).logs,[]);
});

test("valid existing history initializes without replacement and remains unchanged after settings and reload",async(t)=>{
  const original=JSON.stringify(startupHistory());
  const {page}=await initializationFixture(t,original);
  await page.getByRole("button",{name:"More",exact:true}).last().click();
  assert.deepEqual((await data(page)).logs,JSON.parse(original).logs);
  assert.deepEqual((await data(page)).workoutSessions,JSON.parse(original).workoutSessions);
  await page.getByText("Settings",{exact:true}).click();await page.getByRole("button",{name:"RPE",exact:true}).click();
  for(let i=0;i<2;i++) {
    await page.reload();await page.getByRole("button",{name:"Train",exact:true}).last().waitFor();
    const actual=await data(page);assert.deepEqual(actual.logs,JSON.parse(original).logs);assert.deepEqual(actual.workoutSessions,JSON.parse(original).workoutSessions);
  }
});

for(const invalid of ["{invalid-json", "", JSON.stringify(startupHistory({logs:{malformed:true}})), JSON.stringify(startupHistory({customPrograms:[{id:"bad-program",name:17,days:[]}]}))]) {
 test(`invalid startup fails closed, exports exact bytes, and remains safe after reload (${invalid.slice(0,24)})`,async(t)=>{
   const {page,external}=await initializationFixture(t,invalid,{credential:true});
   await initializationFailed(page);await page.waitForTimeout(500);
   assert.deepEqual(await page.evaluate(()=>window.initialWrites),[]);
   assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),invalid);
   const exported=await exportInitialization(page);
   assert.equal(exported.original.canonical,invalid);assert.doesNotMatch(JSON.stringify(exported),/synthetic-private-credential/);
   assert.equal(exported.initialization,"failed");
   assert.equal(await page.evaluate(()=>localStorage.getItem("sb-synthetic-auth-token")),"synthetic-private-credential");
   assert.deepEqual(external,[]); // App, account restoration and hydration never start.
   await page.getByRole("button",{name:"Release editing",exact:true}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),invalid);
   await page.reload();await initializationFailed(page);
   assert.equal((await exportInitialization(page)).original.canonical,invalid);
 });
}

test("a custom program missing its optional name migrates without changing identity, progress, or history",async(t)=>{
 const source=startupHistory({customPrograms:[{id:"legacy-program",days:[{label:"A",exercises:[{exId:"bench",sets:3}]}]}],currentProgram:{programId:"legacy-program",source:"custom",dayIndex:0,totalDays:1,startDate:"2026-01-01T00:00:00Z"}});
 const original=JSON.stringify(source),{page}=await initializationFixture(t,original);
 await page.getByRole("button",{name:"Train",exact:true}).last().waitFor();
 const migrated=await data(page);
 assert.equal(migrated.customPrograms[0].name,"Custom program");assert.deepEqual(migrated.currentProgram,source.currentProgram);
 assert.deepEqual(migrated.logs,source.logs);assert.deepEqual(migrated.workoutSessions,source.workoutSessions);
 const savedOriginal=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith("brk-initialization-original:")))));
 assert.equal(savedOriginal.canonical,original);
 await page.reload();await page.getByRole("button",{name:"Train",exact:true}).last().waitFor();
 assert.deepEqual(await data(page),migrated);
});

test("a migration exception halfway through preserves the original and blocks every editor until a verified retry",async(t)=>{
 const source=startupHistory({customPlans:[{id:"first",name:"Superman — first",exercises:[]},{id:"second",name:"Superman — fault",exercises:[]}]}),original=JSON.stringify(source);
 const {page,external}=await initializationFixture(t,original,{fault:"halfway",credential:true});
 for(let i=0;i<2;i++) {
   await initializationFailed(page);assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),original);
   assert.deepEqual(await page.evaluate(()=>window.initialWrites),[]);
   assert.equal((await exportInitialization(page)).original.canonical,original);
   await page.reload();
 }
 await initializationFailed(page);assert.deepEqual(external,[]);
 await page.evaluate(()=>localStorage.setItem("brk-synthetic-fault","off"));await page.reload();
 await page.getByRole("button",{name:"Train",exact:true}).last().waitFor();
 const after=await data(page);assert.equal(after.customPlans[0].name,"Titan — first");assert.equal(after.customPlans[1].name,"Titan — fault");
 assert.deepEqual(after.logs,source.logs);assert.deepEqual(after.workoutSessions,source.workoutSessions);
});

for(const fault of ["stage-dropped","canonical-rejected"]) test(`failed migration persistence (${fault}) never enables editing or replaces original history`,async(t)=>{
 const source=startupHistory({customPlans:[{id:"p",exercises:[]}]}),original=JSON.stringify(source);
 const {page}=await initializationFixture(t,original,{fault});await initializationFailed(page);
 assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),original);
 assert.equal((await exportInitialization(page)).original.canonical,original);
 await page.reload();await initializationFailed(page);assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),original);
});

test("an invalid active checkpoint cannot be silently replaced by starting another workout",async(t)=>{
 const original=JSON.stringify(startupHistory()),active="{broken active checkpoint";
 const {page}=await initializationFixture(t,original,{active});await initializationFailed(page);
 assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-active-run")),active);
 assert.equal((await exportInitialization(page)).original.active,active);
 assert.equal(await page.evaluate(()=>localStorage.getItem("liftlog-data")),original);
});
