import { afterEach,it,expect,vi } from "vitest";
import { preparePreviewInitialization } from "../../persistence/localPreview.js";
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
it("seeds only synthetic data on an explicitly enabled, empty preview",()=>{
 const normal=preparePreviewInitialization({canonical:null,active:null},false);expect(normal.data).toBeNull();
 const preview=preparePreviewInitialization({canonical:null,active:null},true);
 expect(preview.data.customPrograms[0].id).toBe("preview-full-body");
 expect(preview.data.logs.map(l=>l.id)).toEqual(["preview-bench-log"]);
 expect(preview.data.workoutSessions[0].totalVolume).toBe(840);
});
it("never replaces existing local test history or ignores malformed data",()=>{
 const existing={hasSeenOnboarding:true,logs:[],workoutSessions:[],customPrograms:[]};
 expect(preparePreviewInitialization({canonical:JSON.stringify(existing),active:null},true).data).toEqual(existing);
 expect(()=>preparePreviewInitialization({canonical:"{bad",active:null},true)).toThrow();
});
it("does not seed over an orphaned active workout",()=>{
 const active={version:1,id:"keep",exercises:[],sessionEntries:[]};
 const result=preparePreviewInitialization({canonical:null,active:JSON.stringify(active)},true);
 expect(result.data).toBeNull();expect(result.active.id).toBe("keep");
});
it("disables the Supabase client even if shared build credentials are present",async()=>{
 vi.stubEnv("VITE_LOCAL_ONLY_PREVIEW","true");
 vi.stubEnv("VITE_SUPABASE_URL","https://synthetic-only.invalid");
 vi.stubEnv("VITE_SUPABASE_ANON_KEY","synthetic-not-a-real-key");
 vi.resetModules();
 const client=await import("../../lib/supabaseClient.js");
 expect(client.supabaseEnabled).toBe(false);expect(client.supabase).toBeNull();
});
