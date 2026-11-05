import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.window;
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function client() {
  globalThis.window = new EventTarget();
  const result = await build({
    entryPoints: ["src/lib/api.ts"],
    bundle: true,
    format: "esm",
    write: false,
    define: { "import.meta.env.VITE_API_URL": '"/api"' },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}#${crypto.randomUUID()}`
  );
}
test("expired access on profile update refreshes and retries with the same body", async () => {
  const api = await client();
  api.setAccessToken("expired");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/refresh"))
      return json({ access_token: "renewed", user: { id: "owner" } });
    if (options.headers.Authorization === "Bearer expired")
      return json({ detail: "Expired" }, 401);
    return json({ full_name: "Updated owner" });
  };
  const response = await api.send("/auth/me", "PUT", {
    full_name: "Updated owner",
  });
  assert.equal(response.full_name, "Updated owner");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, "/api/auth/refresh");
  assert.equal(calls[2].options.headers.Authorization, "Bearer renewed");
  assert.equal(calls[2].options.body, calls[0].options.body);
  assert.equal(calls[1].options.credentials, "include");
});
test("concurrent expired requests share one refresh operation", async () => {
  const api = await client();
  api.setAccessToken("expired");
  let refreshes = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/refresh")) {
      refreshes++;
      await gate;
      return json({ access_token: "renewed", user: { id: "owner" } });
    }
    return options.headers.Authorization === "Bearer expired"
      ? json({ detail: "Expired" }, 401)
      : json({ items: [], total: 0 });
  };
  const first = api.api("/clients");
  const second = api.api("/deals");
  await new Promise(setImmediate);
  assert.equal(refreshes, 1);
  release();
  const responses = await Promise.all([first, second]);
  assert.ok(responses.every((response) => response.total === 0));
  assert.equal(refreshes, 1);
});
test("a revoked refresh session clears access and announces session expiry", async () => {
  const api = await client();
  let expired = 0;
  window.addEventListener("session-expired", () => expired++);
  api.setAccessToken("revoked");
  globalThis.fetch = async () => json({ detail: "Session revoked" }, 401);
  await assert.rejects(api.api("/clients"), (error) => error.status === 401);
  assert.equal(expired, 1);
});
