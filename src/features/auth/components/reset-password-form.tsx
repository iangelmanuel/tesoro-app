"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button, toast } from "@heroui/react"
import { SITE } from "@/config/site"
import { resetPassword } from "../actions"
import type { AuthFormState } from "../types"
import { FormField } from "./form-field"

export function ResetPasswordForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    resetPassword,
    {}
  )

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
      router.replace(SITE.routes.dashboard)
    }
  }, [state.success, router])

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormField
        name="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.password}
        required
      />
      <FormField
        name="confirmPassword"
        label="Confirma la contraseña"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
        required
      />
      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        fullWidth
        isDisabled={pending || Boolean(state.success)}
      >
        {pending ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  )
}
