import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCurrentMerchant()) redirect("/dashboard");
  return (
    <div className="flex flex-col gap-8 animate-fade-up">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Start accepting USDT</h1>
        <p className="text-sm text-muted-foreground">Create a merchant account. You&apos;ll connect a payout wallet and get API keys next.</p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
