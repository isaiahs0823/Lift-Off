// Build a static-only, Supabase-disabled review artifact from a clean exact commit.
// No project linking, account configuration, domain aliasing or deployment occurs here.
import {execFileSync,spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,readdirSync,readFileSync} from "node:fs";
import {join,resolve,relative} from "node:path";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const git=(...args)=>execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();
if(git("status","--porcelain"))throw new Error("Preview packaging requires a clean, committed checkout.");
const commit=git("rev-parse","HEAD"),branch=git("branch","--show-current");
// Guards against accidentally packaging a "preview" from the live production or dev checkout —
// not a single hardcoded branch name. Was pinned to the one branch active when this script was
// first written (feature/workout-data-integrity); generalized here so later isolated prototype
// branches (e.g. Beginner Experience V2's claude/beginner-onboarding-v2) can reuse this same,
// already-reviewed packaging flow instead of each needing a one-line edit to re-authorize itself.
const disallowedBranches=["claude/new-session-4e2i2p","claude/branch-sync-verify-u5e8fh","main","master"];
if(disallowedBranches.includes(branch))throw new Error(`Refusing to package a preview from ${branch} — check out an isolated feature branch first.`);
const output=mkdtempSync(join(tmpdir(),"brk-fit-local-preview-")),site=join(output,"site");mkdirSync(site);
const build=spawnSync("npm",["run","build","--","--outDir",site],{cwd:root,stdio:"inherit",env:{...process.env,VITE_LOCAL_ONLY_PREVIEW:"true",VITE_SUPABASE_URL:"",VITE_SUPABASE_ANON_KEY:""}});
if(build.status!==0)process.exit(build.status||1);
const info={repository:"isaiahs0823/Lift-Off",branch,commit,localOnly:true,syntheticData:true,supabaseEnabled:false,builtAt:new Date().toISOString()};
writeFileSync(join(site,"preview-info.json"),JSON.stringify(info,null,2)+"\n");
writeFileSync(join(site,"vercel.json"),JSON.stringify({version:2,framework:null,cleanUrls:true},null,2)+"\n");
const files={};
function hash(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())hash(path);else files[relative(site,path)]=createHash("sha256").update(readFileSync(path)).digest("hex");}}
hash(site);
writeFileSync(join(output,"artifact-manifest.json"),JSON.stringify({info,files},null,2)+"\n");
console.log(JSON.stringify({site,manifest:join(output,"artifact-manifest.json"),commit,localOnly:true,supabaseEnabled:false}));
