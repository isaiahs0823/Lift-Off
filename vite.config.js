import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

// Short commit hash for the About/version row in Help & Guide (src/components/
// HelpGuideScreen.jsx) — genuinely useful for telling a stale PWA/App Store build apart from a
// fresh one when diagnosing a bug report. Falls back to "dev" outside a git checkout (a
// tarball deploy, a shallow clone with no history) rather than failing the build.
function getBuildId() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: import.meta.dirname }).toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(getBuildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
