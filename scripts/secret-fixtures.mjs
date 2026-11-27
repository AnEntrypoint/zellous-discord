const syntheticParts = ["MTIzNDU2Nzg5MDEyMzQ1Njc4OTBhYmNkZWY", "ZmFrZXNpZw", "ZmFrZXNpZ25hdHVyZWxvbmdlbm91Z2h2YWx1ZQ"];
const numericParts = ["MTEyMjMzNDQ1NTY2Nzc4ODk5", "ZmFrZXNpZw", "ZmFrZXNpZ25hdHVyZWxvbmdlbm91Z2h2YWx1ZQ"];

export const syntheticDiscordToken = syntheticParts.join(".");
export const realShapedDiscordToken = numericParts.join(".");

export function isSyntheticSecret(value) {
  if (value !== syntheticDiscordToken) return false;
  const first = value.split(".")[0];
  const decoded = Buffer.from(first, "base64url").toString("utf8");
  return decoded.length > 0 && !/^[0-9]+$/.test(decoded);
}
