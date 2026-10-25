import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  to?: "/" | "/carrinho" | "/pagamento";
  hash?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("hidden text-xs font-bold md:block", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={item.label}>
              <li>
                {item.to && !last ? (
                  <Link to={item.to} hash={item.hash} className="hover:text-primary">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>{item.label}</span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="text-foreground/70">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
