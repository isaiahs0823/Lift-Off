import {getEditorSession} from './editorSession.js';
// A stable account ID is necessary but insufficient: sign-out/return invalidates old work too.
export function cloudAccountLease(userId){
 const session=getEditorSession();
 if(!session.account)throw Error('Verified account ownership is required for cloud access.');
 const lease=session.account.lease(userId);
 const assert=()=>{if(!session.isEditor())throw Error('Editing ownership was released.');lease.assert();};
 assert();return {assert,current:()=>session.isEditor() && lease.current()};
}
