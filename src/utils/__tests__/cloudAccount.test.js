import {it,expect,vi,beforeEach} from 'vitest';
const mock=vi.hoisted(()=>({session:null,calls:[],hold:null,release:null}));
vi.mock('../../persistence/editorSession.js',async importOriginal=>({...await importOriginal(),getEditorSession:()=>mock.session}));
vi.mock('../../lib/supabaseClient.js',()=>({supabaseEnabled:true,supabase:{
 from(table){return {async upsert(rows){mock.calls.push({type:'upsert',table,rows});if(mock.hold===table)await new Promise(resolve=>{mock.release=resolve;});return {error:null};},select(){return {eq(){const promise=(async()=>{mock.calls.push({type:'select',table});if(mock.hold===table)await new Promise(resolve=>{mock.release=resolve;});return {data:table==='workout_profile'?null:[],error:null};})();promise.maybeSingle=()=>promise;return promise;}};}};},
 storage:{from(table){return {async upload(path){mock.calls.push({type:'upload',table,path});if(mock.hold===table)await new Promise(resolve=>{mock.release=resolve;});return {error:null};}};}}
}}));
import {createEditorSession} from '../../persistence/editorSession.js';
import {createAccountOwnership,OWNERSHIP_KEY} from '../../persistence/accountOwnership.js';
import {prepareInitialization} from '../../persistence/initialization.js';
import {cloudAccountLease} from '../../persistence/cloudAccount.js';
import {pushWorkoutDataToSupabase,pullWorkoutDataFromSupabase} from '../supabaseSync.js';
import {pushPhotosToSupabase} from '../photoStorage.js';
beforeEach(()=>{
 const map=new Map([[OWNERSHIP_KEY,JSON.stringify({version:1,datasetId:'synthetic',kind:'account',accountId:'A'})]]);
 const raw={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 mock.calls=[];mock.hold=null;mock.release=null;mock.session=createEditorSession(raw,'test');mock.session.initialize(prepareInitialization);createAccountOwnership(mock.session).identity('A');
});
const data={logs:[{id:'synthetic',exId:'bench',sets:[{weight:100,reps:8}]}]};
it('rejects direct upload to B even if a caller bypasses the account screen',async()=>{await expect(pushWorkoutDataToSupabase(data,'B')).rejects.toThrow('ownership');expect(mock.calls).toEqual([]);});
it('rejects direct B download while the retained dataset belongs to A',async()=>{await expect(pullWorkoutDataFromSupabase('B')).rejects.toThrow();expect(mock.calls).toEqual([]);});
it('known A upload uses A identity for all rows',async()=>{expect((await pushWorkoutDataToSupabase(data,'A')).ok).toBe(true);expect(mock.calls.flatMap(c=>Array.isArray(c.rows)?c.rows:[c.rows]).every(r=>r.user_id==='A')).toBe(true);});
it('in-flight A upload cannot issue its profile write after sign-out',async()=>{mock.hold='exercise_logs';const promise=pushWorkoutDataToSupabase(data,'A');mock.session.account.identity(null);mock.release();await expect(promise).rejects.toThrow('ownership');expect(mock.calls.some(c=>c.table==='workout_profile')).toBe(false);});
it('in-flight A download cannot issue its profile read after B signs in',async()=>{mock.hold='exercise_logs';const promise=pullWorkoutDataFromSupabase('A');mock.session.account.identity('B');mock.release();await expect(promise).rejects.toThrow();expect(mock.calls.some(c=>c.table==='workout_profile')).toBe(false);});
it('retry callback captured before sign-out remains revoked after A returns',()=>{const lease=cloudAccountLease('A');mock.session.account.identity(null);mock.session.account.identity('A');expect(()=>lease.assert()).toThrow();});
it('a completed photo binary upload cannot write metadata after account change',async()=>{
 mock.hold='progress-photos';const promise=pushPhotosToSupabase([{id:'synthetic-photo',dataUrl:'data:image/jpeg;base64,AA=='}],'A');
 await vi.waitFor(()=>expect(mock.release).toBeTypeOf('function'));
 mock.session.account.identity('B');mock.release();await expect(promise).rejects.toThrow();expect(mock.calls.some(c=>c.table==='photos')).toBe(false);
});
it('released Web Lock capability invalidates a cloud lease',()=>{const lease=cloudAccountLease('A');mock.session.revoke();expect(()=>lease.assert()).toThrow('released');});
