import { z } from "zod";
import { INDUSTRIES, type Industry } from "./types";

/** Mirrors utils/phone.js on the API closely enough to catch typos before sending. */
const phone = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    if (v.startsWith("+")) return digits.length >= 10 && digits.length <= 15;
    const local = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
    return /^[6-9]\d{9}$/.test(local);
  }, "Enter a 10-digit mobile number");

const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");
const name = z.string().trim().min(2, "Enter your name").max(80);

export const signInSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your mobile number or email"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company's name").max(120),
  industry: z.enum(INDUSTRIES as [Industry, ...Industry[]]),
  name,
  phone,
  email: z.string().trim().email("Enter a valid email"),
  password,
});

export const joinDetailsSchema = z.object({
  name,
  phone,
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: "The two new passwords don't match", path: ["confirm"] })
  .refine((v) => v.newPassword !== v.currentPassword, { message: "Choose a password you haven't used here", path: ["newPassword"] });

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type SignUpForm = z.infer<typeof signUpSchema>;
export type JoinDetailsForm = z.infer<typeof joinDetailsSchema>;
