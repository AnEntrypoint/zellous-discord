import { execFileSync } from "node:child_process";

const commands = [
  ["npm", ["ci", "--ignore-scripts"]],
  ["npm", ["run", "live:alignment"]],
  ["npm", ["run", "alignment:red-check"]],
  ["npm", ["run", "spec:alignment"]],
  ["npm", ["run", "spec:red-check"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "unit"]],
  ["npm", ["run", "integration"]],
  ["npm", ["run", "secret:scan"]],
  ["npm", ["run", "secret:red-check"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "config:check"]],
  ["npm", ["run", "intent:guard"]],
  ["npm", ["run", "intent:red-check"]],
  ["npm", ["run", "snapshot:reconcile"]],
  ["npm", ["run", "live:inventory"]],
  ["npm", ["run", "snapshot:red-check"]],
  ["npm", ["run", "serve:check"]],
  ["npm", ["run", "restart:recovery"]],
  ["npm", ["run", "live:voice"]],
  ["git", ["check-ignore", "-v", ".env"]]
];

for (const [command, args] of commands) {
  console.log("WITNESS " + command + " " + args.join(" "));
  execFileSync(command, args, { stdio: "inherit" });
}

console.log("WITNESS_SUITE_PASS");