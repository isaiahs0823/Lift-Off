// Synthetic SDK transport for the separate browser-test build only. Never used by vite.config.js.
import { editorStorage } from '../../src/persistence/editorSession.js';
export const supabaseEnabled=true;
const listeners=new Set(), requests=[], deferred=new Map();
let sequence=0;
const authKey='sb-synthetic-auth-token';
const identity=()=>JSON.parse(editorStorage().getItem(authKey)||'null');
const sessionFor=id=>id?{user:{id,email:`${id}@synthetic.invalid`},access_token:'synthetic-only'}:null;
async function request(kind,table,value,userId) {
 const id=++sequence,record={id,kind,table,value,userId}; requests.push(record);
 if(window.__accountFixture.hold?.includes(kind+':'+table))await new Promise(resolve=>deferred.set(id,resolve));
 if(window.__accountFixture.fail?.includes(kind+':'+table))return {data:null,error:{message:'Synthetic rejection'}};
 if(kind==='select')return {data:table==='workout_profile'?null:(window.__accountFixture.remote?.[table]||[]),error:null};
 return {error:null};
}
export const supabase={
 auth:{
  startAutoRefresh(){},stopAutoRefresh(){},
  async getSession(){return {data:{session:identity()},error:null};},
  onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
  async signInWithOtp(){return {error:null};},
  async signOut(){editorStorage().removeItem(authKey);for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null};}
 },
 from(table){return {
  upsert:value=>request('upsert',table,value),
  select(){return {eq(key,userId){const promise=request('select',table,null,userId);promise.maybeSingle=()=>promise;return promise;}};}
 };},
 storage:{from(table){return {upload:(path,value)=>request('upload',table,{path}),async createSignedUrl(){return {data:{signedUrl:'data:image/jpeg;base64,AA=='}};}};}}
};
window.__accountFixture={requests,remote:{},hold:[],fail:[],
 signIn(id){const session=sessionFor(id);editorStorage().setItem(authKey,JSON.stringify(session));for(const fn of listeners)fn('SIGNED_IN',session);},
 emit(id,event="TOKEN_REFRESHED"){for(const fn of listeners)fn(event,sessionFor(id));},
 signOut:()=>supabase.auth.signOut(),
 resolve(id){deferred.get(id)?.();deferred.delete(id);}
};
