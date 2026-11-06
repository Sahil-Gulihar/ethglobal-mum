/** Copy-paste setup for every agent client. Shared by /dashboard/agents; docs/developers/agents.md mirrors it. */

export const KEY_PLACEHOLDER = "sk_test_...";

export type AgentClient = { id: string; name: string; where: string; filename?: string; code: string; note?: string };

export function agentClients(base: string): AgentClient[] {
  const url = `${base}/api/mcp`;
  return [
    {
      id: "repo",
      name: "Any repository",
      where: "Run in the repo root. Writes .mcp.json, .cursor/mcp.json, .vscode/mcp.json and an AGENTS.md section that read your key from WC_SECRET_KEY.",
      filename: "terminal",
      code: `npx @whitechain-commerce/mcp init${base === DEFAULT_BASE ? "" : ` --base-url=${base}`}\nexport WC_SECRET_KEY=${KEY_PLACEHOLDER}`,
    },
    {
      id: "login",
      name: "Connect with approval",
      where: "No key to copy: the agent makes its own key, you approve it on a /connect page after matching a code, and it can save WC_SECRET_KEY for you.",
      filename: "terminal",
      code: `npx @whitechain-commerce/mcp login --name="My agent" --save=.env.local${base === DEFAULT_BASE ? "" : ` \\\n  --base-url=${base}`}`,
    },
    {
      id: "claude-code",
      name: "Claude Code",
      where: "One command. Add --scope project to share it with your team through .mcp.json.",
      filename: "terminal",
      code: `claude mcp add --transport http whitechain ${url} \\\n  --header "Authorization: Bearer $WC_SECRET_KEY"`,
    },
    {
      id: "connector",
      name: "Claude and ChatGPT connectors",
      where: "Settings > Connectors > Add custom connector, then paste this URL with your key in it. Treat the URL like a password.",
      filename: "connector URL",
      code: `${url}/${KEY_PLACEHOLDER}`,
    },
    {
      id: "cursor",
      name: "Cursor",
      where: "Project file. Cursor expands ${env:...} from your shell.",
      filename: ".cursor/mcp.json",
      code: JSON.stringify({ mcpServers: { whitechain: { url, headers: { Authorization: "Bearer ${env:WC_SECRET_KEY}" } } } }, null, 2),
    },
    {
      id: "vscode",
      name: "VS Code",
      where: "Project file. VS Code asks for the key once and keeps it in secret storage.",
      filename: ".vscode/mcp.json",
      code: JSON.stringify(
        {
          inputs: [{ type: "promptString", id: "whitechain-secret-key", description: "Whitechain Commerce secret key", password: true }],
          servers: { whitechain: { type: "http", url, headers: { Authorization: "Bearer ${input:whitechain-secret-key}" } } },
        },
        null,
        2,
      ),
    },
    {
      id: "stdio",
      name: "Claude Desktop and other stdio clients",
      where: "For clients that only start local commands.",
      filename: "claude_desktop_config.json",
      code: JSON.stringify(
        {
          mcpServers: {
            whitechain: {
              command: "npx",
              args: ["-y", "@whitechain-commerce/mcp"],
              env: { WC_SECRET_KEY: KEY_PLACEHOLDER, ...(base === DEFAULT_BASE ? {} : { WC_API_BASE: base }) },
            },
          },
        },
        null,
        2,
      ),
    },
  ];
}

export const DEFAULT_BASE = "https://whitechain-dashboard.vercel.app";

export const sdkSnippets = (base: string): { id: string; name: string; filename: string; code: string }[] => [
  {
    id: "messages",
    name: "Claude Messages API",
    filename: "agent.ts",
    code: `import Anthropic from "@anthropic-ai/sdk";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const client = new Anthropic();
const whitechain = new WhitechainAgentToolkit(); // reads WC_SECRET_KEY

const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Make a 25 USDT payment link for a consulting call" },
];
const tools = await whitechain.anthropicTools();

while (true) {
  const res = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 1024, tools, messages });
  messages.push({ role: "assistant", content: res.content });
  if (res.stop_reason !== "tool_use") break;
  const results = await Promise.all(
    res.content.filter((b) => b.type === "tool_use").map((b) => whitechain.handleAnthropicToolUse(b)),
  );
  messages.push({ role: "user", content: results });
}`,
  },
  {
    id: "ai-sdk",
    name: "Vercel AI SDK",
    filename: "agent.ts",
    code: `import { generateText, jsonSchema, stepCountIs } from "ai";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const whitechain = new WhitechainAgentToolkit();

const { text } = await generateText({
  model: "anthropic/claude-opus-5-5",
  tools: await whitechain.aiSdkTools(jsonSchema),
  stopWhen: stepCountIs(5),
  prompt: "How much did I sell this week, and which payment link earned the most?",
});`,
  },
  {
    id: "openai",
    name: "OpenAI",
    filename: "agent.ts",
    code: `import OpenAI from "openai";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const openai = new OpenAI();
const whitechain = new WhitechainAgentToolkit();

const res = await openai.chat.completions.create({
  model: "gpt-5",
  tools: await whitechain.openAITools(),
  messages: [{ role: "user", content: "Create a 49.99 USDT checkout for order 1042" }],
});
for (const call of res.choices[0].message.tool_calls ?? []) {
  const toolMessage = await whitechain.handleOpenAIToolCall(call);
  // append toolMessage to messages and call the model again
}`,
  },
  {
    id: "http",
    name: "Raw HTTP",
    filename: "terminal",
    code: `curl -X POST ${base}/api/mcp \\
  -H "Authorization: Bearer $WC_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_sales_summary","arguments":{}}}'`,
  },
];

/** One-line prompts that hand a coding agent the integration guide for each stack. */
export function integrationPrompts(base: string) {
  const stacks = [
    { id: "nextjs", name: "Next.js" },
    { id: "react-node", name: "React + Node.js" },
    { id: "node", name: "Node.js server" },
    { id: "other", name: "Any other stack" },
  ];
  return [
    ...stacks.map((s) => ({
      id: s.id,
      name: s.name,
      code: `Read ${base}/integrate.md?stack=${s.id} and integrate Whitechain Commerce checkout into this repo. Follow it end to end and finish with its checklist.`,
    })),
    {
      id: "payment-link",
      name: "No code: payment link",
      code: `Read ${base}/integrate.md?mode=payment-link and add a "Pay with USDT" button to this site that uses a Whitechain Commerce payment link.`,
    },
  ];
}
