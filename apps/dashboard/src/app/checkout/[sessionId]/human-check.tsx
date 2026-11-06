"use client";

import { useEffect, useRef, useState } from "react";
import { formatZgAmount } from "@/lib/zg/format";
import { VerifiedBuyerBadge } from "@/components/verified-buyer-badge";

type Call = { kind: "image" | "transcribe" | "judge"; model: string; requestId: string | null };
type BuyerInfo = {
  buyer: { address: string; verified: boolean; checksPassed: number } | null;
  balance?: { total: string; credit: string; currency: string } | null;
};
type Challenge = { checkId: string; image: string; question: string; payer: "buyer" | "platform"; calls: Call[]; balance: string | null; currency: string | null };
type Outcome = {
  passed: boolean;
  reason: string;
  transcript: string | null;
  attemptsLeft: number;
  calls: Call[];
  payer: "buyer" | "platform";
  balanceBefore: string | null;
  balanceAfter: string | null;
  currency: string | null;
};

const KIND_LABEL: Record<Call["kind"], string> = { image: "Picture", transcribe: "Voice", judge: "Answer check" };
const RECORD_MS = 6000;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || `Request failed (${res.status})`);
  return body;
}

export function HumanCheck({ sessionId, required, onVerified }: { sessionId: string; required: boolean; onVerified: () => void }) {
  const [me, setMe] = useState<BuyerInfo | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [mk, setMk] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<null | "signin" | "start" | "answer" | "record">(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [open, setOpen] = useState(required);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    api<BuyerInfo>("/api/buyer").then(setMe, () => setMe({ buyer: null }));
  }, []);

  function done() {
    setVerified(true);
    onVerified();
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy("signin");
    setError(null);
    try {
      const r = await api<BuyerInfo>("/api/buyer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ managementKey: mk }) });
      setMe(r);
      setMk("");
      setSigningIn(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await api("/api/buyer", { method: "DELETE" }).catch(() => undefined);
    setMe({ buyer: null });
  }

  async function start() {
    setBusy("start");
    setError(null);
    setOutcome(null);
    setAnswer("");
    try {
      const r = await api<({ verified: true; via: string }) | ({ verified: false } & Challenge)>(`/api/checkout/${sessionId}/human-check`, { method: "POST" });
      if (r.verified) done();
      else setChallenge(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit(body: BodyInit, headers?: HeadersInit) {
    if (!challenge) return;
    setBusy("answer");
    setError(null);
    try {
      const r = await api<Outcome>(`/api/checkout/${sessionId}/human-check/${challenge.checkId}`, { method: "POST", body, headers });
      setOutcome(r);
      if (r.transcript) setAnswer(r.transcript);
      if (r.balanceAfter && me?.balance) setMe({ ...me, balance: { ...me.balance, total: r.balanceAfter } });
      if (r.passed) setTimeout(done, 1600);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function record() {
    if (recorder.current) {
      recorder.current.stop();
      return;
    }
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Type your answer instead.");
      return;
    }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", blob, `answer.${ext}`);
      void submit(form);
    };
    recorder.current = rec;
    setBusy("record");
    rec.start();
    setTimeout(() => rec.state === "recording" && rec.stop(), RECORD_MS);
  }

  const calls = outcome?.calls ?? challenge?.calls ?? [];
  const exhausted = outcome && !outcome.passed && outcome.attemptsLeft === 0;
  const currency = outcome?.currency ?? challenge?.currency ?? me?.balance?.currency ?? "0g";

  if (verified) {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <VerifiedBuyerBadge />
        <span className="text-xs text-muted-foreground">Checked on 0G Private Computer</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
        <div className="min-w-0">
          <div className="font-medium">Get the Verified buyer badge</div>
          <div className="text-xs text-muted-foreground">Optional 10-second human check on 0G. The store sees it on your order.</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="h-8 shrink-0 rounded-md border px-3 text-xs font-semibold hover:bg-accent">
          Verify
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border bg-card text-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{required ? "Quick human check" : "Become a verified buyer"}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {required
              ? "This store only takes payments from people. Tell us what's in a fresh AI picture."
              : "Optional. Pass a quick check and the store sees a Verified buyer badge on your order."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">0G · TEE</span>
      </div>

      {/* 0G account */}
      <div className="mx-5 mt-4 rounded-md border px-3.5 py-3">
        {me === null ? (
          <div className="h-5 animate-pulse rounded bg-muted" />
        ) : me.buyer ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                0G account <span className="font-mono text-xs text-muted-foreground">{me.buyer.address.slice(0, 6)}…{me.buyer.address.slice(-4)}</span>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                Credit balance <span className="font-medium text-foreground">{formatZgAmount(me.balance?.total, me.balance?.currency)}</span>
                {me.buyer.verified && " · badge active"}
              </div>
            </div>
            <button type="button" onClick={signOut} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </div>
        ) : signingIn ? (
          <form onSubmit={signIn} className="grid gap-2">
            <label className="grid gap-1 text-xs font-medium">
              0G management key
              <input
                value={mk}
                onChange={(e) => setMk(e.target.value)}
                placeholder="mk-…"
                autoComplete="off"
                spellCheck={false}
                className="h-9 rounded-md border bg-background px-3 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Create one at{" "}
              <a href="https://pc.0g.ai/dashboard/api-keys" target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
                pc.0g.ai → API keys
              </a>{" "}
              with the <code>account:read</code> and <code>keys:create</code> scopes. We create a key capped to 0.5 per day on your account
              and only use it for this check.
            </p>
            <div className="flex gap-2">
              <button disabled={busy === "signin" || !mk} className="h-9 rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">
                {busy === "signin" ? "Connecting…" : "Connect"}
              </button>
              <button type="button" onClick={() => setSigningIn(false)} className="h-9 px-2 text-[13px] text-muted-foreground">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Use your own 0G credits and keep the badge across every Whitechain store.</p>
            <button type="button" onClick={() => setSigningIn(true)} className="h-8 shrink-0 rounded-md border px-3 text-xs font-semibold hover:bg-accent">
              Sign in with 0G
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-5">
        {!challenge ? (
          <button
            type="button"
            onClick={start}
            disabled={busy === "start"}
            className="h-11 w-full rounded-md bg-primary text-[14px] font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {busy === "start" ? "Drawing a fresh picture on 0G…" : me?.buyer?.verified ? "Use my Verified buyer badge" : "Start human check"}
          </button>
        ) : (
          <div className="grid gap-3">
            <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={challenge.image} alt="Your challenge picture" className="size-full object-cover" draggable={false} />
            </div>
            <p className="font-medium">{challenge.question}</p>
            {outcome?.passed ? (
              <div className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2.5 text-success">
                <VerifiedBuyerBadge />
                <span className="text-xs font-medium">Unlocking payment…</span>
              </div>
            ) : exhausted ? (
              <button type="button" onClick={start} disabled={busy === "start"} className="h-10 rounded-md border font-semibold hover:bg-accent disabled:opacity-60">
                {busy === "start" ? "Drawing…" : "Try a new picture"}
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(JSON.stringify({ answer }), { "content-type": "application/json" });
                }}
                className="flex gap-2"
              >
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="e.g. a green umbrella"
                  aria-label="Your answer"
                  className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={record}
                  disabled={busy === "answer"}
                  aria-label={busy === "record" ? "Stop recording" : "Say your answer"}
                  title="Say your answer (Whisper on 0G)"
                  className={`grid size-10 place-items-center rounded-md border ${busy === "record" ? "border-destructive text-destructive" : "hover:bg-accent"}`}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </button>
                <button disabled={!answer.trim() || !!busy} className="h-10 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
                  {busy === "answer" ? "Checking…" : "Submit"}
                </button>
              </form>
            )}
            {outcome && !outcome.passed && (
              <p className="text-[13px] text-destructive" role="status">
                {outcome.reason} {outcome.attemptsLeft > 0 && `${outcome.attemptsLeft} ${outcome.attemptsLeft === 1 ? "try" : "tries"} left.`}
              </p>
            )}
            {busy === "record" && <p className="text-xs text-muted-foreground">Listening… say the object and its colour.</p>}
          </div>
        )}

        {error && (
          <p className="mt-3 text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}

        {calls.length > 0 && (
          <details className="mt-4 rounded-md border px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Paid by {(outcome?.payer ?? challenge?.payer) === "buyer" ? "your 0G account" : "the store's 0G credits"} · {calls.length} 0G {calls.length === 1 ? "request" : "requests"}
            </summary>
            <ul className="mt-2 grid gap-1">
              {calls.map((c, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {KIND_LABEL[c.kind]} <span className="text-muted-foreground/80">({c.model})</span>
                  </span>
                  <code className="truncate font-mono">{c.requestId ?? "n/a"}</code>
                </li>
              ))}
              {outcome?.balanceBefore && outcome.balanceAfter && (
                <li className="mt-1 flex justify-between gap-3 border-t pt-1.5 tabular-nums">
                  <span>Your 0G balance</span>
                  <span>
                    {formatZgAmount(outcome.balanceBefore, currency)} → <span className="font-medium text-foreground">{formatZgAmount(outcome.balanceAfter, currency)}</span>
                  </span>
                </li>
              )}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
