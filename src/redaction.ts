const patterns: Array<{ name: string; regex: RegExp }> = [
  { name: "discord-token", regex: /[A-Za-z0-9_-]{24,30}[.][A-Za-z0-9_-]{6,8}[.][A-Za-z0-9_-]{27,}/g },
  { name: "token-assignment", regex: /(?:DISCORD_TOKEN|DISCORD_VOICE_TOKEN_[0-9]+|BOT_TOKEN)[ ]*=[ ]*[^ ]+/g },
  { name: "nsec", regex: /nsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}/g },
  { name: "private-key-hex", regex: /(?:BRIDGE_PRIVATE_KEY_HEX|NOSTR_PRIVATE_KEY|NSEC)[ ]*=[ ]*[0-9a-fA-F]{64}/g }
];

export function redactText(value: string): string {
  let output = value;
  for (const pattern of patterns) output = output.replace(pattern.regex, "[REDACTED]");
  return output;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) result[key] = redactValue(child);
    return result;
  }
  return value;
}

export function findSecretPattern(value: string): string | null {
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(value)) return pattern.name;
  }
  return null;
}