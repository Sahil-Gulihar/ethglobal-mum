"use client";

import { useActionState } from "react";
import { updateBusinessName, type NameFormState } from "@/lib/actions/merchant";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

export function BusinessNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<NameFormState, FormData>(updateBusinessName, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="business-name">Business name</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="business-name"
          name="name"
          autoComplete="organization"
          defaultValue={name}
          maxLength={80}
          required
          aria-invalid={!!state.error}
          aria-describedby="business-name-hint"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending && <Spinner />} Save
        </Button>
      </div>
      {state.error ? (
        <FieldError>{state.error}</FieldError>
      ) : state.saved && !pending ? (
        <p role="status" className="flex items-center gap-1 text-xs font-medium text-success">
          <Icon name="check" className="size-3.5" /> Saved
        </p>
      ) : (
        <p id="business-name-hint" className="text-xs text-muted-foreground">
          Shown to customers on the checkout.
        </p>
      )}
    </form>
  );
}
