import type { ReactNode } from "react";

export interface HostedCheckoutButtonProps {
  action: string;
  orderId: string;
  csrfToken?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export function HostedCheckoutButton({
  action,
  orderId,
  csrfToken,
  disabled,
  className,
  children = "Pay with USDT",
}: HostedCheckoutButtonProps) {
  return (
    <form method="post" action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      {csrfToken !== undefined && <input type="hidden" name="csrfToken" value={csrfToken} />}
      <button type="submit" disabled={disabled} className={className}>
        {children}
      </button>
    </form>
  );
}
