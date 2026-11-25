import { execFileSync } from "node:child_process";

const commands = [
  ["npm", ["ci", "--ignore-scripts"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "unit"]],
  ["npm", ["run", "integration"]],
  ["npm", ["run", "secret:scan"]],
  ["npm", ["run", "secret:red-check"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "restart:recovery"]],
  ["npm", ["run", "live:inventory"]],
  ["npm", ["run", "live:voice"]],
  ["git", ["check-ignore", "-v", ".env"]]
];

for (const [command, args] of commands) {
  console.log("WITNESS " + command + " " + args.join(" "));
  execFileSync(command, args, { stdio: "inherit" });
}

console.log("WITNESS_SUITE_PASS");