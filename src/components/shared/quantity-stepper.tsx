"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  /** "solid": botões cobre (desktop); "ghost": botões escuros (mobile). */
  variant?: "solid" | "ghost";
  size?: "sm" | "md";
  className?: string;
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  variant = "solid",
  size = "sm",
  className,
}: QuantityStepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;
  const button = cn(
    "grid shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-not-allowed",
    size === "sm" ? "h-6 w-5" : "size-9",
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
      : "bg-surface-strong text-foreground hover:bg-accent disabled:text-foreground/30",
  );

  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={!canDecrement}
        aria-label="Diminuir quantidade"
      >
        <Minus className={size === "sm" ? "size-3" : "size-4"} strokeWidth={3} aria-hidden />
      </button>
      <output
        aria-live="polite"
        aria-label={`Quantidade: ${value}`}
        className={cn("min-w-5 text-center tabular-nums", size === "md" && "text-lg")}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={!canIncrement}
        aria-label="Aumentar quantidade"
      >
        <Plus className={size === "sm" ? "size-3" : "size-4"} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );
}
