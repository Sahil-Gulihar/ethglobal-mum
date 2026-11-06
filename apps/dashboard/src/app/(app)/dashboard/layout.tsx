import type { ReactNode } from "react";
import { requireMerchant } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const merchant = await requireMerchant();
  const initials = merchant.name.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
  const network = (
    <div className="flex flex-wrap items-center gap-2">
      {merchant.status !== "active" && <Badge tone="warning">Pending verification</Badge>}
    </div>
  );
  const account = (
    <details className="group relative">
      <summary aria-label={`Account menu for ${merchant.name}`} className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-[5px] p-1.5 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-secondary text-sm">{initials || "M"}</span>
        <span className="shell-label min-w-0 flex-1 truncate text-sm">{merchant.name}</span>
        <Icon name="chevronDown" className="shell-label text-muted-foreground" />
      </summary>
      <div className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-md border-[0.5px] bg-popover p-2 text-popover-foreground shadow-lg">
        <div className="px-2 py-1.5"><p className="truncate text-sm">{merchant.name}</p><p className="truncate text-xs text-muted-foreground">{merchant.email}</p></div>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-[5px] px-2 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
            <Icon name="logout" /> Log out
          </button>
        </form>
      </div>
    </details>
  );

  return <DashboardShell account={account} network={network}>{children}</DashboardShell>;
}
