"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/services/auth-service";
import { cn } from "@/lib/utils";

interface PasswordRule {
  label: string;
  test: (v: string) => boolean;
}

const passwordRules: PasswordRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One number", test: (v) => /\d/.test(v) },
];

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label="Password requirements">
      {passwordRules.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5",
              ok ? "text-emerald-600" : "text-muted-foreground",
            )}
          >
            {ok ? (
              <Check className="size-3" aria-hidden="true" />
            ) : (
              <X className="size-3" aria-hidden="true" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Sign-up form with live password-strength feedback. Creates the
 * account and routes the user to /dashboard on success.
 */
export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
    mode: "onTouched",
  });

  const passwordValue = watch("password") ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerUser({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.status === 409) {
          setSubmitError("An account with this email already exists.");
          setError("email", { message: "Email is already in use." });
        } else if (error.status === 422) {
          // Server rejected validation; map per-field errors when present.
          for (const [field, message] of Object.entries(error.fieldErrors)) {
            if (field === "full_name" || field === "email" || field === "password") {
              setError(field, { message });
            }
          }
          setSubmitError(
            error.message ?? "Please review the form and try again.",
          );
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError("Network error. Please try again.");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Sign up form">
      {submitError && <Alert variant="error">{submitError}</Alert>}

      <FormField id="full_name" label="Full name" required error={errors.full_name?.message}>
        <Input
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          invalid={Boolean(errors.full_name)}
          {...register("full_name")}
        />
      </FormField>

      <FormField id="email" label="Work email" required error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </FormField>

      <FormField
        id="password"
        label="Password"
        required
        error={errors.password?.message}
        hint="Use 8+ characters with a mix of letters and numbers."
      >
        <PasswordInput
          autoComplete="new-password"
          placeholder="••••••••"
          invalid={Boolean(errors.password)}
          {...register("password")}
        />
        <PasswordStrength value={passwordValue} />
      </FormField>

      <FormField
        id="confirm_password"
        label="Confirm password"
        required
        error={errors.confirm_password?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          placeholder="••••••••"
          invalid={Boolean(errors.confirm_password)}
          {...register("confirm_password")}
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Creating account…
          </>
        ) : (
          "Get Started"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
