"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { formatDeletionDate } from "@/features/account/deletion"
import { signIn } from "../actions"
import type { AuthFormState } from "../types"
import { OAuthButtons } from "./oauth-buttons"

const QUERY_ERRORS: Record<string, string> = {
  oauth: "No se pudo iniciar sesión con el proveedor. Intenta de nuevo"
}

export function SignInForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined
  const queryError = QUERY_ERRORS[searchParams.get("error") ?? ""]
  const deletionOn = searchParams.get("date")
  const deletionNotice =
    searchParams.get("notice") === "account-deletion-scheduled" &&
    deletionOn &&
    /^\d{4}-\d{2}-\d{2}$/.test(deletionOn)
      ? `Tu cuenta se borrará el ${formatDeletionDate(deletionOn)}. Inicia sesión antes para restaurarla.`
      : undefined

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    {}
  )
  const error = state.error ?? (state.values ? undefined : queryError)

  return (
    <div className="flex flex-col gap-6">
      {deletionNotice && (
        <p
          role="status"
          className="rounded-lg border bg-highlight/50 px-4 py-3 text-sm"
        >
          {deletionNotice}
        </p>
      )}
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
        <TextInputField
          name="email"
          label="Email"
          help="auth.email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email?.[0]}
          isRequired
        />
        <TextInputField
          name="password"
          label="Contraseña"
          help="password.current"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password?.[0]}
          isRequired
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
