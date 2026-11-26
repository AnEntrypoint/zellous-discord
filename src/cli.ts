import { loadConfigFromEnvFile } from "./config.js";
import { ownerHex, requireOwnerKey, resolveServerId } from "./identity.js";
import { liveInventory } from "./live/inventory.js";
import { publishOwnerBundle } from "./live/discover.js";
import { publishRoomSnapshot, rollbackRoomSnapshot } from "./live/reconcile.js";
import { publishChatEvent } from "./live/chat.js";
import { voiceSmoke } from "./live/voice.js";
import { cleanupDuplicateChannels, rollbackCleanup } from "./live/cleanup.js";
import { BridgeService } from "./service.js";

function resolvedIdentity() {
  const config = loadConfigFromEnvFile();
  const owner = ownerHex(config);
  return { config, owner, serverId: resolveServerId(config, owner) };
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "serve";
  if (command === "serve") {
    const service = new BridgeService();
    await service.start();
    return;
  }
  if (command === "health") {
    const { config } = resolvedIdentity();
    const response = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health");
    console.log(JSON.stringify(await response.json()));
    return;
  }
  if (command === "reconcile" || command === "snapshot-reconcile") {
    const { config, serverId } = resolvedIdentity();
    const result = await publishRoomSnapshot(config, serverId);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "snapshot-rollback") {
    const { config } = resolvedIdentity();
    const result = await rollbackRoomSnapshot(config);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "cleanup") {
    const { config, serverId } = resolvedIdentity();
    const result = await cleanupDuplicateChannels(config, serverId);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "cleanup-rollback") {
    const { config } = resolvedIdentity();
    const result = await rollbackCleanup(config);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "discover-publish") {
    const { config, serverId } = resolvedIdentity();
    const result = await publishOwnerBundle(config, serverId);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "chat-post") {
    const { config, serverId } = resolvedIdentity();
    const channelId = process.argv[3] ?? "";
    const content = process.argv.slice(4).join(" ");
    const result = await publishChatEvent(config, serverId, channelId, content);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "inventory") {
    const { config, serverId } = resolvedIdentity();
    const result = await liveInventory(config, serverId);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "voice-smoke") {
    const { config } = resolvedIdentity();
    const result = await voiceSmoke(config);
    console.log(JSON.stringify({ ...result, closed: true }));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error("unknown command " + command);
}

await main();