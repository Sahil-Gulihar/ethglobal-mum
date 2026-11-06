import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (await getCurrentMerchant()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl leading-8 font-[450] tracking-[-0.04em] text-foreground">Log in to Whitechain Commerce</h1>
        <p className="text-sm leading-5 text-muted-foreground">Manage payments, refunds and developer settings.</p>
      </div>
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
