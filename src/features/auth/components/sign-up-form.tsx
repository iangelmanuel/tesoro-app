"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { signUp } from "../actions"
import type { AuthFormState } from "../types"
import { FormField } from "./form-field"
import { OAuthButtons } from "./oauth-buttons"

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    {}
  )

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          name="fullName"
          label="Nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          defaultValue={state.values?.fullName}
          errors={state.fieldErrors?.fullName}
          required
        />
        <FormField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          defaultValue={state.values?.email}
          errors={state.fieldErrors?.email}
          required
        />
        <FormField
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          errors={state.fieldErrors?.password}
          required
        />
        {state.error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />o
        <span className="h-px flex-1 bg-border" />
      </div>

      <OAuthButtons />

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={SITE.routes.signIn}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
