import React,{lazy,Suspense,useEffect,useState} from 'react';
import {getEditorSession} from './editorSession.js';
import {useSupabaseAuth} from '../hooks/useSupabaseAuth.js';
const AthleteApp=lazy(()=>import('../App.jsx'));
export default function AccountBoundary(){
 const persistence=getEditorSession(),ownership=persistence.account;
 const auth=useSupabaseAuth();
 const [status,setStatus]=useState(()=>ownership.snapshot()),[email,setEmail]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const off=ownership.subscribe(setStatus);setStatus(ownership.snapshot());return off;},[ownership]);
 async function action(fn){try{setMessage('');await fn();}catch(e){setMessage(e.message||'Account access failed. Your saved data has not been reset.');}}
 function exportOriginal(){
  const payload=persistence.recovery(),link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  link.href=url;link.download='brk-ownership-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(auth.authLoading || !status.resolved)return <p className="p-6">Checking account ownership before opening athlete data…</p>;
 if(status.allowed)return <Suspense fallback={<p className="p-6">Opening your saved workout…</p>}><AthleteApp key={status.generation} auth={auth}/></Suspense>;
 const adopt=status.metadata?.kind==='anonymous' && status.accountId && !status.error && !status.needsRecovery;
 return <main className="min-h-screen bg-v5-bg text-v5-text p-6 space-y-4">
  <h1 className="text-xl font-bold">{status.needsRecovery?'Unsaved data needs recovery review':status.metadata?.kind==='review'?'Saved data needs ownership review':adopt?'Connect your device data?':'Account data protected'}</h1>
  <p>{status.error || (status.needsRecovery?'An account change interrupted unsaved device data. Recoverable copies have been preserved. Sign in as the owning account and export them for review before editing resumes.':status.metadata?.kind==='review'?'This older dataset has no verified owner. It has been preserved. It cannot be assigned to the next account that signs in. Export it while signed out for recovery review.':adopt?`Associate this device’s anonymous workout history, active workout, photos, goals, nutrition and settings with ${auth.user?.email || 'this account'}? This permits account synchronization.`:'This device contains data associated with another account. Sign in with its owning account to reopen it. No workout data has been deleted or transferred.')}</p>
  {adopt && <>
   <button className="underline" onClick={()=>action(()=>ownership.adopt(status.accountId,status.generation))}>Associate this device data with my account</button>
   <button className="underline block" onClick={()=>action(auth.signOut)}>Keep data anonymous and sign out</button>
  </>}
  {auth.user && !adopt && <button className="underline" onClick={()=>action(auth.signOut)}>Sign out to use the owning account</button>}
  {!auth.user && auth.supabaseEnabled && <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(window.confirm(`Send a sign-in link to ${email}?`))action(async()=>{await auth.signInWithEmail(email);setMessage('Check your email for the sign-in link.');});}}>
   <label>Email <input className="text-black" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <button className="underline block" type="submit">Send sign-in link</button>
  </form>}
  {ownership.canExport() && <button className="underline block" onClick={exportOriginal}>Export preserved device data for review</button>}
  <button className="underline block" onClick={()=>window.location.reload()}>Reload to verify account access</button>
  {message && <p role="alert">{message}</p>}
 </main>;
}
