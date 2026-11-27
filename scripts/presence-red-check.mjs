import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assertLog(log) {
  assert.ok(log.length > 0, "current live service log is empty");
  assert.ok(!log.includes("Cannot read properties of null (reading 'userId')"), "nullable presence error remains");
  assert.ok(!log.includes("Presence: unknown status"), "degraded presence remains");
  assert.ok(!log.includes("discord gateway error"), "discord gateway error remains");
}

function selfTest() {
  assertLog('{"level":"info","message":"bridge service started"}' + String.fromCharCode(10));
  const cases = [
    ["", "empty log did not fail"],
    ['{"level":"error","message":"discord gateway error","meta":{"message":"Cannot read properties of null (reading \'userId\')"}}', "nullable presence error did not fail"],
    ['{"level":"error","message":"target apply degraded","meta":{"operation":"presence.update","message":"Presence: unknown status"}}', "degraded presence did not fail"],
    ['{"level":"error","message":"discord gateway error"}', "discord gateway error did not fail"]
  ];
  for (const [log, label] of cases) {
    let threw = false;
    try { assertLog(log); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("PRESENCE_RED_CHECK_SELF_TEST_PASS cases=" + String(cases.length));
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const logPath = join(scratch, "zellous-discord", "live-service-current.log");
  assert.ok(existsSync(logPath), "current live service log missing");
  assertLog(readFileSync(logPath, "utf8"));
  console.log("PRESENCE_RED_CHECK_PASS nullable=0 degradedPresence=0 gatewayErrors=0");
}
