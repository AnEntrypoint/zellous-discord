import test from "node:test";
import assert from "node:assert/strict";
import { redactText } from "../../src/redaction.js";
import { Logger } from "../../src/logger.js";
import { tokenLike } from "../fixtures/token-like.js";

const nl = String.fromCharCode(10);

test("redaction removes token-like strings", () => {
  const fake = tokenLike();
  const redacted = redactText("authorization " + fake);
  assert.equal(redacted.includes(fake), false);
  assert.match(redacted, /REDACTED/);
});

test("logger never emits a secret", () => {
  const fake = tokenLike();
  const lines: string[] = [];
  const logger = new Logger("debug", (line) => lines.push(line));
  logger.info("connecting", { token: fake, nested: { value: fake } });
  assert.equal(lines.join(nl).includes(fake), false);
  assert.match(lines.join(nl), /REDACTED/);
});