// Shared helpers for /api/v1 route handlers (not a route: Next only routes files named route.ts).
import type { z } from "zod";
import { apiError, corsHeaders } from "@/lib/api-auth";

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

/** CORS preflight; export as OPTIONS from every v1 route. */
export const preflight = () => new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" } });

export const unauthorized = () =>
  apiError(401, "authentication", "Missing or invalid API key. Send `Authorization: Bearer sk_test_...`.");

/** Parses the JSON body against a zod schema; returns the data or a 400 Response. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "invalid_request", "Request body must be valid JSON.");
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return apiError(400, "invalid_request", msg);
  }
  return r.data;
}

/** Wraps a handler so unexpected errors become a JSON 500 with CORS headers. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error("[api/v1]", e);
      return apiError(500, "server_error", "Internal server error.");
    }
  };
}
