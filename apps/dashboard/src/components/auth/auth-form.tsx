"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { loginAction, signupAction, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** aria-describedby for a field: its hint (if any) and its error (if shown). */
function describedBy(...ids: (string | false | undefined)[]) {
  const s = ids.filter(Boolean).join(" ");
  return s || undefined;
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "signup" ? signupAction : loginAction, {});
  const fe = state.fieldErrors ?? {};
  const signup = mode === "signup";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      {signup && (
        <Field>
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="organization"
            placeholder="Acme Coffee Co."
            defaultValue={state.values?.name}
            aria-invalid={!!fe.name}
            aria-describedby={describedBy(fe.name ? "name-error" : "name-hint")}
            required
          />
          {fe.name ? <FieldError id="name-error">{fe.name}</FieldError> : <FieldHint id="name-hint">Buyers see this on your checkout page.</FieldHint>}
        </Field>
      )}

      <Field>
        <Label htmlFor="email">{signup ? "Work email" : "Email"}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
          aria-describedby={describedBy(fe.email && "email-error")}
          required
        />
        <FieldError id="email-error">{fe.email}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          aria-invalid={!!fe.password}
          aria-describedby={describedBy(fe.password ? "password-error" : signup && "password-hint")}
          minLength={signup ? 8 : undefined}
          required
        />
        {fe.password ? (
          <FieldError id="password-error">{fe.password}</FieldError>
        ) : (
          signup && <FieldHint id="password-hint">At least 8 characters.</FieldHint>
        )}
      </Field>

      <Button type="submit" className="mt-1 w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending && <Spinner />}
        {signup ? (pending ? "Creating account…" : "Create account") : pending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm leading-5 text-muted-foreground">
        {signup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="link font-medium text-foreground">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Whitechain Commerce?{" "}
            <Link href="/signup" className="link font-medium text-foreground">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
