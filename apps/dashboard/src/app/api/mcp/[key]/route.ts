import { bearerKey, handleMcpPost, mcpGet, mcpPreflight } from "@/lib/mcp/server";

type Ctx = { params: Promise<{ key: string }> };

/**
 * Connector URL: /api/mcp/sk_test_... for clients that only take a URL (Claude and ChatGPT custom
 * connectors). The key in the path is a secret; a header key still wins if both are sent.
 */
export const POST = async (req: Request, ctx: Ctx) => handleMcpPost(req, bearerKey(req) ?? (await ctx.params).key);
export const GET = mcpGet;
export const DELETE = mcpGet;
export const OPTIONS = mcpPreflight;
