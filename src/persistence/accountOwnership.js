// One preserved device dataset. Ownership changes never replace athlete payloads.
export const OWNERSHIP_KEY = 'brk-dataset-ownership:v1';
const failure = () => Object.assign(new Error('Account ownership changed. This operation cannot access athlete data.'), {code:'ACCOUNT_CHANGED'});
export function createAccountOwnership(session) {
  let metadata=null, accountId=null, generation=0, resolved=false, suspended=false, error=null, verifiedRaw=null;
  const listeners=new Set();
  let needsRecovery=session.hasAccountRecovery();
  const emit=()=>listeners.forEach(fn=>fn(snapshot()));
  try {
    const raw=session.controlStorage.getItem(OWNERSHIP_KEY);
    if(raw!==null) {metadata=JSON.parse(raw);if(!validOwnership(metadata))throw Error('Invalid ownership record');verifiedRaw=raw;}
    else {
      metadata={version:1,datasetId:crypto.randomUUID(),kind:session.hadAthleteData()?'review':'anonymous',accountId:null};
      verifiedRaw=JSON.stringify(metadata);
      session.controlStorage.setItem(OWNERSHIP_KEY,verifiedRaw);
    }
  } catch {error='Ownership could not be verified. Original data has been preserved. Reload to retry or request recovery review.';}
  function allowed() {
    if(!error && verifiedRaw!==null) {
      try {if(session.controlStorage.getItem(OWNERSHIP_KEY)!==verifiedRaw)return false;} catch {return false;}
    }
    return !needsRecovery && !error && resolved && !suspended && (metadata?.kind==='anonymous' ? accountId===null : metadata?.kind==='account' && metadata.accountId===accountId);
  }
  function snapshot() {return {metadata:metadata && {...metadata},accountId,generation,allowed:allowed(),resolved,suspended,error,needsRecovery};}
  session.installAccountGuard(allowed);
  const api={
    snapshot,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    identity(id) {
      if(id!==null && (typeof id!=='string'||!id))throw failure();
      if(!resolved || id!==accountId || suspended) {
        // Flush the old editor before revoking it; the broker retains failed payloads.
        try {session.flush();} catch { /* No transition grants permission to discard a failed write. */ }
        if(allowed())needsRecovery=session.preserveAccountTransition(metadata) || needsRecovery;
        accountId=id;resolved=true;suspended=false;generation++;emit();
      }
    },
    suspend() {
      if(allowed()) {try{session.flush();}catch{/* Failed payloads remain in broker recovery. */}
        needsRecovery=session.preserveAccountTransition(metadata) || needsRecovery;
      }
      generation++;resolved=true;suspended=true;emit();
    },
    lease(userId) {
      const epoch=generation;
      const current=()=>allowed() && generation===epoch && (userId===undefined || (accountId===userId && metadata.kind==='account'));
      return {generation:epoch,accountId, current,assert(){if(!current())throw failure();}};
    },
    adopt(expectedAccountId, expectedGeneration) {
      if(expectedAccountId!==accountId || expectedGeneration!==generation)throw failure();
      if(needsRecovery || error || !resolved || suspended || !accountId || metadata.kind!=='anonymous')throw failure();
      // Only the explicit UI action may cross anonymous -> known. Never review -> known.
      session.prepareRelease();
      const next={...metadata,kind:'account',accountId};
      generation++;suspended=true;emit();
      try {session.controlStorage.setItem(OWNERSHIP_KEY,JSON.stringify(next));metadata=next;verifiedRaw=JSON.stringify(next);suspended=false;emit();}
      catch(e){error='Ownership was not saved. No athlete data was moved. Keep this tab open or reload to verify ownership.';emit();throw e;}
    },
    canExport(){
      if(!resolved || suspended || verifiedRaw===null || !validOwnership(metadata))return false;
      if(!session.verifyExportOwnership(verifiedRaw))return false;
      return metadata?.kind==='account' ? accountId===metadata.accountId : accountId===null;
    },
  };
  session.account=api;
  return api;
}

export function validOwnership(value) {
    if(!value || value.version!==1 || typeof value.datasetId!=='string' || !value.datasetId) return false;
    return value.kind==='account' ? typeof value.accountId==='string' && !!value.accountId : ['anonymous','review'].includes(value.kind) && value.accountId===null;
}

export function canImportOwnership(source,target){
 if(!validOwnership(source)||!validOwnership(target))return false;
 if(source.kind==='account')return target.kind==='account' && source.accountId===target.accountId;
 return source.kind==='anonymous' && target.kind==='anonymous';
}
