export function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

export function createDiscordRequest(config) {
  return async function discordRequest(method, path, body) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch("https://discord.com/api/v10" + path, { method, headers: { Authorization: "Bot " + config.discordToken.reveal(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      if (response.status === 429) {
        const retry = await response.json().catch(function() { return {}; });
        await sleep(Number(retry.retry_after ?? 1) * 1000 + 100);
        continue;
      }
      if (!response.ok) throw new Error("Discord REST failed with status " + String(response.status));
      return response.status === 204 ? null : await response.json();
    }
    throw new Error("Discord REST rate limit persisted");
  };
}
