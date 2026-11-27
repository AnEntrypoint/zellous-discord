import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assertResult(result) {
  assert.equal(result.ok, true, "missing marker");
  assert.equal(result.root.length, 64, "wrong channel root");
  assert.equal(result.channelCount, 21, "changed channel count");
  assert.equal(result.privilegedIntentsEnabled, false, "text witness waited for portal approval");
  assert.equal(result.liveServicePid.length > 0, true, "missing live service PID");
  assert.equal(result.liveServiceCount ?? 1, 1, "more than one live service");
  assert.ok(result.discordReflectionEventId, "missing Discord-origin relay event");
  assert.ok(result.zellousEventId, "missing Zellous-origin event");
  assert.ok(result.discordMessageId, "missing Discord-origin message");
  assert.ok(result.zellousDiscordMessageId, "missing Zellous-origin Discord message");
  assert.equal(result.zellousUsername.startsWith("zdb-user-"), true, "missing Zellous username");
  assert.equal(result.visibleZellousMarker, "[" + result.zellousUsername + "] " + result.zellousMarker, "wrong visible attribution");
  assert.equal(result.bareZellousMarkerCount ?? 1, 0, "missing visible attribution");
  assert.equal(result.discordAttributionTagCount, 1, "Discord attribution missing or duplicated");
  assert.ok(result.discordUsername && result.discordUsername.length > 0, "missing Discord username");
  assert.equal(result.zellousRelayAttribution, result.zellousUsername, "Zellous relay attribution mismatch");
  assert.equal(result.discordMarker.startsWith("zdb-discord-"), true, "missing Discord marker");
  assert.equal(result.zellousMarker.startsWith("zdb-zellous-"), true, "missing Zellous marker");
  assert.equal(result.duplicateCount ?? 0, 0, "duplicate or echoed message");
  assert.equal(result.secretFound ?? false, false, "secret value in output");
}

function selfTest() {
  const base = { ok: true, root: "a".repeat(64), channelCount: 21, privilegedIntentsEnabled: false, discordReflectionEventId: "a", zellousEventId: "b", discordMessageId: "c", zellousDiscordMessageId: "d", discordMarker: "zdb-discord-x", zellousMarker: "zdb-zellous-x", zellousUsername: "zdb-user-x", visibleZellousMarker: "[zdb-user-x] zdb-zellous-x", bareZellousMarkerCount: 0, discordAttributionTagCount: 1, discordUsername: "discord-user", zellousRelayAttribution: "zdb-user-x", liveServicePid: "1", liveServiceCount: 1 };
  const cases = [
    [{ ...base, ok: false }, "missing marker"],
    [{ ...base, root: "wrong" }, "wrong channel root"],
    [{ ...base, channelCount: 22 }, "changed channel count"],
    [{ ...base, privilegedIntentsEnabled: true }, "text witness waited for portal approval"],
    [{ ...base, liveServiceCount: 2 }, "more than one live service"],
    [{ ...base, duplicateCount: 1 }, "duplicate or echoed message"],
    [{ ...base, zellousDiscordMessageId: "" }, "missing Zellous-origin Discord message"],
    [{ ...base, zellousUsername: "other" }, "missing Zellous username"],
    [{ ...base, visibleZellousMarker: "zdb-zellous-x" }, "wrong visible attribution"],
    [{ ...base, bareZellousMarkerCount: 1 }, "missing visible attribution"],
    [{ ...base, discordAttributionTagCount: 0 }, "Discord attribution missing or duplicated"],
    [{ ...base, discordAttributionTagCount: 2 }, "Discord attribution missing or duplicated"],
    [{ ...base, zellousRelayAttribution: "other" }, "Zellous relay attribution mismatch"],
    [{ ...base, secretFound: true }, "secret value in output"]
  ];
  for (const [value, label] of cases) {
    let threw = false;
    try { assertResult(value); } catch { threw = true; }
    assert.ok(threw, label + " did not fail");
  }
  console.log("TEXT_RED_CHECK_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync(join(scratch, "zellous-discord", "text-marker-result.json"), "utf8"));
  assertResult(result);
  console.log("TEXT_RED_CHECK_PASS root=" + result.root + " channelCount=" + String(result.channelCount));
}
