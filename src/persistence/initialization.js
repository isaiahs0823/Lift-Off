import { sanitizeActiveRun } from "../utils/activeRun.js";

const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const arrayKeys = ["logs","cardioLogs","workoutSessions","customPlans","customPrograms","customExercises","photos","completedPrograms","recoverySessions","goals","bodyweightLogs","readinessLogs","coachHistory","scheduleLog","recoveryLogs","coachMemories","commitments","coachConversations","foodLogs","savedFoods","savedMeals","favoriteFoods","nutritionCheckIns","nutritionCoachAdjustments","programSwapLog","equipmentProfiles","athleteRatingSnapshots"];
const objectKeys = ["settings","exerciseNotes","specialtyInterest","currentProgram","pendingFrequencyReview","programDayOverride","weeklySchedule","reminderSettings","athleteProfile","coachAccess","coachOnboarding","nutritionProfile","nutritionTargets","nutritionMealPlan","developmentPriorities"];
function requireValue(ok, path) { if (!ok) throw new Error(`Saved data is invalid at ${path}.`); }
function parse(raw, key) {
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error(`Saved data is not valid JSON at ${key}.`); }
  requireValue(object(value), key);
  return value;
}
function sets(value, path) {
  requireValue(Array.isArray(value),path);
  value.forEach((set,i) => {
    requireValue(object(set),`${path}[${i}]`);
    requireValue(typeof set.reps === "number" && Number.isFinite(set.reps) && set.reps > 0,`${path}[${i}].reps`);
    requireValue(typeof set.weight === "number" && Number.isFinite(set.weight) && set.weight >= 0,`${path}[${i}].weight`);
    if (set.drops !== undefined) sets(set.drops,`${path}[${i}].drops`);
  });
}
function entry(value,path,logId=false) {
  requireValue(object(value),path);
  if (logId) requireValue(typeof value.id === "string" && !!value.id,`${path}.id`);
  requireValue(typeof value.exId === "string" && !!value.exId,`${path}.exId`);
  sets(value.sets,`${path}.sets`);
}
function slots(value,path) {
  requireValue(Array.isArray(value),path);
  value.forEach((slot,i) => requireValue(object(slot) && typeof slot.exId === "string" && !!slot.exId,`${path}[${i}]`));
}
export function validateCanonicalData(data) {
  requireValue(object(data),"liftlog-data");
  // The canonical store is the data object, never a backup envelope or a future schema.
  requireValue(!("schemaVersion" in data) && !("data" in data),"canonical schema");
  for (const key of arrayKeys) if (key in data) {
    requireValue(Array.isArray(data[key]),key);
    data[key].forEach((row,i) => requireValue(object(row),`${key}[${i}]`));
  }
  for (const key of objectKeys) if (key in data && data[key] !== null) requireValue(object(data[key]),key);
  if ("hasSeenOnboarding" in data) requireValue(typeof data.hasSeenOnboarding === "boolean","hasSeenOnboarding");
  (data.logs || []).forEach((row,i) => entry(row,`logs[${i}]`,true));
  (data.workoutSessions || []).forEach((row,i) => {
    requireValue(typeof row.id === "string" && !!row.id,`workoutSessions[${i}].id`);
    if (row.entries !== undefined) { requireValue(Array.isArray(row.entries),`workoutSessions[${i}].entries`); row.entries.forEach((e,j) => entry(e,`workoutSessions[${i}].entries[${j}]`)); }
  });
  for (const key of ["customPlans","customPrograms"]) (data[key] || []).forEach((row,i) => {
    requireValue(typeof row.id === "string" && !!row.id,`${key}[${i}].id`);
    requireValue(row.name == null || typeof row.name === "string",`${key}[${i}].name`);
    if (key === "customPlans") slots(row.exercises,`${key}[${i}].exercises`);
    else {
      requireValue(Array.isArray(row.days),`${key}[${i}].days`);
      row.days.forEach((day,j) => {
        requireValue(object(day),`${key}[${i}].days[${j}]`);
        if (day.type !== "recovery") slots(day.exercises,`${key}[${i}].days[${j}].exercises`);
      });
    }
  });
  return data;
}
const renamed = Object.assign(Object.create(null),{Superman:"Titan",Batman:"Reaper",Punisher:"Berserker",Thor:"Ragnar"});
export function migrateCanonicalData(data) {
  const next = {...data};
  if (data.customPlans) next.customPlans = data.customPlans.map((row) => {
    let name = row.name?.trim() ? row.name : "Custom workout";
    const separator = name.indexOf(" — ");
    if (separator !== -1 && renamed[name.slice(0,separator)]) name = renamed[name.slice(0,separator)] + name.slice(separator);
    return name === row.name ? row : {...row,name};
  });
  if (data.customPrograms) next.customPrograms = data.customPrograms.map((row) => {
    const name = renamed[row.name] || (row.name?.trim() ? row.name : "Custom program");
    return name === row.name ? row : {...row,name};
  });
  if (data.currentProgram && renamed[data.currentProgram.programName]) next.currentProgram = {...data.currentProgram,programName:renamed[data.currentProgram.programName]};
  if (data.coachOnboarding && Object.hasOwn(data.coachOnboarding,"migrationNoticeShown")) {
    const {migrationNoticeShown,...rest}=data.coachOnboarding;
    next.coachOnboarding={...rest,specialtySelected:false,specialty:null,confirmedAt:null};
  }
  if (!data.hasSeenOnboarding && ((data.logs || []).length || (data.cardioLogs || []).length || data.currentProgram)) next.hasSeenOnboarding=true;
  return next;
}
function validateActive(run) {
  if (run === null) return;
  requireValue(run.version === undefined || run.version === 1,"active workout version");
  if (run.id !== undefined) requireValue(typeof run.id === "string" && !!run.id,"active workout id");
  slots(run.exercises,"active exercises");
  run.exercises.forEach((slot,i) => {
    if (slot.workoutSlotId !== undefined) requireValue(typeof slot.workoutSlotId === "string" && !!slot.workoutSlotId,`active exercises[${i}].workoutSlotId`);
  });
  if (run.sessionEntries !== undefined) {
    requireValue(Array.isArray(run.sessionEntries),"active sessionEntries");
    run.sessionEntries.forEach((se,i) => {
      requireValue(object(se) && Number.isInteger(se.index) && se.index >= 0 && se.index < run.exercises.length,`sessionEntries[${i}]`);
      entry(se.entry,`sessionEntries[${i}].entry`,true);
    });
  }
  for (const key of ["draftByIndex","swaps"]) if (run[key] !== undefined) requireValue(object(run[key]),`active ${key}`);
  Object.entries(run.draftByIndex || {}).forEach(([index,draft]) => {
    requireValue(/^\d+$/.test(index) && Number(index) < run.exercises.length && object(draft),"active draft slot");
    if (draft.confirmedSets !== undefined) sets(draft.confirmedSets,`draft[${index}].confirmedSets`);
  });
}
export function prepareInitialization({canonical,active}, migrate=migrateCanonicalData) {
  const parsed=parse(canonical,"liftlog-data"), parsedActive=parse(active,"liftlog-active-run");
  validateActive(parsedActive);
  let data=parsed;
  if (data !== null) {
    validateCanonicalData(data);
    data=migrate(JSON.parse(JSON.stringify(data)));
    validateCanonicalData(data);
    const permitted = new Set(["customPlans","customPrograms","currentProgram","coachOnboarding","hasSeenOnboarding"]);
    for (const key of new Set([...Object.keys(parsed),...Object.keys(data)])) if (!permitted.has(key)) {
      requireValue(JSON.stringify(data[key]) === JSON.stringify(parsed[key]),`migration preservation of ${key}`);
    }
    const assignment = value => value ? {...value,programName:undefined} : value;
    requireValue(JSON.stringify(assignment(data.currentProgram)) === JSON.stringify(assignment(parsed.currentProgram)),"migration program assignment");
    // These migrations rename templates and correct onboarding metadata only. They
    // have no authority to remove or rewrite performed work, photos, or other history.
    for (const key of arrayKeys.filter((key) => !["customPlans","customPrograms"].includes(key))) {
      requireValue(JSON.stringify(data[key]) === JSON.stringify(parsed[key]),`migration preservation of ${key}`);
    }
    for (const key of ["customPlans","customPrograms"]) {
      const withoutNames=(rows) => rows?.map(({name,...rest}) => rest);
      requireValue(JSON.stringify(withoutNames(data[key])) === JSON.stringify(withoutNames(parsed[key])),`migration identities in ${key}`);
    }
  }
  const normalized=parsedActive === null ? null : sanitizeActiveRun(parsedActive);
  requireValue(parsedActive === null || normalized !== null,"active workout normalization");
  const serialized=data === null ? null : JSON.stringify(data);
  if (serialized !== null) validateCanonicalData(JSON.parse(serialized));
  return {data,active:normalized,serialized,isNew:canonical === null && active === null};
}
