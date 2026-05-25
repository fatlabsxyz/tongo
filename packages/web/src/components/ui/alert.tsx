"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warn" | "danger" | "success";

const tones: Record<Tone, string> = {
  info: "border-[color:var(--color-info)]/50 bg-[color:var(--color-info)]/5 text-[color:var(--color-info)]",
  warn: "border-[color:var(--color-warn)]/50 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)]",
  danger: "border-[color:var(--color-danger)]/50 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)]",
  success: "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)]",
};

const prefix: Record<Tone, string> = {
  info: "[i]",
  warn: "[!]",
  danger: "[x]",
  success: "[+]",
};

export function Alert({ tone = "info", className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div className={cn("border px-3 py-2 text-xs leading-relaxed flex gap-2", tones[tone], className)} {...props}>
      <span className="font-bold opacity-80 shrink-0">{prefix[tone]}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
