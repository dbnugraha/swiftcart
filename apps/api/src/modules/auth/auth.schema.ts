import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(320),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Password is too long."),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required.").max(320),
  password: z.string().min(1, "Password is required."),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
