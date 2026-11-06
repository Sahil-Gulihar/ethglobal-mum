import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCurrentMerchant()) redirect("/dashboard");
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl leading-8 font-[450] tracking-[-0.04em] text-foreground">Create a merchant account</h1>
        <p className="text-sm leading-5 text-muted-foreground">Start accepting USDT. You&apos;ll connect a payout wallet and get API keys next.</p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
