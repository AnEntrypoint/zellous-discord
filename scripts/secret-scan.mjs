import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const nl = String.fromCharCode(10);
const patterns = [
  { name: "discord-token", regex: /[A-Za-z0-9_-]{24,30}[.][A-Za-z0-9_-]{6,8}[.][A-Za-z0-9_-]{27,}/g },
  { name: "nsec", regex: /nsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}/g },
  { name: "private-key-hex", regex: /(?:BRIDGE_PRIVATE_KEY_HEX|NOSTR_PRIVATE_KEY|NSEC)[ ]*=[ ]*[0-9a-fA-F]{64}/g }
];
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".zip", ".gz", ".tgz", ".woff", ".woff2", ".ttf", ".pdf"]);

function isExcluded(path) {
  if (!path) return true;
  if (path === ".env") return true;
  if (path.startsWith(".env.") && path !== ".env.example") return true;
  if (path.startsWith(".git/") || path.startsWith("node_modules/") || path.startsWith("dist/") || path.startsWith("data/") || path.startsWith(".gm/") || path.startsWith(".agentplug")) return true;
  if (binaryExtensions.has(extname(path))) return true;
  return false;
}

function scanText(text) {
  const findings = [];
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const line = text.slice(0, match.index).split(nl).length;
      findings.push({ pattern: pattern.name, line });
    }
  }
  return findings;
}

function scanPaths(paths) {
  const findings = [];
  for (const path of paths) {
    if (isExcluded(path) || !existsSync(path)) continue;
    if (statSync(path).size > 2 * 1024 * 1024) continue;
    for (const finding of scanText(readFileSync(path, "utf8"))) findings.push({ file: path, ...finding });
  }
  return findings;
}

function trackedPaths() {
  try { return execFileSync("git", ["ls-files", "-z"]).toString().split(String.fromCharCode(0)).filter(Boolean); } catch { return []; }
}

function untrackedPaths() {
  try { return execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"]).toString().split(String.fromCharCode(0)).filter(Boolean); } catch { return []; }
}

function historyFindings() {
  try {
    const names = execFileSync("git", ["log", "--all", "--name-only", "--pretty=format:"]).toString().split(nl);
    if (names.some((name) => name.trim() === ".env")) return [{ file: "git-history", pattern: "env-committed", line: 0 }];
    const patch = execFileSync("git", ["log", "--all", "-p", "--", "."], { maxBuffer: 64 * 1024 * 1024 }).toString();
    return scanText(patch).map((finding) => ({ file: "git-history", ...finding }));
  } catch {
    return [];
  }
}

function selfTest() {
  const dir = ".gm/secret-scan-self-test";
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "token-like.txt");
  const parts = ["MTIzNDU2Nzg5MDEyMzQ1Njc4OTBhYmNkZWY", "ZmFrZXNpZw", "ZmFrZXNpZ25hdHVyZWxvbmdlbm91Z2h2YWx1ZQ"];
  writeFileSync(file, "DISCORD_TOKEN=" + parts.join(".") + nl, { mode: 0o600 });
  const findings = scanPaths([file]);
  rmSync(dir, { recursive: true, force: true });
  if (findings.length === 0) {
    console.error("SECRET_SCAN_SELF_TEST FAIL no pattern matched");
    process.exitCode = 1;
    return;
  }
  console.log("SECRET_SCAN_SELF_TEST PASS patterns=" + findings.map((finding) => finding.pattern).join(","));
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const paths = [...new Set([...trackedPaths(), ...untrackedPaths()])].filter((path) => !isExcluded(path));
  const findings = [...scanPaths(paths), ...historyFindings()];
  if (findings.length > 0) {
    for (const finding of findings) console.error("SECRET_SCAN_FAIL file=" + finding.file + " line=" + String(finding.line) + " pattern=" + finding.pattern);
    process.exitCode = 1;
    return;
  }
  console.log("SECRET_SCAN_PASS files=" + String(paths.length) + " history=clean");
}

main();