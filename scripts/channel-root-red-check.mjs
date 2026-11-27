import assert from "node:assert/strict";
import { join } from "node:path";
import { loadConfigFromEnvFile, REQUIRED_SERVER_ID } from "../dist/config.js";
import { channelRoot, rootChannelMap } from "../dist/live/source.js";
import { Ledger } from "../dist/ledger.js";
import { mapZellousChannelToRoom } from "../dist/mappers.js";
import { MappingStore } from "../dist/mapping.js";
import { channelHash } from "../dist/nostr.js";
import { createDiscordRequest } from "./discord-rest.mjs";

const names = ["inference", "warez-and-wonders"];

function roomFor(name, channelId) {
  return mapZellousChannelToRoom({ id: "room-" + channelId, name, type: "text" }, REQUIRED_SERVER_ID, "367741339393327104");
}

function assertRoot(room, channelId) {
  const cross = { ...room, discordId: "1575444662024413214", zellousId: "room-" + channelId };
  const crossRoots = rootChannelMap(REQUIRED_SERVER_ID, { allRooms: () => [cross] });
  assert.equal(crossRoots.get(channelRoot(REQUIRED_SERVER_ID, channelId)), undefined, "cross-channel room root should not exist");
  const canonicalRoots = rootChannelMap(REQUIRED_SERVER_ID, { allRooms: () => [room, cross] });
  assert.equal(canonicalRoots.get(channelRoot(REQUIRED_SERVER_ID, channelId)), channelId, "cross-channel room overrode canonical root");
  assert.equal(room.discordId, channelId, "Zellous room missing Discord source ID");
  const roots = rootChannelMap(REQUIRED_SERVER_ID, { allRooms: () => [room] });
  assert.ok(roots.size > 0, "root map empty");
  assert.equal(roots.get(channelHash(REQUIRED_SERVER_ID, "room-" + channelId)), channelId, "wrong channel root");
  assert.equal(roots.get(channelRoot(REQUIRED_SERVER_ID, channelId)), channelId, "wrong channel root helper");
}

function assertLiveRoots(roots, ids) {
  const inference = ids.get("inference");
  const warez = ids.get("warez-and-wonders");
  assert.ok(inference && warez, "missing live channel ID");
  assert.notEqual(inference, warez, "witness channels are not distinct");
  for (const [name, id] of ids) {
    assert.equal(roots.get(channelRoot(REQUIRED_SERVER_ID, id)), id, "live ledger root missing: " + name);
    assert.equal(roots.get(channelHash(REQUIRED_SERVER_ID, "room-" + id)), id, "live ledger hash missing: " + name);
  }
  assert.notEqual(roots.get(channelRoot(REQUIRED_SERVER_ID, inference)), warez, "cross-channel root override");
}

function selfTest() {
  const ids = new Map([["inference", "1073958855979057162"], ["warez-and-wonders", "805320534370943016"]]);
  const roots = rootChannelMap(REQUIRED_SERVER_ID, { allRooms: () => [roomFor("inference", ids.get("inference")), roomFor("warez-and-wonders", ids.get("warez-and-wonders"))] });
  assertLiveRoots(roots, ids);
  let threw = false;
  try { assertRoot({ ...roomFor("inference", ids.get("inference")), discordId: null }, ids.get("inference")); } catch { threw = true; }
  assert.ok(threw, "missing Discord source ID did not fail");
  threw = false;
  try { assertRoot({ ...roomFor("inference", ids.get("inference")), discordId: "999999999999999999" }, ids.get("inference")); } catch { threw = true; }
  assert.ok(threw, "wrong Discord source ID did not fail");
  threw = false;
  try { assert.equal(rootChannelMap(REQUIRED_SERVER_ID, { allRooms: () => [] }).size, 1, "empty root map did not fail"); } catch { threw = true; }
  assert.ok(threw, "empty live ledger root map did not fail");
  threw = false;
  try { assertLiveRoots(new Map([[channelRoot(REQUIRED_SERVER_ID, ids.get("inference")), ids.get("warez-and-wonders")]]), ids); } catch { threw = true; }
  assert.ok(threw, "cross-channel root override did not fail");
  console.log("CHANNEL_ROOT_RED_CHECK_SELF_TEST_PASS channels=2");
}

async function main() {
  const config = loadConfigFromEnvFile();
  const discordRequest = createDiscordRequest(config);
  const channels = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const ids = new Map();
  for (const name of names) {
    const matches = channels.filter(function(channel) { return channel.type === 0 && channel.name === name; });
    assert.equal(matches.length, 1, "Discord channel missing or duplicated: " + name);
    ids.set(name, String(matches[0].id));
  }
  const mapping = new MappingStore(new Ledger(join(config.bridgeStateDir, "bridge-ledger.jsonl")));
  const roots = rootChannelMap(REQUIRED_SERVER_ID, mapping);
  for (const [name, id] of ids) assertRoot(roomFor(name, id), id);
  assertLiveRoots(roots, ids);
  console.log("CHANNEL_ROOT_RED_CHECK_PASS channels=" + names.join(","));
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
