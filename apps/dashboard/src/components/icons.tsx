import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon, Tick01Icon, LinkSquare02Icon, ArrowRight01Icon, ArrowLeft01Icon,
  Logout01Icon, ShieldCheckIcon, FlashIcon, UserIcon, Wallet01Icon, Key01Icon,
  Undo02Icon, Link01Icon, InboxIcon, ViewIcon, SentIcon, Refresh01Icon,
  Delete01Icon, Add01Icon, ArrowDown01Icon, GlobeIcon, Layers01Icon, LockIcon,
  CircleIcon, Download01Icon, AlertCircleIcon, Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const icons = {
  copy: Copy01Icon, check: Tick01Icon, external: LinkSquare02Icon,
  arrowRight: ArrowRight01Icon, arrowLeft: ArrowLeft01Icon, logout: Logout01Icon,
  shield: ShieldCheckIcon, zap: FlashIcon, user: UserIcon, wallet: Wallet01Icon, key: Key01Icon,
  undo: Undo02Icon, link: Link01Icon, inbox: InboxIcon, eye: ViewIcon, send: SentIcon,
  refresh: Refresh01Icon, trash: Delete01Icon, plus: Add01Icon, chevronDown: ArrowDown01Icon,
  globe: GlobeIcon, layers: Layers01Icon, lock: LockIcon, circle: CircleIcon,
  download: Download01Icon, alert: AlertCircleIcon, close: Cancel01Icon,
} as const;

type BrandedIcon = "analytics" | "home" | "card" | "code" | "webhook" | "settings" | "panel";
export type IconName = keyof typeof icons | BrandedIcon;

export function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  if (!(name in icons)) {
    return (
      <span
        className={cn("inline-block size-4 shrink-0 bg-current mask-contain mask-no-repeat", className)}
        style={{ maskImage: `url("/brand/${name}.png?v=2")` }}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      />
    );
  }
  return <HugeiconsIcon icon={icons[name as keyof typeof icons]} strokeWidth={1.7} className={cn("size-4 shrink-0", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
