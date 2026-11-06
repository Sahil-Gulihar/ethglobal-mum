// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { connectCode, sha256Hex, startConnect } from "./index.js";

const sha = (/** @type {string} */ s) => createHash("sha256").update(s).digest("hex");

/** Fake /api/mcp: 401 (-32001) until `approveAfter` calls have been made, then get_account succeeds. */
function fakeServer(approveAfter = 2) {
  /** @type {{ url: string; auth: string; msg: any }[]} */
  const seen = [];
  /** @type {typeof fetch} */
  const f = async (url, init) => {
    const msg = JSON.parse(String(init?.body));
    seen.push({ url: String(url), auth: /** @type {any} */ (init?.headers).Authorization, msg });
    if (seen.length <= approveAfter)
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid API key." } }), { status: 401 });
    const data = { businessName: "Acme", status: "active" };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data } }));
  };
  return { f, seen };
}

test("connectCode matches the dashboard's node:crypto derivation", async () => {
  const hash = sha("sk_test_example");
  const hex = sha(`wc-connect:${hash}`).slice(0, 8).toUpperCase();
  assert.equal(await connectCode(hash), `${hex.slice(0, 4)}-${hex.slice(4)}`);
  assert.equal(await sha256Hex("abc"), sha("abc"));
});

test("startConnect makes a local key and a URL that carries only its hash", async () => {
  const c = await startConnect({ baseUrl: "https://ex.com/", clientName: "  My agent & co  " });
  assert.match(c.secretKey, /^sk_test_[A-Za-z0-9]{32}$/);
  const url = new URL(c.approveUrl);
  assert.equal(url.origin + url.pathname, "https://ex.com/connect");
  assert.equal(url.searchParams.get("h"), sha(c.secretKey));
  assert.equal(url.searchParams.get("p"), c.secretKey.slice(0, 12));
  assert.match(url.searchParams.get("p") ?? "", /^sk_test_[A-Za-z0-9]{4}$/);
  assert.equal(url.searchParams.get("n"), "My agent & co");
  assert.ok(!c.approveUrl.includes(c.secretKey), "the key is never in the URL");
  assert.equal(c.code, await connectCode(sha(c.secretKey)));
  assert.match(c.code, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  const other = await startConnect({ baseUrl: "https://ex.com" });
  assert.notEqual(other.secretKey, c.secretKey);
});

test("waitForApproval polls get_account until the key stops returning 401", async () => {
  const { f, seen } = fakeServer(2);
  const c = await startConnect({ baseUrl: "https://ex.com", clientName: "t", fetch: f });
  const account = await c.waitForApproval({ intervalMs: 1 });
  assert.deepEqual(account, { businessName: "Acme", status: "active" });
  assert.equal(seen.length, 3);
  for (const s of seen) {
    assert.equal(s.url, "https://ex.com/api/mcp");
    assert.equal(s.auth, `Bearer ${c.secretKey}`);
    assert.equal(s.msg.method, "tools/call");
    assert.equal(s.msg.params.name, "get_account");
  }
});

test("waitForApproval rejects on timeout and on abort", async () => {
  const { f } = fakeServer(Infinity);
  const c = await startConnect({ baseUrl: "https://ex.com", fetch: f });
  await assert.rejects(c.waitForApproval({ timeoutMs: 30, intervalMs: 5 }), /Not approved within/);
  const ac = new AbortController();
  const p = c.waitForApproval({ intervalMs: 1000, signal: ac.signal });
  setTimeout(() => ac.abort(new Error("stop")), 10);
  await assert.rejects(p, /stop/);
});

test("waitForApproval surfaces other server errors instead of polling forever", async () => {
  /** @type {typeof fetch} */
  const f = async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32603, message: "boom" } }), { status: 500 });
  const c = await startConnect({ baseUrl: "https://ex.com", fetch: f });
  await assert.rejects(c.waitForApproval({ intervalMs: 1 }), /boom/);
});
