import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const evidencePath = join(scratch, "zellous-discord", "discover-evidence.txt");
const npm = function(...args) { return ["npm", ["run", ...args]]; };
const windows = {
  a: [
    npm("typecheck"), npm("build"), npm("unit"), npm("integration"), npm("config:check"),
    npm("intent:guard"), npm("intent:red-check"), npm("spec:alignment"), npm("spec:red-check"),
    npm("live:alignment"), npm("alignment:red-check"), npm("discover:red-check"),
    npm("source:red-check", "--", "--self-test"), npm("presence:red-check", "--", "--self-test"),
    npm("cleanup:red-check", "--", "--self-test"), npm("channel-root:red-check", "--", "--self-test"),
    npm("text:red-check", "--", "--self-test"), npm("voice:red-check", "--", "--self-test"),
    npm("live:restart", "--", "--self-test"), npm("ui:marker-red-check", "--", "--self-test"),
    npm("voice:red-check"), npm("voice:bridge", "--", "--self-test"), npm("attribution:witness", "--", "--self-test"), npm("relay:heal", "--", "--self-test"), npm("secret:scan"), npm("secret:red-check"), npm("serve:check"),
    ["git", ["check-ignore", "-v", ".env"]]
  ],
  b: [
    npm("discover:query"), npm("source:truth"), npm("source:red-check"), npm("presence:red-check"),
    npm("snapshot:reconcile"), npm("live:inventory"), npm("snapshot:red-check"), npm("channel-root:red-check"), npm("cleanup:red-check"), npm("attribution:witness"), npm("text:marker"), npm("text:red-check"), npm("ui:marker"), npm("ui:marker-red-check"), npm("serve:check")
  ]
};
const part = process.argv.includes("--part=b") ? "b" : "a";
const commands = windows[part];

function checkEvidence() {
  const evidence = readFileSync(evidencePath, "utf8");
  for (const marker of ["DISCOVER_CARD_VISIBLE", "JOIN_OK", "CHANNELS_OK", "CHAT_OK", "SERVER_NAME_OK", "LOGO_OK", "VOICE_BRIDGE_OK"]) if (evidence.indexOf(marker) < 0) throw new Error("browser evidence incomplete: " + marker);
  if (evidence.includes("Discord Bridge")) throw new Error("stale browser server name");
  if (!evidence.includes("247420")) throw new Error("live guild name missing from browser evidence");
}

let code = 0;
try {
  rmSync(evidencePath, { force: true });
  if (process.env.GATE_TREE) {
    const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    if (process.env.GATE_TREE !== head) throw new Error("gate tree differs from worktree");
  }
  for (const [command, args] of commands) {
    console.log("WITNESS " + command + " " + args.join(" "));
    execFileSync(command, args, { stdio: "inherit" });
    if (args.includes("source:truth")) checkEvidence();
  }
} catch (error) {
  code = typeof error.status === "number" ? error.status : 1;
  console.error(String(error.message || error));
}
console.log("WINDOW_" + part.toUpperCase() + "_DONE " + String(code));
console.log("LIVE_DONE " + String(code));
process.exitCode = code;
