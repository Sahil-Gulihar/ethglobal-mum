"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "signup" ? signupAction : loginAction, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "signup" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="organization"
            placeholder="Acme Coffee Co."
            defaultValue={state.values?.name}
            aria-invalid={!!fe.name}
            aria-describedby={fe.name ? "name-error" : undefined}
            required
          />
          <FieldError id="name-error">{fe.name}</FieldError>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
          aria-describedby={fe.email ? "email-error" : undefined}
          required
        />
        <FieldError id="email-error">{fe.email}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
          aria-invalid={!!fe.password}
          aria-describedby={fe.password ? "password-error" : undefined}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
        <FieldError id="password-error">{fe.password}</FieldError>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Spinner />}
        {mode === "signup" ? (pending ? "Creating account…" : "Create account") : pending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Whitechain Commerce?{" "}
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
