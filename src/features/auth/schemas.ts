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

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
