"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { signIn } from "../actions"
import type { AuthFormState } from "../types"
import { FormField } from "./form-field"
import { OAuthButtons } from "./oauth-buttons"

const QUERY_ERRORS: Record<string, string> = {
  oauth: "No se pudo iniciar sesión con el proveedor. Intenta de nuevo"
}

export function SignInForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined
  const queryError = QUERY_ERRORS[searchParams.get("error") ?? ""]

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    {}
  )
  const error = state.error ?? (state.values ? undefined : queryError)

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
        {next && (
          <input
            type="hidden"
            name="next"
            value={next}
          />
        )}
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
          autoComplete="current-password"
          errors={state.fieldErrors?.password}
          required
        />
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />o
        <span className="h-px flex-1 bg-border" />
      </div>

      <OAuthButtons next={next} />

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href={SITE.routes.signUp}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </div>
  )
}
