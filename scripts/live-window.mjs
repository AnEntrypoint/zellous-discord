import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "unit"]],
  ["npm", ["run", "config:check"]],
  ["npm", ["run", "intent:guard"]],
  ["npm", ["run", "intent:red-check"]],
  ["npm", ["run", "spec:alignment"]],
  ["npm", ["run", "spec:red-check"]],
  ["npm", ["run", "live:alignment"]],
  ["npm", ["run", "alignment:red-check"]],
  ["npm", ["run", "discover:red-check"]],
  ["npm", ["run", "discover:publish"]],
  ["npm", ["run", "discover:query"]],
  ["npm", ["run", "snapshot:reconcile"]],
  ["npm", ["run", "live:inventory"]],
  ["npm", ["run", "snapshot:red-check"]],
  ["npm", ["run", "secret:scan"]],
  ["npm", ["run", "secret:red-check"]],
  ["npm", ["run", "serve:check"]],
  ["npm", ["run", "live:voice"]],
  ["git", ["check-ignore", "-v", ".env"]]
];

let code = 0;
try {
  const evidence = readFileSync(process.env.LIVE_DISCOVER_EVIDENCE || "", "utf8");
  if (evidence.indexOf("DISCOVER_CARD_VISIBLE") < 0 || evidence.indexOf("JOIN_OK") < 0 || evidence.indexOf("CHANNELS_OK") < 0 || evidence.indexOf("CHAT_OK") < 0) throw new Error("browser evidence incomplete");
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