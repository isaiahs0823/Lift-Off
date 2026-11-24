// Writes an isolated synthetic test artifact; never changes production configuration.
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({root,resolve:{alias:[{find:/.*lib\/supabaseClient\.js$/,replacement:fileURLToPath(new URL('./fixtures/accountSupabase.js',import.meta.url))}]},build:{outDir:process.env.BRK_ACCOUNT_FIXTURE_DIR||'/tmp/brk-account-fixture',emptyOutDir:true}});
