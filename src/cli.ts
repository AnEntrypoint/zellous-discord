import { loadConfigFromEnvFile } from "./config.js";
import { deriveSecretKey, loadOrCreateSeed, publicKeyHex, resolveServerId } from "./identity.js";
import { liveInventory } from "./live/inventory.js";
import { voiceSmoke } from "./live/voice.js";
import { BridgeService } from "./service.js";

function resolvedIdentity() {
  const config = loadConfigFromEnvFile();
  const seed = loadOrCreateSeed(config.bridgeStateDir);
  const bridgePublicKey = publicKeyHex(deriveSecretKey(seed, "bridge"));
  return { config, bridgePublicKey, serverId: resolveServerId(config, bridgePublicKey) };
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
  if (command === "inventory") {
    const { config, bridgePublicKey, serverId } = resolvedIdentity();
    const result = await liveInventory(config, serverId, bridgePublicKey);
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