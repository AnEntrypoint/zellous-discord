import { execFileSync } from "node:child_process";

let code = 0;
try {
  execFileSync(process.execPath, ["scripts/witness-suite.mjs"], { stdio: "inherit" });
} catch (error) {
  code = typeof error.status === "number" ? error.status : 1;
}
console.log("ZDBRIDGE_DONE " + String(code));
process.exitCode = code;