"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@heroui/react"
import { SITE } from "@/config/site"
import { requestPasswordReset } from "../actions"
import type { AuthFormState } from "../types"
import { FormField } from "./form-field"

const QUERY_ERRORS: Record<string, string> = {
  expired: "El enlace expiró o ya se usó. Pide uno nuevo"
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const queryError = QUERY_ERRORS[searchParams.get("error") ?? ""]

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {}
  )
  const submitted = Boolean(state.values ?? state.success)
  const error = state.error ?? (submitted ? undefined : queryError)

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
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
        {error && (
          <p
            role="alert"
            className="text-sm text-danger"
          >
            {error}
          </p>
        )}
        {state.success && (
          <p
            role="status"
            className="text-sm text-muted"
          >
            {state.success}
          </p>
        )}
        <Button
          type="submit"
          fullWidth
          isDisabled={pending}
        >
          {pending ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        ¿La recordaste?{" "}
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
