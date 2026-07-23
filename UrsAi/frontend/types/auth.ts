/**
 * Shared authentication-related types.
 *
 * Mirrors the backend Pydantic schemas in `app/schemas/auth.py`.
 */

export interface User {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSuccess {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // seconds
  user: User;
}

export interface ApiErrorBody {
  detail?: string | Array<{ loc?: string[]; msg?: string; type?: string }>;
}
