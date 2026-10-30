import { describe, it, expect, vi } from "vitest";
import { createEditorSession } from "../../persistence/editorSession.js";
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, get length() { return values.size; }, key: (i) => [...values.keys()][i], getItem: (k) => values.get(k) ?? null,
    setItem: vi.fn((k,v) => values.set(k,v)), removeItem: vi.fn((k) => values.delete(k)) };
}
it("verifies writes/removals and advances explicit in-session revisions under held ownership", () => {
  const raw = memory(), s = createEditorSession(raw,"a");
  s.markPending("liftlog-active-run"); s.storage.setItem("liftlog-active-run", "confirmed");
  expect(s.snapshot()).toMatchObject({revision:1,error:false,pending:0});
  s.storage.removeItem("liftlog-active-run"); expect(raw.getItem("liftlog-active-run")).toBeNull(); expect(s.snapshot().revision).toBe(2);
});
it("fences old backup, cloud, timer and photo callbacks after release", async () => {
  const raw = memory(), s = createEditorSession(raw,"a");
  const callbacks = ["liftlog-data", "liftlog-active-run", "liftlog-sync-status", "liftlog-rest-timer", "auth-token"].map((k) => () => s.storage.setItem(k,"stale"));
  s.revoke();
  for (const callback of callbacks) expect(callback).toThrow("read-only");
  expect(() => s.storage.removeItem("liftlog-data")).toThrow("read-only");
  expect(() => s.prepareRelease()).toThrow("read-only"); expect(raw.setItem).not.toHaveBeenCalled();
});
it("detects changed canonical revisions and preserves all versions without replacing canonical data", () => {
  const raw = memory({"liftlog-data":"base"}), s = createEditorSession(raw,"a");
  raw.values.set("liftlog-data", "another-writer");
  expect(() => s.storage.setItem("liftlog-data", "confirmed-new-work")).toThrow("Both copies");
  expect(raw.getItem("liftlog-data")).toBe("another-writer");
  const recovery = s.recovery();
  expect(recovery.conflicts[0]).toMatchObject({base:"base",attempted:"confirmed-new-work",observed:"another-writer"});
  expect(JSON.parse(raw.getItem(recovery.conflicts[0].recoveryKey))).toMatchObject({attempted:"confirmed-new-work"});
  expect(s.isOwner()).toBe(false); expect(() => s.storage.setItem("other", "x")).toThrow("changed outside");
});
it("keeps conflict copies in memory when writing an isolated recovery copy also fails", () => {
  const raw = memory({"liftlog-data":"base"}), s = createEditorSession(raw,"a");
  raw.values.set("liftlog-data","external"); raw.setItem.mockImplementation(() => {throw Error("quota");});
  expect(() => s.storage.setItem("liftlog-data","mine")).toThrow("Both copies");
  expect(s.recovery().conflicts[0]).toMatchObject({attempted:"mine",memoryOnly:true});
});
it("rejects silent dropped writes rather than claiming Saved", () => {
  const raw = memory(), s = createEditorSession(raw,"a"); raw.setItem.mockImplementation(() => {});
  expect(() => s.storage.setItem("liftlog-active-run","new")).toThrow("verified"); expect(s.snapshot().error).toBe(true);
});
it("keeps errors sticky across later dirty signals until the same failed write is verified", () => {
  const raw = memory(), s = createEditorSession(raw,"a");
  raw.setItem.mockImplementationOnce(() => {throw Error("quota");});
  expect(() => s.storage.setItem("liftlog-active-run","sets")).toThrow("quota");
  s.markPending("liftlog-active-run"); expect(s.snapshot().error).toBe(true);
  s.storage.setItem("liftlog-sync-status","unrelated-success"); expect(s.snapshot().error).toBe(true);
  expect(() => s.prepareRelease()).toThrow("Not saved");
  s.storage.setItem("liftlog-active-run","sets"); expect(s.snapshot().error).toBe(false); expect(() => s.prepareRelease()).not.toThrow();
});
it("recognizes only its own exact uncertain write after read-back failure", () => {
  const raw = memory(), s = createEditorSession(raw,"a"), get = raw.getItem; let fail = false;
  raw.setItem.mockImplementation((k,v) => {raw.values.set(k,v); fail=true;});
  raw.getItem = (k) => {if(fail) {fail=false; throw Error("verification unavailable");} return get(k);};
  expect(() => s.storage.setItem("liftlog-active-run","two sets")).toThrow("unavailable");
  raw.setItem.mockImplementation((k,v) => raw.values.set(k,v));
  s.storage.setItem("liftlog-active-run","two sets"); expect(s.snapshot().error).toBe(false);
});
it("fails closed on an unreadable snapshot instead of permitting default-state overwrites", () => {
  const raw = memory({"liftlog-data":"history"}), s = createEditorSession(raw,"a"), get = raw.getItem;
  raw.getItem = () => {throw Error("unreadable");};
  expect(() => s.storage.getItem("liftlog-data")).toThrow("unreadable"); raw.getItem = get;
  expect(s.snapshot().blocked).toBe(true);
  expect(() => s.storage.setItem("liftlog-data","empty-defaults")).toThrow("could not be read");
  expect(raw.getItem("liftlog-data")).toBe("history");
});
it("flushes pending editor inputs before allowing explicit release", () => {
  const raw = memory(), s = createEditorSession(raw,"a"); s.markPending("liftlog-active-run");
  const off = s.registerFlush(() => s.storage.setItem("liftlog-active-run","flushed input and sets"));
  s.prepareRelease(); expect(raw.getItem("liftlog-active-run")).toBe("flushed input and sets"); off(); s.revoke();
  expect(() => s.storage.setItem("liftlog-active-run","late-unmount-flush")).toThrow("read-only");
});
it("refuses transfer while a tracked request is in flight", async () => {
  const s = createEditorSession(memory(),"a"); let done;
  const operation = s.task(() => new Promise((resolve) => {done=resolve;}));
  expect(() => s.prepareRelease()).toThrow("pending operations");
  done(); await operation; expect(() => s.prepareRelease()).not.toThrow();
});
it("allows a settled response after pagehide but never authorizes its stale write", async () => {
  const raw = memory(), s = createEditorSession(raw,"a"); let done;
  const operation = s.task(() => new Promise((resolve) => {done=resolve;}));
  s.revoke(); done("remote"); const response = await operation;
  expect(() => s.storage.setItem("liftlog-data",response)).toThrow("read-only"); expect(raw.setItem).not.toHaveBeenCalled();
});
it("captures latest external data as well as earlier conflicts in recovery exports", () => {
  const raw = memory({"liftlog-data":"base"}), s = createEditorSession(raw,"a");
  raw.values.set("liftlog-data","external-1"); expect(() => s.storage.setItem("liftlog-data","mine")).toThrow();
  raw.values.set("liftlog-data","external-2");
  expect(s.recovery().observed).toContainEqual(["liftlog-data","external-2"]);
  expect(s.recovery().conflicts[0].observed).toBe("external-1");
});
it("retains unresolved conflict records across reload without permitting startup writes", () => {
  const raw=memory({"liftlog-data":"base"}), first=createEditorSession(raw,"first");
  raw.values.set("liftlog-data","external"); expect(() => first.storage.setItem("liftlog-data","confirmed")).toThrow(); first.revoke();
  const after=createEditorSession(raw,"next");
  expect(after.snapshot().blocked).toBe(true); expect(after.recovery().conflicts[0].attempted).toBe("confirmed");
  expect(() => after.storage.setItem("liftlog-data","defaults")).toThrow(); expect(raw.getItem("liftlog-data")).toBe("external");
});
it("retains attempted confirmed data when a revision precheck cannot read storage", () => {
  const raw=memory(), s=createEditorSession(raw,"a"); raw.getItem=()=>{throw Error("unavailable");};
  expect(()=>s.storage.setItem("liftlog-active-run","confirmed work")).toThrow("unavailable");
  expect(s.recovery().attempted).toContainEqual(["liftlog-active-run","confirmed work"]);
});
it("does not duplicate or export auth tokens in recovery records", () => {
  const raw=memory({"sb-auth":"old-private-token"}), s=createEditorSession(raw,"a");
  raw.values.set("sb-auth","new-private-token"); expect(()=>s.storage.setItem("sb-auth","attempted-private-token")).toThrow();
  expect(JSON.stringify(s.recovery())).not.toMatch(/private-token/);
  for(const [key,value] of raw.values) if(key.startsWith("brk-recovery:")) expect(value).not.toMatch(/private-token/);
});
it("storage notifications detect uncoordinated external edits but never grant ownership", () => {
  const raw=memory({"liftlog-data":"original"}), s=createEditorSession(raw,"a");
  raw.values.set("liftlog-data","external"); s.observe("liftlog-data");
  expect(s.snapshot().blocked).toBe(true); expect(s.recovery().conflicts[0]).toMatchObject({base:"original",observed:"external"});
  expect(()=>s.storage.setItem("liftlog-data","overwrite")).toThrow();
  s.revoke(); s.observe("liftlog-data"); expect(s.isOwner()).toBe(false);
});
