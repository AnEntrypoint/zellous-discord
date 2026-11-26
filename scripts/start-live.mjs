import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });
const logPath = join(dir, "live-service.log");
const pidPath = join(dir, "live-service.pid");
const fd = openSync(logPath, "a");
const child = spawn(process.execPath, ["dist/cli.js", "serve"], {
  cwd: process.cwd(),
  detached: true,
  stdio: ["ignore", fd, fd],
  env: { ...process.env, ZDBRIDGE_READ_ONLY: "1", HEALTH_PORT: "8789" }
});
child.unref();
closeSync(fd);
writeFileSync(pidPath, String(child.pid), { mode: 0o600 });
console.log("LIVE_SERVICE_PID " + String(child.pid));
