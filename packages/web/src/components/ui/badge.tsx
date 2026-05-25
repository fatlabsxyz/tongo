"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)]",
  accent: "border-[color:var(--color-accent)] text-[color:var(--color-accent)]",
  warn: "border-[color:var(--color-warn)] text-[color:var(--color-warn)]",
  danger: "border-[color:var(--color-danger)] text-[color:var(--color-danger)]",
  info: "border-[color:var(--color-info)] text-[color:var(--color-info)]",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
