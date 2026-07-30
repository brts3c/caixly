import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderiza o produto Caixly com metadados próprios", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Caixly — PDV simples para vender melhor<\/title>/i);
  assert.match(html, /Caixly/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("a implementação segura não contém credenciais ou identidade demonstrativa", async () => {
  const [portal, auth] = await Promise.all([
    readFile(new URL("../app/SecurePortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CaixlyApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(portal, /Mariana Costa|Bosque Açaí|demo@caixly/i);
  assert.match(portal, /platformOwner/);
  assert.match(portal, /canAccessRoute/);
  assert.match(portal, /PLAN_LIMITS/);
  assert.match(auth, /SecurePortal/);
});
