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
  ["npm", ["run", "text:marker"]],
  ["npm", ["run", "text:red-check"]],
  ["npm", ["run", "ui:marker-red-check", "--", "--self-test"]],
  ["npm", ["run", "ui:marker"]],
  ["npm", ["run", "ui:marker-red-check"]],
  ["npm", ["run", "voice:red-check"]],
  ["npm", ["run", "serve:check"]],
  ["npm", ["run", "restart:recovery"]],
  ["npm", ["run", "live:voice"]],
  ["npm", ["run", "source:red-check"]],
  ["npm", ["run", "presence:red-check"]],
  ["git", ["check-ignore", "-v", ".env"]]
];

for (const [command, args] of commands) {
  console.log("WITNESS " + command + " " + args.join(" "));
  execFileSync(command, args, { stdio: "inherit" });
}

console.log("WITNESS_SUITE_PASS");