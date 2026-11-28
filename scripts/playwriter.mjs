import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const gmServer = process.env.GM_MCP_SERVER || "/config/.gm-tools/gm-mcp-server.mjs";
const browserCwd = process.env.GM_BROWSER_CWD || "/config/workspace/hyperagent";
const nl = String.fromCharCode(10);
const warmBody = ["url=https://anentrypoint.github.io/zellous/nostr-chat/", "wait=9000"].join(nl);

function browserCode(firstBody, secondBody) {
  return [
    "const startReset = await gm.browser_reset({});",
    "if (!startReset || startReset.ok !== true) throw new Error('browser start reset failed: ' + String(startReset && startReset.error));",
    "let result;",
    "try {",
    "const warm = await gm.browser({raw_body:" + JSON.stringify(warmBody) + "});",
    "if (!warm.ok) throw new Error('browser warmup failed: ' + String(warm.error));",
    "const first = await gm.browser({raw_body:" + JSON.stringify(firstBody) + "});",
    "if (!first.ok || first.exit_code !== 0) throw new Error('first browser steps failed: ' + String(first.error));",
    "const second = await gm.browser({raw_body:" + JSON.stringify(secondBody) + "});",
    "if (!second.ok || second.exit_code !== 0) throw new Error('second browser steps failed: ' + String(second.error));",
    "const firstPages = Array.isArray(first.pages) ? first.pages : [];",
    "const secondPages = Array.isArray(second.pages) ? second.pages : [];",
    "const firstSteps = Array.isArray(first.steps) ? first.steps.map(function(step) { return step.action; }) : [];",
    "const secondSteps = Array.isArray(second.steps) ? second.steps.map(function(step) { return step.action; }) : [];",
    "const firstEvalValues = firstPages.filter(function(page) { return page.op === 'eval'; }).map(function(page) { return page.value; });",
    "const secondEvalValues = secondPages.filter(function(page) { return page.op === 'eval'; }).map(function(page) { return page.value; });",
    "result = {ok:second.ok,exitCode:second.exit_code,evalValues:firstEvalValues.concat(secondEvalValues),firstEvalValues,secondEvalValues,firstSteps,secondSteps,steps:firstSteps.concat(secondSteps)};",
    "} finally {",
    "const endReset = await gm.browser_reset({});",
    "if (!endReset || endReset.ok !== true) throw new Error('browser close failed: ' + String(endReset && endReset.error));",
    "}",
    "return result;"
  ].join(nl);
}

async function dispatch(code) {
  const child = spawn(process.execPath, [gmServer], { stdio: ["pipe", "pipe", "ignore"], cwd: browserCwd });
  const rl = createInterface({ input: child.stdout });
  const pending = new Map();
  rl.on("line", function(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const request = function(id, method, params) {
    return new Promise(function(resolve, reject) {
      const timer = setTimeout(function() { reject(new Error("gm MCP request timed out")); }, 180000);
      pending.set(id, function(message) { clearTimeout(timer); resolve(message); });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + nl);
    });
  };
  try {
    const init = await request(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "zdb-ui-witness", version: "1" } });
    assert.ok(init.result, "gm MCP initialize failed");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + nl);
    const reply = await request(2, "tools/call", { name: "gm_codemode", arguments: { code, cwd: browserCwd, parsed: true, timeout_seconds: 180 } });
    const text = (reply.result?.content ?? []).find(function(item) { return item.type === "text"; })?.text;
    assert.ok(text, "gm MCP returned no text");
    assert.ok(!text.startsWith("gm-mcp: gm_codemode code threw"), "gm codemode failed: " + text.slice(0, 800));
    return JSON.parse(text);
  } finally {
    rl.close();
    child.kill("SIGTERM");
  }
}

export async function playwriter(firstBody, secondBody) {
  const parsed = await dispatch(browserCode(firstBody, secondBody));
  assert.equal(parsed.ok, true, "playwriter browser step failed");
  assert.equal(parsed.exitCode, 0, "playwriter browser exit code");
  assert.ok(parsed.evalValues.length > 0, "playwriter returned no evidence");
  assert.ok(Array.isArray(parsed.firstSteps) && Array.isArray(parsed.secondSteps) && Array.isArray(parsed.steps), "playwriter returned no browser steps");
  return parsed;
}
