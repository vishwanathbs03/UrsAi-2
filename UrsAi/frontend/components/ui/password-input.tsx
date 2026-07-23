"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { useFormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide toggle button. Wires its id and
 * aria-describedby through FormField context.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const { id, describedBy, invalid } = useFormField();
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={describedBy}
          autoComplete={props.autoComplete ?? "current-password"}
          className={cn("pr-10", className)}
          invalid={invalid}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
