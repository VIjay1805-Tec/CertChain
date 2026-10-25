import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCertificateWithAI } from "../dist/services/aiForgeryService.js";

test("rejects a missing IPFS URL", async () => {
  await assert.rejects(
    analyzeCertificateWithAI("", ""),
    /Certificate IPFS URL is missing/
  );
});

test("rejects an IPFS download with HTTP 404", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("Not found", { status: 404 });

  try {
    await assert.rejects(
      analyzeCertificateWithAI("https://example.test/certificate.pdf", ""),
      /Unable to download certificate from IPFS: 404/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an empty downloaded certificate", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Uint8Array(0), { status: 200 });

  try {
    await assert.rejects(
      analyzeCertificateWithAI("https://example.test/empty.pdf", ""),
      /Downloaded certificate is empty/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
