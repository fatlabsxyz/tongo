"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-10 sm:h-9 px-3 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] focus:border-[color:var(--color-accent)] focus:outline-none placeholder:text-[color:var(--color-fg-subtle)] text-xs transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3 py-2.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] focus:border-[color:var(--color-accent)] focus:outline-none placeholder:text-[color:var(--color-fg-subtle)] text-xs leading-relaxed resize-none transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
