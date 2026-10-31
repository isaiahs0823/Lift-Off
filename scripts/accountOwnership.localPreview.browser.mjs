import {test} from 'node:test';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BRK_PLAYWRIGHT_MODULE||'playwright');
test('fresh isolated local-only preview owns its synthetic dataset anonymously without cloud access',async()=>{
 const browser=await chromium.launch({executablePath:process.env.BRK_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext();const external=[];const origin=process.env.BRK_LOCAL_PREVIEW_ORIGIN||'http://127.0.0.1:4175';
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();external.push(r.request().url());return r.abort();});
  const page=await context.newPage();await page.goto(origin);await page.getByRole('button',{name:'Train',exact:true}).last().waitFor();
  await page.locator('[data-local-preview="true"]').waitFor();
  const state=await page.evaluate(()=>({owner:JSON.parse(localStorage.getItem('brk-dataset-ownership:v1')),data:JSON.parse(localStorage.getItem('liftlog-data'))}));
  assert.equal(state.owner.kind,'anonymous');assert.equal(state.owner.accountId,null);assert.ok(state.data.logs.some(l=>l.id==='preview-bench-log'));assert.deepEqual(external,[]);
 }finally{await browser.close();}
});
