import assert from "node:assert/strict";

const endpoint = process.env.GM_MCP_HTTP || "http://127.0.0.1:8787/mcp";
const browserCwd = process.env.GM_BROWSER_CWD || "/config/workspace/hyperagent";
const nl = String.fromCharCode(10);

async function rpc(id, method, params) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error("gm MCP HTTP failed with status " + String(response.status));
  const payload = await response.json();
  if (payload.error) throw new Error("gm MCP RPC error " + JSON.stringify(payload.error));
  return payload.result;
}

function browserCode(rawBody) {
  return [
    "const r = await gm.browser({raw_body:" + JSON.stringify(rawBody) + "});",
    "const t = String(r.text || r);",
    "const i = t.indexOf('stdout: |');",
    "if (i < 0) throw new Error('browser stdout missing: ' + t.slice(0, 400));",
    "const rest = t.slice(i + 9).split(String.fromCharCode(10));",
    "const block = [];",
    "for (const line of rest.slice(1)) { if (!line.startsWith('  ')) break; block.push(line.slice(2)); }",
    "const o = JSON.parse(block.join(String.fromCharCode(10)));",
    "const e = /exit_code:\\s*(\\d+)/.exec(t);",
    "return {ok:o.ok,exitCode:e?Number(e[1]):(o.error?1:0),error:o.error||null,evalValues:o.pages.filter(p=>p.op==='eval').map(p=>p.value),steps:o.steps.map(s=>s.action)}"
  ].join(nl);
}

export async function playwriter(rawBody) {
  await rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "zdb-ui-witness", version: "1" } });
  const result = await rpc(2, "tools/call", { name: "gm_codemode", arguments: { code: browserCode(rawBody), cwd: browserCwd } });
  const text = (result.content ?? []).find(function(item) { return item.type === "text"; })?.text;
  assert.ok(text, "gm MCP returned no text");
  assert.ok(!text.startsWith("gm-mcp: gm_codemode code threw"), "gm codemode failed: " + text.slice(0, 400));
  const parsed = JSON.parse(text);
  assert.equal(parsed.ok, true, "playwriter browser step failed: " + String(parsed.error));
  assert.equal(parsed.exitCode, 0, "playwriter browser exit code");
  assert.ok(parsed.evalValues.length > 0, "playwriter returned no eval values");
  return parsed;
}
