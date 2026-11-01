import { it, expect, vi } from "vitest";
import { createEditorSession } from "../../persistence/editorSession.js";
import { prepareInitialization } from "../../persistence/initialization.js";
import { parseBackupFile } from "../backup.js";
const log={id:"old-log",exId:"bench",date:"2026-01-01",sets:[{weight:150,reps:8}],targetReps:8};
const history=()=>({hasSeenOnboarding:true,logs:[structuredClone(log)],workoutSessions:[{id:"old-session",entries:[structuredClone(log)],workingSets:1,totalVolume:1200}],customPlans:[],customPrograms:[]});
function memory(data,active=null) {
  const values=new Map(); if(data!==null) values.set("liftlog-data",typeof data==="string"?data:JSON.stringify(data));
  if(active!==null) values.set("liftlog-active-run",typeof active==="string"?active:JSON.stringify(active));
  return {values,get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:vi.fn((k,v)=>values.set(k,v)),removeItem:vi.fn(k=>values.delete(k))};
}
const legacy=()=>({...history(),customPlans:[{id:"plan",exercises:[]}],customPrograms:[{id:"program",days:[{label:"A",exercises:[{exId:"bench",sets:3}]}]}]});
it("does not grant writes, removals, or hydration callbacks before successful initialization",async()=>{
 const raw=memory(history()),s=createEditorSession(raw,"a"),callback=vi.fn();
 expect(s.isOwner()).toBe(false); expect(()=>s.storage.setItem("liftlog-data","defaults")).toThrow("Initialization");
 expect(()=>s.storage.removeItem("liftlog-active-run")).toThrow("Initialization");
 await expect(s.task(callback)).rejects.toThrow("Initialization"); expect(callback).not.toHaveBeenCalled(); expect(raw.setItem).not.toHaveBeenCalled();
});
it("distinguishes genuinely absent storage without writing canonical defaults",()=>{
 const raw=memory(null),s=createEditorSession(raw,"a"); expect(s.initialize(prepareInitialization)).toBe(true);
 expect(s.initializedState()).toMatchObject({isNew:true,data:null,active:null}); expect(raw.setItem).not.toHaveBeenCalled();
});
it("loads valid history byte-for-byte without an unnecessary migration write",()=>{
 const raw=memory(history()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(true); expect(s.initializedState().data).toEqual(history());
 expect(raw.getItem("liftlog-data")).toBe(original); expect(raw.setItem).not.toHaveBeenCalled();
});
it.each([undefined,null,""])("safely supplies missing optional plan/program names (%s) without changing historical identifiers",name=>{
 const data=legacy(); data.customPlans[0].name=name;data.customPrograms[0].name=name;
 const raw=memory(data),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(true);
 const loaded=s.initializedState().data;
 expect(loaded.customPlans[0]).toMatchObject({id:"plan",name:"Custom workout",exercises:[]});
 expect(loaded.customPrograms[0]).toMatchObject({id:"program",name:"Custom program"});
 expect(loaded.logs).toEqual(data.logs);expect(loaded.workoutSessions).toEqual(data.workoutSessions);
 expect(JSON.parse(raw.getItem("brk-initialization-original:a")).canonical).toBe(original);
 expect(JSON.parse(raw.getItem("brk-initialization-stage:a"))).toEqual(loaded);
 const after=createEditorSession(raw,"b");expect(after.initialize(prepareInitialization)).toBe(true);
 expect(after.initializedState().data).toEqual(loaded);
});
it.each(["{bad","","null","[]","42"])("fails closed on existing invalid canonical bytes: %s",bad=>{
 const raw=memory(bad),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(false);expect(s.snapshot()).toMatchObject({initialization:"failed",blocked:true});
 expect(()=>s.storage.setItem("liftlog-data","{}")).toThrow("Initialization");expect(s.recovery().original.canonical).toBe(bad);
 expect(raw.getItem("liftlog-data")).toBe(bad);expect(raw.setItem).not.toHaveBeenCalled();
});
it("accepts a genuinely failed rep attempt — a logged set with zero completed reps is real data, not corruption",()=>{
 const failedSet={...log,sets:[{weight:150,reps:0}]};
 const raw=memory({...history(),logs:[failedSet]}),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(true);
 expect(s.initializedState().data.logs[0].sets[0]).toEqual({weight:150,reps:0});
 expect(raw.getItem("liftlog-data")).toBe(original);
});
it.each([
 {logs:{}},{customPrograms:[null]},{settings:"invalid"},
 {customPrograms:[{id:"p",days:{}}]},
 {logs:[{...log,sets:[{weight:"oops",reps:8}]}]},
 {logs:[{...log,sets:[{weight:150,reps:-1}]}]},
 {customPlans:[{id:"p",exercises:"invalid"}]},
])("rejects malformed containers/records without losing valid surrounding history: %j",patch=>{
 const raw=memory({...history(),...patch}),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(false);expect(raw.getItem("liftlog-data")).toBe(original);expect(raw.setItem).not.toHaveBeenCalled();
});
it("does not expose partial in-place migration progress when migration throws halfway",()=>{
 const raw=memory(legacy()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 const migrate=data=>{data.customPlans[0].name="Partly migrated";throw Error("Synthetic migration exception");};
 expect(s.initialize(input=>prepareInitialization(input,migrate))).toBe(false);
 expect(raw.getItem("liftlog-data")).toBe(original);expect(raw.setItem).not.toHaveBeenCalled();
});
it("rejects a migration that silently removes recorded workout history",()=>{
 const raw=memory(history()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(input=>prepareInitialization(input,data=>{data.logs=[];return data;}))).toBe(false);
 expect(raw.getItem("liftlog-data")).toBe(original);expect(raw.setItem).not.toHaveBeenCalled();
});
it("cannot use initialization to delete existing canonical data",()=>{
 const raw=memory(history()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(()=>({serialized:null,data:null,active:null}))).toBe(false);
 expect(raw.getItem("liftlog-data")).toBe(original);expect(raw.removeItem).not.toHaveBeenCalled();
});
it("fails closed when an active checkpoint cannot be parsed rather than starting a fresh workout",()=>{
 const raw=memory(history(),"{broken checkpoint"),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(false);expect(raw.getItem("liftlog-data")).toBe(original);expect(raw.getItem("liftlog-active-run")).toBe("{broken checkpoint");
});
it("preserves a valid orphaned active checkpoint instead of treating it as a new installation",()=>{
 const active={version:1,id:"run",exercises:[{exId:"bench",workoutSlotId:"slot"}],draftByIndex:{0:{confirmedSets:log.sets}},sessionEntries:[]};
 const raw=memory(null,active),s=createEditorSession(raw,"a");expect(s.initialize(prepareInitialization)).toBe(true);
 expect(s.initializedState()).toMatchObject({isNew:false,active:{id:"run",draftByIndex:active.draftByIndex}});expect(raw.setItem).not.toHaveBeenCalled();
});
for(const phase of ["original","stage","canonical"]) it(`preserves the original when the ${phase} migration write fails`,()=>{
 const raw=memory(legacy()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 raw.setItem.mockImplementation((key,value)=>{if((phase==="canonical"&&key==="liftlog-data")||key.startsWith(`brk-initialization-${phase}:`))throw Error("quota");raw.values.set(key,value);});
 expect(s.initialize(prepareInitialization)).toBe(false);expect(raw.getItem("liftlog-data")).toBe(original);expect(s.recovery().original.canonical).toBe(original);
});
it("refuses canonical replacement if the staged migration write is silently dropped",()=>{
 const raw=memory(legacy()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
 raw.setItem.mockImplementation((key,value)=>{if(!key.startsWith("brk-initialization-stage:"))raw.values.set(key,value);});
 expect(s.initialize(prepareInitialization)).toBe(false);expect(raw.getItem("liftlog-data")).toBe(original);
});
it("keeps the original recoverable when canonical commits but read-back fails",()=>{
 const raw=memory(legacy()),original=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a"),get=raw.getItem;let fail=false;
 raw.setItem.mockImplementation((key,value)=>{raw.values.set(key,value);if(key==="liftlog-data")fail=true;});
 raw.getItem=key=>{if(fail&&key==="liftlog-data"){fail=false;throw Error("verification failed");}return get(key);};
 expect(s.initialize(prepareInitialization)).toBe(false);expect(s.recovery().original.canonical).toBe(original);
 expect(JSON.parse(raw.getItem("brk-initialization-original:a")).canonical).toBe(original);
 expect(JSON.parse(raw.getItem("liftlog-data")).logs).toEqual(history().logs);
 const reloaded=createEditorSession(raw,"b");expect(reloaded.initialize(prepareInitialization)).toBe(true);
});
it("does not call late hydration or export SDK credentials after initialization fails",async()=>{
 const raw=memory("{bad");raw.values.set("sb-synthetic-token","private-credential");const s=createEditorSession(raw,"a"),hydrate=vi.fn();
 expect(s.initialize(prepareInitialization)).toBe(false);await expect(s.task(hydrate)).rejects.toThrow();expect(hydrate).not.toHaveBeenCalled();
 expect(JSON.stringify(s.recovery())).not.toContain("private-credential");expect(s.recovery().original.canonical).toBe("{bad");
});
it("rejects invalid backup records before import and safely migrates optional legacy names",()=>{
 expect(parseBackupFile(JSON.stringify({data:{logs:{}}})).ok).toBe(false);
 const result=parseBackupFile(JSON.stringify({data:legacy()}));expect(result.ok).toBe(true);
 expect(result.data.customPrograms[0].name).toBe("Custom program");expect(result.data.logs).toEqual(history().logs);
});
it("preserves optional program names that coincide with Object prototype keys",()=>{
 const data=legacy();data.customPrograms[0].name="constructor";data.customPlans[0].name="__proto__";
 const result=prepareInitialization({canonical:JSON.stringify(data),active:null});
 expect(result.data.customPrograms[0].name).toBe("constructor");expect(result.data.customPlans[0].name).toBe("__proto__");
});
it("does not replace an existing malformed active identifier with a generated identity",()=>{
 const active={id:42,version:1,exercises:[{exId:"bench"}],sessionEntries:[]};
 const raw=memory(history(),active),original=raw.getItem("liftlog-active-run"),s=createEditorSession(raw,"a");
 expect(s.initialize(prepareInitialization)).toBe(false);expect(raw.getItem("liftlog-active-run")).toBe(original);
});
it("does not authorize a migration to change program assignment or profile state",()=>{
 const data={...history(),currentProgram:{programId:"p",dayIndex:2,startDate:"2026-01-01"},athleteProfile:{name:"Synthetic"}};
 for(const mutate of [draft=>{draft.currentProgram.dayIndex=0;},draft=>{draft.athleteProfile=null;}]) {
  const raw=memory(data),before=raw.getItem("liftlog-data"),s=createEditorSession(raw,"a");
  expect(s.initialize(input=>prepareInitialization(input,draft=>{mutate(draft);return draft;}))).toBe(false);
  expect(raw.getItem("liftlog-data")).toBe(before);
 }
});
