import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/**
 * SSRF guard for merchant-supplied webhook URLs. In production, webhook URLs must resolve only to
 * public addresses (no loopback, private, link-local/metadata, CGNAT, multicast, reserved ranges).
 * Outside production (or with ALLOW_PRIVATE_WEBHOOK_URLS=true) localhost etc. are allowed so the
 * demo store at http://localhost:3001 works.
 *
 * Checked when the endpoint is created and again before every delivery (DNS can change).
 */
// Separate lists: Node's BlockList checks IPv4 addresses against IPv6 rules too (as ::ffff:a.b.c.d).
const blocked4 = new BlockList();
const blocked6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked4.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96], // IPv4-mapped literals: never needed for a real webhook host
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked6.addSubnet(net, prefix, "ipv6");
}

export function allowPrivateWebhookUrls(): boolean {
  return process.env.ALLOW_PRIVATE_WEBHOOK_URLS === "true" || process.env.NODE_ENV !== "production";
}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return blocked4.check(ip, "ipv4");
  if (v === 6) return blocked6.check(ip, "ipv6");
  return true; // not an IP: treat as unsafe
}

/** Returns null if the URL may be called, or a human-readable reason it may not. */
export async function checkWebhookUrl(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Invalid URL.";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Only http(s) URLs are supported.";
  if (allowPrivateWebhookUrls()) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local"))
    return "Webhook URLs must point to a public host.";
  let addrs: string[];
  try {
    addrs = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    return `Couldn't resolve ${host}.`;
  }
  if (!addrs.length || addrs.some(isPrivateAddress)) return "Webhook URLs must resolve to a public IP address.";
  return null;
}
