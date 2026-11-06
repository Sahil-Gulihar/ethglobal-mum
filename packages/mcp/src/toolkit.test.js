// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { WhitechainAgentToolkit } from "./index.js";

/** A fake MCP endpoint that records requests. */
function fakeFetch() {
  /** @type {any[]} */
  const seen = [];
  /** @type {typeof fetch} */
  const f = async (url, init) => {
    const msg = JSON.parse(String(init?.body));
    seen.push({ url, auth: /** @type {any} */ (init?.headers).Authorization, msg });
    const result =
      msg.method === "tools/list"
        ? { tools: [{ name: "get_account", description: "Account", inputSchema: { type: "object", properties: {} } }] }
        : msg.params.name === "bad"
          ? { content: [{ type: "text", text: "nope" }], isError: true }
          : { content: [{ type: "text", text: '{"a":1}' }], structuredContent: { a: 1 } };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
  };
  return { f, seen };
}

test("lists tools and formats them for each SDK", async () => {
  const { f, seen } = fakeFetch();
  const tk = new WhitechainAgentToolkit({ secretKey: "sk_test_x", baseUrl: "https://ex.com/", fetch: f });
  assert.equal(tk.endpoint, "https://ex.com/api/mcp");
  assert.deepEqual(await tk.anthropicTools(), [{ name: "get_account", description: "Account", input_schema: { type: "object", properties: {} } }]);
  assert.equal((await tk.openAITools())[0].function.name, "get_account");
  const ai = await tk.aiSdkTools((s) => ({ wrapped: s }));
  assert.deepEqual(ai.get_account.inputSchema, { wrapped: { type: "object", properties: {} } });
  assert.equal(seen.filter((s) => s.msg.method === "tools/list").length, 1, "tools/list is cached");
  assert.equal(seen[0].auth, "Bearer sk_test_x");
});

test("tool errors come back as ok:false, not exceptions", async () => {
  const { f } = fakeFetch();
  const tk = new WhitechainAgentToolkit({ secretKey: "sk_test_x", fetch: f });
  assert.deepEqual(await tk.callTool("get_account"), { ok: true, data: { a: 1 }, text: '{"a":1}' });
  const r = await tk.handleAnthropicToolUse({ id: "tu_1", name: "bad", input: {} });
  assert.deepEqual(r, { type: "tool_result", tool_use_id: "tu_1", content: "nope", is_error: true });
  const o = await tk.handleOpenAIToolCall({ id: "c1", function: { name: "get_account", arguments: "{}" } });
  assert.equal(o.tool_call_id, "c1");
});

test("requires a secret key", () => {
  const prev = process.env.WC_SECRET_KEY;
  delete process.env.WC_SECRET_KEY;
  assert.throws(() => new WhitechainAgentToolkit({}), /No secret key/);
  if (prev) process.env.WC_SECRET_KEY = prev;
});
