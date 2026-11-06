import {
  INTEGRATION_MODES,
  INTEGRATION_STACKS,
  integrationGuide,
  type IntegrationMode,
  type IntegrationStack,
} from "@/lib/agent/integration-guide";
import { env } from "@/lib/env";

/**
 * GET /integrate.md?stack=nextjs|react-node|node|other&mode=widget|hosted|payment-link
 * Public Markdown prompt that coding agents follow to integrate Whitechain Commerce into a repo.
 */
export function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const stackParam = params.get("stack");
  const modeParam = params.get("mode");

  const stack = INTEGRATION_STACKS.find((s) => s.id === stackParam)?.id;
  const mode = INTEGRATION_MODES.find((m) => m.id === modeParam)?.id;
  const invalid = [
    stackParam && !stack ? `stack must be one of ${INTEGRATION_STACKS.map((s) => s.id).join(", ")}` : null,
    modeParam && !mode ? `mode must be one of ${INTEGRATION_MODES.map((m) => m.id).join(", ")}` : null,
  ].filter(Boolean);
  if (invalid.length)
    return new Response(`Invalid query: ${invalid.join("; ")}.\n`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  const body = integrationGuide({
    baseUrl: env.appUrl().replace(/\/+$/, ""),
    stack: (stack ?? "other") as IntegrationStack,
    mode: mode as IntegrationMode | undefined,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
