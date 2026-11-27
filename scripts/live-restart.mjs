import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { findSecretPattern } from "../dist/redaction.js";

function serviceLines() {
  return execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(String.fromCharCode(10)).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; });
}

function assertOneService(lines) {
  assert.equal(lines.length, 1, "expected exactly one live service");
  const pid = Number(lines[0].trim().split(/\s+/)[0]);
  assert.ok(pid > 0, "invalid live service PID");
  return pid;
}

async function stopByPid(pid) {
  process.kill(pid, "SIGTERM");
  try { execFileSync("timeout", ["15", "tail", "--pid=" + String(pid), "-f", "/dev/null"], { stdio: "ignore" }); } catch {}
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch {}
  assert.equal(alive, false, "live service PID did not stop");
}

async function healthReady(port) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + String(port) + "/health", { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) return await response.json();
    } catch {}
    await new Promise(function(resolve) { setTimeout(resolve, 500); });
  }
  throw new Error("live service health did not answer");
}

function selfTest() {
  assertOneService(["996828 node dist/cli.js serve"]);
  let threw = false;
  try { assertOneService([]); } catch { threw = true; }
  assert.ok(threw, "missing live service did not fail");
  threw = false;
  try { assertOneService(["1 node dist/cli.js serve", "2 node dist/cli.js serve"]); } catch { threw = true; }
  assert.ok(threw, "duplicate live service did not fail");
  console.log("LIVE_RESTART_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const config = loadConfigFromEnvFile();
  const oldPid = assertOneService(serviceLines());
  await stopByPid(oldPid);
  const child = spawn(process.execPath, ["dist/cli.js", "serve"], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let output = "";
  child.stdout.on("data", function(chunk) { output += chunk.toString(); });
  child.stderr.on("data", function(chunk) { output += chunk.toString(); });
  const health = await healthReady(config.healthPort);
  const newPid = assertOneService(serviceLines());
  assert.equal(newPid, child.pid, "live service PID mismatch");
  assert.equal(findSecretPattern(output), null, "secret value in output");
  assert.equal(findSecretPattern(JSON.stringify(health)), null, "secret value in health");
  console.log("LIVE_RESTART_PASS oldPid=" + String(oldPid) + " newPid=" + String(newPid) + " health=" + health.status);
}
