import { bearerKey, handleMcpPost, mcpGet, mcpPreflight } from "@/lib/mcp/server";

/** MCP endpoint for clients that can send headers: `Authorization: Bearer sk_test_...`. */
export const POST = (req: Request) => handleMcpPost(req, bearerKey(req));
export const GET = mcpGet;
export const DELETE = mcpGet;
export const OPTIONS = mcpPreflight;
