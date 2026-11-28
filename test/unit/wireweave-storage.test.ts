import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStorage } from "../../src/wireweave-node.js";

test("node storage preserves Discord guild logo when wireweave rewrites servers", () => {
  const dir = mkdtempSync(join(tmpdir(), "zdb-storage-"));
  const path = join(dir, "wireweave-storage.json");
  const icon = "https://cdn.discordapp.com/icons/367741339393327104/icon.png";
  const serverId = "owner:discord-367741339393327104";
  writeFileSync(path, JSON.stringify({ zn_servers: JSON.stringify([{ id: serverId, name: "247420", icon, iconColor: "#5865F2" }]) }), { mode: 0o600 });
  const storage = fileStorage(dir);
  storage.setItem("zn_servers", JSON.stringify([{ id: serverId, name: "247420", iconColor: "#5865F2" }]));
  const values = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  const servers = JSON.parse(values.zn_servers) as Array<{ id: string; icon: string }>;
  assert.equal(servers[0].icon, icon);
});

test("node storage writes non-server keys from current file", () => {
  const dir = mkdtempSync(join(tmpdir(), "zdb-storage-"));
  const path = join(dir, "wireweave-storage.json");
  writeFileSync(path, JSON.stringify({ zn_pk: "owner" }), { mode: 0o600 });
  const storage = fileStorage(dir);
  storage.setItem("zn_unread", "[]");
  const values = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  assert.equal(values.zn_pk, "owner");
  assert.equal(values.zn_unread, "[]");
});
