import { spawn } from "node:child_process";
import { once } from "node:events";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function start() {
  const child = spawn(process.execPath, ["dist/cli.js", "serve"], {
    env: { ...process.env, ZDBRIDGE_MOCK: "1", HEALTH_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return child;
}

async function stop(child) {
  const pid = child.pid;
  child.kill("SIGTERM");
  await once(child, "exit");
  return pid;
}

const first = start();
await wait(600);
const firstPid = await stop(first);
const second = start();
await wait(600);
const secondPid = await stop(second);
console.log("RESTART_RECOVERY_PASS firstPid=" + String(firstPid) + " secondPid=" + String(secondPid));