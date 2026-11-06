import { buyerBalance, getCurrentBuyer, isVerified, signInWithZg, signOutBuyer } from "@/lib/zg/buyers";

/** The signed-in 0G buyer, with a live balance read from their 0G account. */
export async function GET() {
  const b = await getCurrentBuyer();
  if (!b) return Response.json({ buyer: null });
  const bal = await buyerBalance(b);
  return Response.json({
    buyer: { address: b.zgAddress, verified: isVerified(b), verifiedAt: b.verifiedAt, checksPassed: b.checksPassed },
    balance: bal ? { total: bal.total, credit: bal.credit, currency: bal.currency } : null,
  });
}

/** Sign in with 0G: `{ managementKey: "mk-..." }`. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { managementKey?: unknown } | null;
  if (!body || typeof body.managementKey !== "string") {
    return Response.json({ error: { message: "Paste your 0G management key." } }, { status: 400 });
  }
  try {
    const r = await signInWithZg(body.managementKey);
    if (!r.ok) return Response.json({ error: { message: r.message } }, { status: 400 });
    return Response.json({
      buyer: { address: r.buyer.zgAddress, verified: isVerified(r.buyer), verifiedAt: r.buyer.verifiedAt, checksPassed: r.buyer.checksPassed },
      balance: { total: r.balance.total, credit: r.balance.credit, currency: r.balance.currency },
    });
  } catch (e) {
    console.error("[buyer] sign in", e);
    return Response.json({ error: { message: "Something went wrong. Try again." } }, { status: 500 });
  }
}

export async function DELETE() {
  await signOutBuyer();
  return Response.json({ buyer: null });
}
