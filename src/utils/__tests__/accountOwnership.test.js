import {it,expect,vi} from 'vitest';
import {createEditorSession} from '../../persistence/editorSession.js';
import {prepareInitialization} from '../../persistence/initialization.js';
import {createAccountOwnership,OWNERSHIP_KEY} from '../../persistence/accountOwnership.js';
const history={hasSeenOnboarding:true,logs:[{id:'log',exId:'bench',sets:[{weight:100,reps:8}]}],workoutSessions:[{id:'session',entries:[]}],photos:[{id:'photo',dataUrl:'synthetic'}],foodLogs:[{id:'meal'}],goals:[{id:'goal'}],settings:{effort:'RPE'}};
function fixture({kind='anonymous',accountId=null,data=history,missing=false,active=null}={}){
 const values=new Map();if(data!==null)values.set('liftlog-data',JSON.stringify(data));if(active)values.set('liftlog-active-run',JSON.stringify(active));
 if(!missing)values.set(OWNERSHIP_KEY,JSON.stringify({version:1,datasetId:'dataset',kind,accountId}));
 const raw={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:vi.fn((k,v)=>values.set(k,v)),removeItem:vi.fn(k=>values.delete(k))};
 const session=createEditorSession(raw,'synthetic-editor');expect(session.initialize(prepareInitialization)).toBe(true);
 const owner=createAccountOwnership(session);return {values,raw,session,owner};
}
it('new install receives anonymous provenance before tracking',()=>{const f=fixture({data:null,missing:true});expect(f.owner.snapshot().metadata.kind).toBe('anonymous');f.owner.identity(null);expect(f.session.isOwner()).toBe(true);});
it('legacy history with no owner is preserved and cannot be adopted by next login',()=>{const f=fixture({missing:true});const original=f.values.get('liftlog-data');f.owner.identity('B');expect(f.owner.snapshot().metadata.kind).toBe('review');expect(()=>f.owner.adopt('A',f.owner.snapshot().generation)).toThrow();expect(f.values.get('liftlog-data')).toBe(original);expect(f.session.recovery().redacted).toBe(true);});
it('anonymous sign-in blocks uploads and display until explicit adoption',()=>{const f=fixture();f.owner.identity(null);f.owner.identity('A');expect(f.session.isOwner()).toBe(false);expect(()=>f.session.storage.getItem('liftlog-data')).toThrow();expect(f.owner.lease('A').current()).toBe(false);});
it('explicit adoption changes only metadata and preserves history without duplicate IDs',()=>{const f=fixture();const original=f.values.get('liftlog-data');f.owner.identity('A');f.owner.adopt('A',f.owner.snapshot().generation);expect(f.owner.snapshot().metadata).toMatchObject({kind:'account',accountId:'A'});expect(f.owner.lease('A').current()).toBe(true);expect(f.values.get('liftlog-data')).toBe(original);expect(()=>f.owner.adopt('A',f.owner.snapshot().generation)).toThrow();});
it('declining adoption retains anonymous payload for local-only use',()=>{const f=fixture();const original=f.values.get('liftlog-data');f.owner.identity('A');f.owner.identity(null);expect(f.session.isOwner()).toBe(true);expect(f.owner.snapshot().metadata.kind).toBe('anonymous');expect(f.values.get('liftlog-data')).toBe(original);});
it('known A sign-out and B sign-in denies every athlete key and keeps all data',()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');const original=[...f.values];f.owner.identity(null);f.owner.identity('B');expect(f.session.isOwner()).toBe(false);for(const key of ['liftlog-data','liftlog-active-run','liftlog-sync-status','liftlog-rest-timer']){expect(()=>f.session.storage.setItem(key,'B')).toThrow();expect(()=>f.session.storage.getItem(key)).toThrow();}expect(()=>f.owner.adopt('A',f.owner.snapshot().generation)).toThrow();expect([...f.values]).toEqual(original);});
it('returning A restores the exact durable history and active workout',()=>{const active={exercises:[{exId:'bench'}],draftByIndex:{0:{confirmedSets:[{weight:100,reps:8}]}},sessionEntries:[]};const f=fixture({kind:'account',accountId:'A',active});f.owner.identity('A');const original=[...f.values];f.owner.identity(null);f.owner.identity('B');f.owner.identity('A');expect(f.session.isOwner()).toBe(true);expect([...f.values]).toEqual(original);expect(f.session.initializedState().active.draftByIndex).toEqual(active.draftByIndex);});
it('old callbacks remain fenced even after A leaves and returns',async()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');const scoped=f.session.scoped(),lease=f.owner.lease('A');f.owner.identity(null);f.owner.identity('A');expect(lease.current()).toBe(false);expect(scoped.isOwner()).toBe(false);expect(()=>scoped.storage.setItem('liftlog-data','{}')).toThrow();await expect(scoped.task(()=>{})).rejects.toThrow();});
it('auth storage remains usable while wrong-account athlete access is blocked',()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('B');f.session.storage.setItem('sb-synthetic-auth-token','synthetic');expect(f.session.storage.getItem('sb-synthetic-auth-token')).toBe('synthetic');expect(f.session.recovery().redacted).toBe(true);});
it('signed-out legacy recovery includes original athlete bytes but no SDK credential',()=>{const f=fixture({missing:true});f.owner.identity(null);f.session.storage.setItem('sb-synthetic-auth-token','SECRET-SYNTHETIC');const exported=JSON.stringify(f.session.recovery());expect(exported).toContain('synthetic');expect(exported).not.toContain('SECRET-SYNTHETIC');expect(f.session.recovery().original.canonical).toBe(JSON.stringify(history));});
it('reloaded ownership remains A and cannot be assigned to B',()=>{const f=fixture();f.owner.identity('A');f.owner.adopt('A',f.owner.snapshot().generation);const next=createEditorSession(f.raw,'reload');expect(next.initialize(prepareInitialization)).toBe(true);const owner=createAccountOwnership(next);owner.identity('B');expect(next.isOwner()).toBe(false);owner.identity('A');expect(next.isOwner()).toBe(true);});
it('a rejected ownership transition never enables cloud access or changes athlete data',()=>{const f=fixture();const original=f.values.get('liftlog-data');f.owner.identity('A');f.raw.setItem.mockImplementation(()=>{throw Error('Synthetic quota');});expect(()=>f.owner.adopt('A',f.owner.snapshot().generation)).toThrow();expect(f.owner.lease('A').current()).toBe(false);expect(f.values.get('liftlog-data')).toBe(original);});
it('a silently dropped metadata write never grants ownership',()=>{const f=fixture();f.owner.identity('A');f.raw.setItem.mockImplementation(()=>{});expect(()=>f.owner.adopt('A',f.owner.snapshot().generation)).toThrow();expect(f.session.isOwner()).toBe(false);});
it('unreadable or malformed ownership fails closed without replacing metadata',()=>{const f=fixture();f.values.set(OWNERSHIP_KEY,'{bad');const next=createEditorSession(f.raw,'reload');next.initialize(prepareInitialization);const owner=createAccountOwnership(next);owner.identity('A');expect(next.isOwner()).toBe(false);expect(f.values.get(OWNERSHIP_KEY)).toBe('{bad');});
it('in-flight task completion cannot return to a stale scoped editor',async()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');let release;const promise=f.session.scoped().task(()=>new Promise(resolve=>{release=resolve;}));f.owner.identity('B');release('A result');await expect(promise).rejects.toThrow('generation');});
it('pending local failures block explicit account changes without deleting work',()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');f.session.markPending('liftlog-active-run');expect(()=>f.session.prepareAccountChange()).toThrow('Not saved');expect(f.values.get('liftlog-data')).toBe(JSON.stringify(history));});

it('an adoption click captured for A cannot adopt anonymous data into B',()=>{const f=fixture();f.owner.identity('A');const generation=f.owner.snapshot().generation;f.owner.identity('B');expect(()=>f.owner.adopt('A',generation)).toThrow();expect(f.owner.snapshot().metadata.kind).toBe('anonymous');});
it('external ownership replacement immediately fences writes before its storage event',()=>{const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');f.values.set(OWNERSHIP_KEY,JSON.stringify({version:1,datasetId:'foreign',kind:'account',accountId:'B'}));expect(f.session.isOwner()).toBe(false);expect(()=>f.session.storage.setItem('liftlog-data','{}')).toThrow();});
it('auth change during a failed workout write quarantines attempts across return and reload',()=>{
 const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');const original=f.values.get('liftlog-data');
 const set=f.raw.setItem.getMockImplementation();f.raw.setItem.mockImplementation((key,value)=>{if(key==='liftlog-active-run')throw Error('Synthetic draft failure');set(key,value);});
 expect(()=>f.session.storage.setItem('liftlog-active-run',JSON.stringify({confirmedSets:[{weight:150,reps:8}]}))).toThrow();
 f.owner.suspend();f.owner.identity('B');expect(f.session.recovery().redacted).toBe(true);f.owner.identity('A');
 expect(f.session.isOwner()).toBe(false);expect(f.owner.snapshot().needsRecovery).toBe(true);expect(JSON.stringify(f.session.recovery())).toContain('150');expect(f.values.get('liftlog-data')).toBe(original);
 const next=createEditorSession(f.raw,'reload');next.initialize(prepareInitialization);const owner=createAccountOwnership(next);owner.identity('A');expect(next.isOwner()).toBe(false);expect(JSON.stringify(next.recovery())).toContain('150');
});
it('a failed recovery journal still preserves all attempted data in memory and blocks editing',()=>{
 const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');f.raw.setItem.mockImplementation(()=>{throw Error('Storage unavailable');});
 expect(()=>f.session.storage.setItem('liftlog-active-run','synthetic-attempt')).toThrow();f.owner.suspend();f.owner.identity('A');
 expect(f.session.isOwner()).toBe(false);expect(JSON.stringify(f.session.recovery())).toContain('synthetic-attempt');
});
it('backup ownership must be explicit and match the destination account',async()=>{
 const {canImportOwnership}=await import('../../persistence/accountOwnership.js');
 const a={version:1,datasetId:'a',kind:'account',accountId:'A'},b={...a,accountId:'B'},anon={...a,kind:'anonymous',accountId:null};
 expect(canImportOwnership(a,a)).toBe(true);expect(canImportOwnership(a,b)).toBe(false);expect(canImportOwnership(null,a)).toBe(false);expect(canImportOwnership(anon,a)).toBe(false);expect(canImportOwnership(a,anon)).toBe(false);expect(canImportOwnership(anon,anon)).toBe(true);
});
it('failed startup cannot export known-account history before verifying auth',()=>{
 const f=fixture({kind:'account',accountId:'A'});f.values.set('liftlog-data','{malformed PRIVATE HISTORY');
 const next=createEditorSession(f.raw,'failed-startup');expect(next.initialize(prepareInitialization)).toBe(false);
 const exported=JSON.stringify(next.recovery());expect(exported).not.toContain('PRIVATE HISTORY');expect(next.recovery().redacted).toBe(true);
});
it('same-owner recovery remains exportable during data conflict quarantine',()=>{
 const f=fixture({kind:'account',accountId:'A'});f.owner.identity('A');f.values.set('liftlog-data',JSON.stringify({...history,settings:{foreignRevision:true}}));
 expect(()=>f.session.storage.setItem('liftlog-data',JSON.stringify(history))).toThrow();expect(f.session.isEditor()).toBe(false);expect(f.session.recovery().redacted).not.toBe(true);expect(f.session.recovery().conflicts.length).toBe(1);
});
it('unobserved SDK credential replacement prevents a stale owner from exporting recovery',()=>{
 const f=fixture({kind:'account',accountId:'A'});f.session.storage.setItem('sb-synthetic-auth-token','A');f.owner.identity('A');f.values.set('sb-synthetic-auth-token','B');expect(f.session.recovery().redacted).toBe(true);
});
it('an unreadable ownership snapshot cannot authorize an original-data export',()=>{
 const f=fixture({kind:'account',accountId:'A'}),get=f.raw.getItem;
 f.raw.getItem=key=>{if(key===OWNERSHIP_KEY)throw Error('Synthetic read failure');return get(key);};
 const next=createEditorSession(f.raw,'unreadable');expect(next.initialize(prepareInitialization)).toBe(false);expect(next.recovery().redacted).toBe(true);
});
