"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "success" | "info";
  title?: string;
}

const variantStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  success: "border-emerald-500/30 bg-emerald-50 text-emerald-700",
  info: "border-border bg-secondary text-foreground",
};

const variantIcon = {
  error: AlertCircle,
  success: CheckCircle2,
  info: AlertCircle,
};

export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...rest
}: AlertProps) {
  const Icon = variantIcon[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm",
        variantStyles[variant],
        className,
      )}
      {...rest}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {title ? <div className="text-sm opacity-90">{children}</div> : children}
      </div>
    </div>
  );
}
