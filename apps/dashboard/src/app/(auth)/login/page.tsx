import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (await getCurrentMerchant()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="flex flex-col gap-8 animate-fade-up">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to manage payments, refunds and developer settings.</p>
      </div>
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
