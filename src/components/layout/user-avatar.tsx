import { ImageIcon } from "lucide-react";
import type { User } from "@/contracts";
import { cn } from "@/lib/utils";

export function UserAvatar({ user, className }: { user: Pick<User, "avatarUrl" | "displayName"> | null; className?: string }) {
  if (user?.avatarUrl) {
    return (
      // Data URL enviada pelo usuário — next/image não otimiza data URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} className={cn("rounded-full object-cover", className)} />
    );
  }
  return (
    <span aria-hidden className={cn("grid place-items-center rounded-full border border-border bg-surface-strong text-primary", className)}>
      <ImageIcon className="size-1/2" />
    </span>
  );
}
