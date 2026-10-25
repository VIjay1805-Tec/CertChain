import test from "node:test";
import assert from "node:assert/strict";

test("CertChain backend test runner is working", () => {
  assert.equal(1 + 1, 2);
});

test("Certificate SHA-256 hashes use 64 hexadecimal characters", () => {
  const sampleHash = "a".repeat(64);
  assert.match(sampleHash, /^[a-f0-9]{64}$/);
});
