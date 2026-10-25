import { cn } from "@/lib/utils";

/**
 * Skeleton com efeito shimmer. O brilho é desativado automaticamente
 * quando o usuário prefere movimento reduzido (motion-reduce).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-strong",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/[0.07] after:to-transparent motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
