import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BRK_PLAYWRIGHT_MODULE||'playwright');
let browser;const origin=process.env.BRK_ACCOUNT_ORIGIN||'http://127.0.0.1:4174';
before(async()=>{browser=await chromium.launch({executablePath:process.env.BRK_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});});
after(async()=>browser?.close());
const ownerKey='brk-dataset-ownership:v1';
const history={hasSeenOnboarding:true,logs:[{id:'synthetic-log',exId:'bench',date:'2026-01-01',sets:[{weight:100,reps:8}]}],workoutSessions:[{id:'synthetic-session',entries:[],planName:'PRIVATE A WORKOUT'}],photos:[],settings:{effortTracking:'RIR'},customPrograms:[]};
async function fixture(t,{owner={version:1,datasetId:'synthetic-dataset',kind:'account',accountId:'A'},account='A',data=history,active=null}={}){
 const context=await browser.newContext();t.after(()=>context.close());
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await context.addInitScript(({ownerKey,owner,account,data,active})=>{
  if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','true');
  if(data)localStorage.setItem('liftlog-data',JSON.stringify(data));
  if(active)localStorage.setItem('liftlog-active-run',JSON.stringify(active));
  if(owner)localStorage.setItem(ownerKey,JSON.stringify(owner));
  localStorage.setItem('sb-other-auth-token','SYNTHETIC-SECRET-NOT-EXPORTED');
  if(account)localStorage.setItem('sb-synthetic-auth-token',JSON.stringify({user:{id:account,email:`${account}@synthetic.invalid`}}));
 },{ownerKey,owner,account,data,active});
 const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[],"No unhandled application errors"));await page.goto(origin);await page.waitForFunction(()=>!!window.__accountFixture);return page;
}
const raw=p=>p.evaluate(()=>({data:localStorage.getItem('liftlog-data'),active:localStorage.getItem('liftlog-active-run')}));
test('A sign-out then B sign-in never admits or uploads the previous athlete dataset',async t=>{
 const p=await fixture(t);await p.getByRole('button',{name:'Train',exact:true}).last().waitFor();
 await p.evaluate(()=>window.__accountFixture.signOut());
 await p.evaluate(()=>window.__accountFixture.signIn('B'));
 await p.waitForTimeout(1900);
 const writes=await p.evaluate(()=>window.__accountFixture.requests.filter(r=>r.kind==='upsert').flatMap(r=>Array.isArray(r.value)?r.value:[r.value]).filter(r=>r.user_id==='B'));
 assert.equal(writes.length,0,'Account B must not receive Account A records');
 await p.getByRole('heading',{name:'Account data protected'}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
});
const anonymous={version:1,datasetId:'anonymous-synthetic',kind:'anonymous',accountId:null};
async function editor(p){await p.getByRole('button',{name:'Train',exact:true}).last().waitFor();}
async function signIn(p,id){await p.evaluate(id=>window.__accountFixture.signIn(id),id);}
async function signOut(p){await p.evaluate(()=>window.__accountFixture.signOut());}
async function writes(p){return p.evaluate(()=>window.__accountFixture.requests.filter(r=>['upsert','upload'].includes(r.kind)));}
test('anonymous history requires explicit adoption and keeps original sets exactly once',async t=>{
 const p=await fixture(t,{owner:anonymous,account:null});await editor(p);
 await signIn(p,'A');await p.getByRole('heading',{name:'Connect your device data?'}).waitFor();
 assert.equal((await writes(p)).length,0);assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
 await p.getByRole('button',{name:'Associate this device data with my account',exact:true}).click();await editor(p);
 await p.waitForFunction(()=>window.__accountFixture.requests.some(r=>r.kind==='upsert'&&r.table==='exercise_logs'));
 const result=await p.evaluate(()=>({owner:JSON.parse(localStorage.getItem('brk-dataset-ownership:v1')),data:JSON.parse(localStorage.getItem('liftlog-data'))}));
 assert.equal(result.owner.accountId,'A');assert.equal(result.data.logs.length,1);assert.deepEqual(result.data.logs[0].sets,history.logs[0].sets);
});
test('declined anonymous adoption preserves local history and resumes local-only editing',async t=>{
 const p=await fixture(t,{owner:anonymous,account:null});await editor(p);const before=JSON.parse((await raw(p)).data);
 await signIn(p,'B');await p.getByRole('button',{name:'Keep data anonymous and sign out'}).click();await editor(p);
 const after=JSON.parse((await raw(p)).data);assert.deepEqual(after.logs,before.logs);assert.deepEqual(after.workoutSessions,before.workoutSessions);assert.equal((await writes(p)).length,0);
});
test('A returns after signing out and B mismatch without losing history or exposing it to B',async t=>{
 const p=await fixture(t);await editor(p);const before=JSON.parse((await raw(p)).data);
 await signOut(p);await p.getByRole('heading',{name:'Account data protected'}).waitFor();await signIn(p,'B');
 assert.equal(await p.getByText('PRIVATE A WORKOUT',{exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:'Export preserved device data for review'}).count(),0);
 await signOut(p);await signIn(p,'A');await editor(p);
 const after=JSON.parse((await raw(p)).data);assert.deepEqual(after.logs,before.logs);assert.deepEqual(after.workoutSessions,before.workoutSessions);
});
test('legacy missing owner fails closed and never offers anonymous adoption',async t=>{
 const p=await fixture(t,{owner:null,account:'B'});await p.getByRole('heading',{name:'Saved data needs ownership review'}).waitFor();
 assert.equal((await writes(p)).length,0);assert.equal(await p.getByRole('button',{name:'Associate this device data with my account'}).count(),0);assert.deepEqual(JSON.parse((await raw(p)).data).logs,history.logs);
 await p.reload();await p.getByRole('heading',{name:'Saved data needs ownership review'}).waitFor();assert.equal((await writes(p)).length,0);
});
test('A unfinished workout survives sign-out, B denial, and return with confirmed state intact',async t=>{
 const active={version:1,id:'synthetic-active',planName:'PRIVATE ACTIVE A',index:0,exercises:[{exId:'bench',workoutSlotId:'original-slot'}],draftByIndex:{0:{confirmedSets:[{weight:100,reps:8}],weight:'150',reps:'8',jointNote:{bodyArea:'elbow',severity:'mild',note:'PRIVATE NOTE'}}},sessionEntries:[]};
 const p=await fixture(t,{active});await p.getByRole("button",{name:"Exit",exact:true}).waitFor();await signOut(p);await signIn(p,'B');
 assert.equal(await p.getByText('PRIVATE ACTIVE A',{exact:true}).count(),0);assert.equal(await p.getByText('PRIVATE NOTE',{exact:true}).count(),0);
 await signOut(p);await signIn(p,'A');await p.getByRole('button',{name:'Exit',exact:true}).waitFor();
 const run=JSON.parse((await raw(p)).active);assert.equal(run.id,active.id);const draft=run.draftByIndex[0];assert.deepEqual(draft.confirmedSets,active.draftByIndex[0].confirmedSets);assert.equal(draft.weight,'150');assert.equal(draft.reps,'8');assert.deepEqual(draft.jointNote,active.draftByIndex[0].jointNote);
});
test('late A cloud download after B sign-in cannot hydrate or upload its returned data',async t=>{
 const p=await fixture(t,{account:null});await p.getByRole('heading',{name:'Account data protected'}).waitFor();
 await p.evaluate(()=>{window.__accountFixture.hold=['select:exercise_logs'];window.__accountFixture.remote.exercise_logs=[{id:'late-A',ex_id:'bench',sets:[{weight:999,reps:1}]}];});
 await signIn(p,'A');await editor(p);await p.waitForFunction(()=>window.__accountFixture.requests.some(r=>r.kind==='select'&&r.table==='exercise_logs'));
 await signOut(p);await signIn(p,'B');await p.evaluate(()=>{for(const r of window.__accountFixture.requests)window.__accountFixture.resolve(r.id);});await p.waitForTimeout(250);
 assert.equal(JSON.parse((await raw(p)).data).logs.some(l=>l.id==='late-A'),false);assert.equal((await writes(p)).length,0);
});
test('scheduled A retry cannot execute after B signs in',async t=>{
 const p=await fixture(t,{account:null});await p.getByRole('heading',{name:'Account data protected'}).waitFor();await p.evaluate(()=>{window.__accountFixture.fail=['upsert:exercise_logs'];});
 await signIn(p,'A');await editor(p);await p.waitForFunction(()=>window.__accountFixture.requests.some(r=>r.kind==='upsert'&&r.table==='workout_profile'));
 await p.waitForTimeout(100);const count=(await writes(p)).length;await signOut(p);await signIn(p,'B');await p.waitForTimeout(5500);assert.equal((await writes(p)).length,count);
});
test('A photo upload completion after sign-out cannot mark a photo synced or start its metadata write',async t=>{
 const p=await fixture(t,{account:null,data:{...history,photos:[{id:'private-photo',dataUrl:'data:image/jpeg;base64,AA==',date:'2026-01-01'}]}});
 await p.getByRole('heading',{name:'Account data protected'}).waitFor();await p.evaluate(()=>{window.__accountFixture.hold=['upload:progress-photos'];});await signIn(p,'A');await editor(p);
 await p.waitForFunction(()=>window.__accountFixture.requests.some(r=>r.kind==='upload'));await signOut(p);await signIn(p,'B');await p.evaluate(()=>{for(const r of window.__accountFixture.requests)window.__accountFixture.resolve(r.id);});await p.waitForTimeout(250);
 assert.equal((await writes(p)).some(r=>r.table==='photos'),false);assert.notEqual(JSON.parse((await raw(p)).data).photos[0].syncedToCloud,true);
});
test('reload with account B preserves A ownership and keeps athlete UI closed',async t=>{
 const p=await fixture(t);await editor(p);await signOut(p);await signIn(p,'B');await p.reload();await p.getByRole('heading',{name:'Account data protected'}).waitFor();assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);assert.equal((await writes(p)).length,0);assert.deepEqual(JSON.parse((await raw(p)).data).logs,history.logs);
});
test('failed adoption metadata write blocks all uploads and leaves original athlete bytes untouched',async t=>{
 const p=await fixture(t,{owner:anonymous,account:null});await editor(p);await signIn(p,'A');await p.getByRole('heading',{name:'Connect your device data?'}).waitFor();const before=await raw(p);
 await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='brk-dataset-ownership:v1')throw Error('Synthetic quota');return set.call(this,k,v);};});
 await p.getByRole('button',{name:'Associate this device data with my account',exact:true}).click();await p.getByText('Ownership was not saved.',{exact:false}).waitFor();assert.deepEqual(await raw(p),before);assert.equal((await writes(p)).length,0);assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
});
test('legacy signed-out export preserves original bytes and excludes SDK credentials',async t=>{
 const p=await fixture(t,{owner:null,account:null});await p.getByRole('heading',{name:'Saved data needs ownership review'}).waitFor();
 const download=p.waitForEvent('download');await p.getByRole('button',{name:'Export preserved device data for review'}).click();const item=await download;const {readFile}=await import('node:fs/promises');const text=await readFile(await item.path(),'utf8');const exported=JSON.parse(text);assert.equal(exported.original.canonical,JSON.stringify(history));assert.equal(text.includes('access_token'),false);assert.equal(text.includes('SYNTHETIC-SECRET-NOT-EXPORTED'),false);
});
test('fresh installation acquires anonymous ownership before local tracking begins',async t=>{
 const p=await fixture(t,{owner:null,account:null,data:null});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('brk-dataset-ownership:v1'))?.kind==='anonymous');assert.equal((await writes(p)).length,0);assert.equal(await p.getByRole('heading',{name:'Saved data needs ownership review'}).count(),0);
});
test('late A auth refresh event cannot reopen A while the SDK holds account B',async t=>{
 const p=await fixture(t);await editor(p);await signOut(p);await signIn(p,'B');await p.getByRole('heading',{name:'Account data protected'}).waitFor();
 await p.evaluate(()=>window.__accountFixture.emit('A'));await p.waitForTimeout(100);
 assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
 const last=await p.evaluate(()=>JSON.parse(localStorage.getItem('sb-synthetic-auth-token')).user.id);assert.equal(last,'B');
});
test('an auth change during a rejected active draft write preserves attempted sets for the rightful owner',async t=>{
 const active={version:1,id:'failed-active',planName:'Synthetic active',index:0,exercises:[{exId:'bench',workoutSlotId:'slot'}],draftByIndex:{0:{confirmedSets:[{weight:100,reps:8}],weight:'150',reps:'8'}},sessionEntries:[]};
 const p=await fixture(t,{active});await p.getByRole('button',{name:'Exit',exact:true}).waitFor();
 await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='liftlog-active-run')throw Error('Synthetic draft rejection');return set.call(this,k,v);};});
 await p.getByRole('button',{name:'Add another set',exact:false}).click();
 await p.locator('input[type="number"]').first().fill('150');await p.getByRole('button',{name:'Save set',exact:true}).click();
 await signOut(p);await signIn(p,'B');await p.getByRole('heading',{name:'Unsaved data needs recovery review'}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Export preserved device data for review'}).count(),0);
 await signOut(p);await signIn(p,'A');await p.getByRole('heading',{name:'Unsaved data needs recovery review'}).waitFor();
 const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export preserved device data for review'}).click();const file=await pending;const {readFile}=await import('node:fs/promises');const recovery=JSON.parse(await readFile(await file.path(),'utf8'));
 const checkpoint=JSON.parse(recovery.accountRecovery.attempted.find(([key])=>key==='liftlog-active-run')[1]);assert.deepEqual(checkpoint.draftByIndex[0].confirmedSets.map(s=>s.weight),[100,150]);
 await p.reload();await p.getByRole('heading',{name:'Unsaved data needs recovery review'}).waitFor();assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
});
test('an anonymous athlete completes a workout then explicitly adopts it without duplicates',async t=>{
 const program={id:'synthetic-plan',name:'Synthetic bench',days:[{id:'day',label:'Day A',exercises:[{exId:'bench',sets:3,reps:'8'}]}]};
 const p=await fixture(t,{owner:anonymous,account:null,data:{...history,logs:[],workoutSessions:[],customPrograms:[program],currentProgram:{programId:program.id,programName:program.name,source:'custom',dayIndex:0,totalDays:1}}});
 await editor(p);await p.getByRole('button',{name:'Train',exact:true}).last().click();await p.getByRole('button',{name:'Start',exact:true}).click();
 await p.locator('input[type="number"]').first().fill('100');await p.getByRole('button',{name:'Save set',exact:true}).click();
 await p.getByRole('button',{name:'Finish workout',exact:true}).click();await p.getByRole('button',{name:'Finish Anyway',exact:true}).click();await p.getByRole('button',{name:'Reopen workout',exact:true}).waitFor();
 const before=JSON.parse((await raw(p)).data);await signIn(p,'A');await p.getByRole('button',{name:'Associate this device data with my account',exact:true}).click();
 await p.waitForFunction(()=>window.__accountFixture.requests.some(r=>r.kind==='upsert'&&r.table==='workout_sessions'));
 const after=JSON.parse((await raw(p)).data);assert.deepEqual(after.logs,before.logs);assert.deepEqual(after.workoutSessions,before.workoutSessions);assert.equal(after.logs[0].sets.length,1);assert.equal(after.workoutSessions[0].workingSets,1);
});
for(const source of [null,{version:1,datasetId:'foreign',kind:'account',accountId:'B'}])test(`backup import blocks ${source?'foreign-account':'unowned legacy'} data without changing A history`,async t=>{
 const p=await fixture(t);await editor(p);await p.getByRole('button',{name:'More',exact:true}).last().click();await p.getByRole('button',{name:/Settings/i}).click();
 const before=JSON.parse((await raw(p)).data);
 await p.locator('input[type="file"]').setInputFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,ownership:source,data:{logs:[{id:'foreign-log',exId:'squat',sets:[{weight:999,reps:1}]}]}}))});
 await p.getByText('This backup has a different or unverified owner.',{exact:false}).waitFor();assert.deepEqual(JSON.parse((await raw(p)).data).logs,before.logs);assert.equal(JSON.parse((await raw(p)).data).logs.some(l=>l.id==='foreign-log'),false);
});
test('an auth change still hides athlete data after the broker quarantines an external storage conflict',async t=>{
 const p=await fixture(t);await editor(p);
 await p.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('liftlog-data'));raw.settings={externalWriter:true};localStorage.setItem('liftlog-data',JSON.stringify(raw));window.dispatchEvent(new StorageEvent('storage',{key:'liftlog-data',storageArea:localStorage}));window.__accountFixture.emit('B','SIGNED_IN');});
 await p.getByRole('heading',{name:'Account data protected'}).waitFor();assert.equal(await p.getByRole('button',{name:'Train',exact:true}).count(),0);
});
