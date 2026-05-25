"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Cypherpunk panel. Square corners, hairline border, with a corner-bracket
 * accent in the top-left to evoke a terminal frame.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)]/40",
        "before:content-[''] before:absolute before:top-0 before:left-0 before:w-2 before:h-px before:bg-[color:var(--color-accent)]",
        "after:content-[''] after:absolute after:top-0 after:left-0 after:w-px after:h-2 after:bg-[color:var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 h-10 border-b border-[color:var(--color-border)] flex items-center justify-between", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-fg-muted)]", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 h-12 border-t border-[color:var(--color-border)] flex items-center gap-2", className)} {...props} />;
}
