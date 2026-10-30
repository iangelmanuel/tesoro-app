import { z } from "zod"

const email = z.email({ error: "Ingresa un email válido" }).trim().toLowerCase()

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { error: "El nombre debe tener máximo 80 caracteres" }),
  email,
  password: z
    .string()
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
})

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Ingresa tu contraseña" })
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden",
    path: ["confirmPassword"]
  })

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
