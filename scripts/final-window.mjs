import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const evidencePath = join(scratch, "zellous-discord", "discover-evidence.txt");
const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "unit"]],
  ["npm", ["run", "integration"]],
  ["npm", ["run", "config:check"]],
  ["npm", ["run", "intent:guard"]],
  ["npm", ["run", "intent:red-check"]],
  ["npm", ["run", "spec:alignment"]],
  ["npm", ["run", "spec:red-check"]],
  ["npm", ["run", "live:alignment"]],
  ["npm", ["run", "alignment:red-check"]],
  ["npm", ["run", "discover:red-check"]],
  ["npm", ["run", "source:red-check", "--", "--self-test"]],
  ["npm", ["run", "presence:red-check", "--", "--self-test"]],
  ["npm", ["run", "discover:publish"]],
  ["npm", ["run", "discover:query"]],
  ["npm", ["run", "source:truth"]],
  ["npm", ["run", "snapshot:reconcile"]],
  ["npm", ["run", "live:inventory"]],
  ["npm", ["run", "snapshot:red-check"]],
  ["npm", ["run", "cleanup:red-check", "--", "--self-test"]],
  ["npm", ["run", "cleanup:red-check"]],
  ["npm", ["run", "channel-root:red-check", "--", "--self-test"]],
  ["npm", ["run", "channel-root:red-check"]],
  ["npm", ["run", "text:red-check", "--", "--self-test"]],
  ["npm", ["run", "voice:red-check", "--", "--self-test"]],
  ["npm", ["run", "live:restart", "--", "--self-test"]],
  ["npm", ["run", "live:restart"]],
  ["npm", ["run", "ui:marker-red-check", "--", "--self-test"]],
  ["npm", ["run", "ui:marker"]],
  ["npm", ["run", "ui:marker-red-check"]],
  ["npm", ["run", "voice:red-check"]],
  ["npm", ["run", "live:voice"]],
  ["npm", ["run", "source:red-check"]],
  ["npm", ["run", "presence:red-check"]],
  ["npm", ["run", "secret:scan"]],
  ["npm", ["run", "secret:red-check"]],
  ["npm", ["run", "serve:check"]],
  ["npm", ["run", "restart:recovery"]],
  ["git", ["check-ignore", "-v", ".env"]]
];

let code = 0;
try {
  const evidence = readFileSync(evidencePath, "utf8");
  for (const marker of ["DISCOVER_CARD_VISIBLE", "JOIN_OK", "CHANNELS_OK", "CHAT_OK", "SERVER_NAME_OK", "LOGO_OK", "VOICE_BRIDGE_OK"]) if (evidence.indexOf(marker) < 0) throw new Error("browser evidence incomplete: " + marker);
  if (evidence.includes("Discord Bridge")) throw new Error("stale browser server name");
  if (!evidence.includes("247420")) throw new Error("live guild name missing from browser evidence");
  if (process.env.GATE_TREE) {
    const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    if (process.env.GATE_TREE !== head) throw new Error("gate tree differs from worktree");
  }
  for (const [command, args] of commands) {
    console.log("WITNESS " + command + " " + args.join(" "));
    execFileSync(command, args, { stdio: "inherit" });
  }
} catch (error) {
  code = typeof error.status === "number" ? error.status : 1;
  console.error(String(error.message || error));
}
console.log("LIVE_DONE " + String(code));
process.exitCode = code;
