"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { useAuth } from "@/hooks/use-auth";
import { AuthServiceError } from "@/services/auth-service";

/**
 * Sign-in form. Validates locally, calls /auth/login, and redirects
 * to the original target (or /dashboard) on success.
 */
export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get("next") ?? "/dashboard";
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.status === 401) {
          setSubmitError("Invalid email or password.");
        } else if (error.status === 403) {
          setSubmitError("This account is disabled. Contact support.");
        } else {
          setSubmitError(error.message);
        }
        // Map any server field errors back onto the form.
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field, { message });
          }
        }
      } else {
        setSubmitError("Network error. Please try again.");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Sign in form">
      {submitError && <Alert variant="error">{submitError}</Alert>}

      <FormField id="email" label="Email" required error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </FormField>

      <FormField id="password" label="Password" required error={errors.password?.message}>
        <PasswordInput
          autoComplete="current-password"
          placeholder="••••••••"
          invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Get started
        </Link>
      </p>
    </form>
  );
}
