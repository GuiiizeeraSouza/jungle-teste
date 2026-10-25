"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CarouselProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  trackClassName?: string;
}

/**
 * Faixa horizontal com scroll-snap e paginação por pontos (como no layout).
 * Rolável por toque, trackpad e teclado (setas quando focada).
 */
export function Carousel({ label, children, className, trackClassName }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    // Sem largura (oculto ou em transição de layout): nada a paginar.
    if (!el || el.clientWidth <= 0) return;
    const total = Math.min(50, Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05)));
    setPages(total);
    setPage(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  const goTo = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section aria-roledescription="carrossel" aria-label={label} className={cn("flex flex-col gap-5", className)}>
      <div
        ref={trackRef}
        onScroll={measure}
        tabIndex={0}
        className={cn("flex snap-x snap-mandatory scrollbar-none gap-4 overflow-x-auto pb-1 outline-offset-4", trackClassName)}
      >
        {children}
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir para a página ${i + 1} de ${pages}`}
              aria-current={i === page ? "true" : undefined}
              className={cn(
                "size-3 rounded-full border border-primary transition-colors",
                i === page ? "bg-primary" : "bg-transparent hover:bg-primary/30",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
