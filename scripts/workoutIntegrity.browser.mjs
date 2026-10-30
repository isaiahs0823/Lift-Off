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
  await page.getByRole("alert").waitFor();
  assert.equal((await data(page)).logs[0].sets[0].weight, 999);
  assert.equal((await run(page)).recoveryConflict.records.checkpoint.sets[0].weight, 100);
  assert.equal((await run(page)).finished, false);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("liftlog-data"));
    state.logs[0].sets[0].weight = 888;
    localStorage.setItem("liftlog-data", JSON.stringify(state));
  });
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Finish Anyway", exact: true }).click();
  assert.equal((await run(page)).recoveryConflict.variants.length, 2);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workout recovery", exact: true }).click();
  const download = await downloading;
  const recovered = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(recovered.run.recoveryConflict.records.canonical.sets[0].weight, 888);
  assert.equal(recovered.run.recoveryConflict.variants[0].canonical.sets[0].weight, 999);
  assert.equal(recovered.run.recoveryConflict.records.checkpoint.sets[0].weight, 100);
  await page.reload(); await page.getByRole("alert").waitFor();
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
  await page.getByRole("alert").waitFor();
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
