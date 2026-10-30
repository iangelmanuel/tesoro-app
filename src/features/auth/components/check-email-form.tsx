"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { resendConfirmation } from "../actions"
import type { AuthFormState } from "../types"
import { FormField } from "./form-field"

export function CheckEmailForm() {
  const searchParams = useSearchParams()
  const queryEmail = searchParams.get("email") ?? ""

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    resendConfirmation,
    {}
  )
  const email = state.values?.email ?? queryEmail

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm text-muted-foreground">
        {email ? (
          <>
            Te enviamos un enlace a{" "}
            <span className="font-medium text-foreground">{email}</span>. Ábrelo
            para confirmar tu cuenta.
          </>
        ) : (
          "Te enviamos un enlace a tu email. Ábrelo para confirmar tu cuenta."
        )}
      </p>

      <form
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
        {/* Sin email en la URL, el usuario lo escribe para reenviar */}
        {queryEmail ? (
          <input
            type="hidden"
            name="email"
            value={queryEmail}
          />
        ) : (
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
        )}
        {state.error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p
            role="status"
            className="text-sm text-muted-foreground"
          >
            {state.success}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Reenviando..." : "Reenviar correo"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya confirmaste?{" "}
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
