import { prepareInitialization } from "./initialization.js";

// Explicit, build-time isolation: this flag overrides even inherited Supabase settings.
export const LOCAL_ONLY_PREVIEW = import.meta.env.VITE_LOCAL_ONLY_PREVIEW === "true";
export function syntheticPreviewData() {
  const sets=[{weight:50,reps:8},{weight:55,reps:8}];
  return {
    hasSeenOnboarding:true,
    customPrograms:[{id:"preview-full-body",name:"Preview Full Body",isCustom:true,days:[
      {id:"preview-day-a",label:"Day A",exercises:[{exId:"bench",sets:3,reps:"8"},{exId:"squat",sets:3,reps:"8"}]},
      {id:"preview-day-b",label:"Day B",exercises:[{exId:"squat",sets:3,reps:"8"},{exId:"bench",sets:3,reps:"8"}]},
    ]}],
    currentProgram:{programId:"preview-full-body",programName:"Preview Full Body",source:"custom",dayIndex:0,totalDays:2,startDate:new Date().toISOString()},
    logs:[{id:"preview-bench-log",exId:"bench",date:"2026-10-01T12:00:00Z",sets,targetReps:8}],
    workoutSessions:[{id:"preview-workout",planName:"Synthetic sample workout",startedAt:"2026-10-01T12:00:00Z",finishedAt:"2026-10-01T12:20:00Z",entries:[{exId:"bench",sets,targetReps:8}],workingSets:2,totalReps:16,totalVolume:840,exerciseCount:1,prs:[],mainMuscles:["Chest"]}],
    exerciseNotes:{bench:{general:"Synthetic preview: use test weights only."}},
  };
}
export function preparePreviewInitialization(input, enabled=LOCAL_ONLY_PREVIEW) {
  if(enabled && input.canonical===null && input.active===null) {
    return prepareInitialization({canonical:JSON.stringify(syntheticPreviewData()),active:null});
  }
  return prepareInitialization(input);
}
