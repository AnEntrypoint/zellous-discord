import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("token-like fixture fails the secret scanner", () => {
  const output = execFileSync(process.execPath, ["scripts/secret-scan.mjs", "--self-test"], { encoding: "utf8" });
  assert.match(output, /SECRET_SCAN_SELF_TEST PASS/);
  assert.match(output, /realShape=detected synthetic=ignored nearMiss=detected/);
});