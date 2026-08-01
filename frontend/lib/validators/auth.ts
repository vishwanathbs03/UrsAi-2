/**
 * Auth validation schemas (Zod).
 *
 * Server is the source of truth for business rules, but the same
 * rules are mirrored here so users get immediate feedback before a
 * round-trip.
 */

import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((v) => /[A-Z]/.test(v), {
    message: "Password must contain an uppercase letter.",
  })
  .refine((v) => /[a-z]/.test(v), {
    message: "Password must contain a lowercase letter.",
  })
  .refine((v) => /\d/.test(v), {
    message: "Password must contain a number.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Name must be at least 2 characters.")
      .max(120, "Name is too long."),
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
