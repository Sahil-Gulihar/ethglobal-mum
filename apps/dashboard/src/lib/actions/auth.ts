"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { chainMerchantId } from "@whitechain-commerce/core";
import { db, merchants } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  values?: { name?: string; email?: string };
};

const signupSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(80, "Keep it under 80 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

function fieldErrors(err: z.ZodError): AuthFormState["fieldErrors"] {
  const out: AuthFormState["fieldErrors"] = {};
  for (const issue of err.issues) {
    const k = issue.path[0];
    if ((k === "name" || k === "email" || k === "password") && !out[k]) out[k] = issue.message;
  }
  return out;
}

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object" && cur !== null && "code" in cur && (cur as { code?: string }).code === "23505") return true;
    cur = typeof cur === "object" && cur !== null && "cause" in cur ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const values = { name: raw.name, email: raw.email };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { name, email, password } = parsed.data;

  const [existing] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email)).limit(1);
  if (existing) return { fieldErrors: { email: "An account with this email already exists. Log in instead." }, values };

  const id = newId("mer");
  try {
    await db.insert(merchants).values({
      id,
      email,
      name,
      passwordHash: await hashPassword(password),
      chainMerchantId: chainMerchantId(id),
      status: env.skipWorldId() ? "active" : "pending",
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { email: "An account with this email already exists. Log in instead." }, values };
    console.error("signup failed", e);
    return { error: "We couldn't create your account. Try again.", values };
  }
  await startSession(id);
  redirect("/dashboard");
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const [m] = await db.select().from(merchants).where(eq(merchants.email, parsed.data.email)).limit(1);
  const ok = m ? await verifyPassword(parsed.data.password, m.passwordHash) : false;
  if (!m || !ok) return { error: "Incorrect email or password.", values };

  await startSession(m.id);
  const next = String(formData.get("next") ?? "");
  // Same-origin paths only: /dashboard... or the agent approval page.
  redirect(next.startsWith("/dashboard") || next.startsWith("/connect?") ? next : "/dashboard");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
