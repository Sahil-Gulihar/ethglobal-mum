/**
 * MCP prompts: ready-made tasks clients show as slash commands (for example /mcp__whitechain__integrate_whitechain).
 * They only produce instructions; the work happens through the tools.
 */
import "server-only";
import type { Merchant } from "@/lib/auth";
import { INTEGRATION_MODES, INTEGRATION_STACKS } from "@/lib/agent/integration-guide";

type PromptArg = { name: string; description: string; required?: boolean };
type Prompt = { name: string; title: string; description: string; arguments: PromptArg[]; render: (args: Record<string, string>, m: Merchant) => string };

const oneOf = <T extends { id: string }>(list: T[], v: string | undefined) => (v && list.some((x) => x.id === v) ? v : undefined);

export const prompts: Prompt[] = [
  {
    name: "integrate_whitechain",
    title: "Integrate White Money checkout",
    description: "Add USDT checkout to the current codebase end to end: server route, checkout UI, verified webhooks and a testnet test.",
    arguments: [
      { name: "stack", description: `Repo stack: ${INTEGRATION_STACKS.map((s) => s.id).join(", ")}. Leave empty to detect it.` },
      { name: "mode", description: `How customers pay: ${INTEGRATION_MODES.map((x) => x.id).join(", ")}. Leave empty for the default.` },
    ],
    render: (a, m) => {
      const stack = oneOf(INTEGRATION_STACKS, a.stack);
      const mode = oneOf(INTEGRATION_MODES, a.mode);
      return [
        `Integrate White Money checkout into this codebase for the merchant "${m.name}".`,
        "",
        stack ? `The stack is ${stack}.` : "First inspect the repo and decide which stack it is: nextjs, react-node, node or other.",
        `Then call the whitechain tool get_integration_guide with that stack${mode ? ` and mode "${mode}"` : ""} and follow the guide exactly.`,
        "Use the other whitechain tools for the account steps: get_account to check the account can take payments, create_webhook_endpoint once the webhook route is reachable, send_test_webhook to prove signature verification works, and create_checkout_session plus wait_for_payment to test a real testnet payment.",
        "Never write the secret key or webhook secret into source files; put them in the environment and the example env file without values.",
        "If get_account lists humanActions, stop and show those links to me before continuing.",
        "Finish with the guide's checklist and tell me what you changed.",
      ].join("\n");
    },
  },
  {
    name: "get_paid",
    title: "Get paid",
    description: "Create a payment link or checkout for an amount, share it, and confirm when the payment lands onchain.",
    arguments: [
      { name: "amount", description: 'Amount in USDT, e.g. "25.00".', required: true },
      { name: "for", description: "What the customer is paying for.", required: true },
    ],
    render: (a) =>
      [
        `I want to get paid ${a.amount ?? "the amount I tell you"} USDT for "${a.for ?? "my order"}".`,
        "Check my account with get_account. Create a payment link with create_payment_link and give me the URL to share.",
        "Then wait for the payment with wait_for_payment (call it again if it times out, up to a few times) and confirm with the payment id, payer wallet and explorer link once it lands.",
      ].join("\n"),
  },
];
