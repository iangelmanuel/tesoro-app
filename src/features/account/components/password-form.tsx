"use client"

import { useActionState, useRef } from "react"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { changePassword, createPassword } from "../actions"
import type { ProfileFormState } from "../types"

interface PasswordFormProps {
  /** false para usuarios de solo OAuth: crean una sin pedir la actual */
  hasPassword: boolean
}

export function PasswordForm({ hasPassword }: PasswordFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(async (prevState, formData) => {
    const result = hasPassword
      ? await changePassword(prevState, formData)
      : await createPassword(prevState, formData)

    if (result.ok) {
      toast.success(
        hasPassword ? "Contraseña actualizada" : "Contraseña creada"
      )
      formRef.current?.reset()
    }
    return result
  }, {})

  const errors = state.fieldErrors

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {hasPassword && (
        <TextInputField
          name="currentPassword"
          type="password"
          label="Contraseña actual"
          help="password.current"
          autoComplete="current-password"
          error={errors?.currentPassword?.[0]}
        />
      )}
      <TextInputField
        name="password"
        type="password"
        label="Nueva contraseña"
        help="password.new"
        autoComplete="new-password"
        error={errors?.password?.[0]}
      />
      <TextInputField
        name="confirmPassword"
        type="password"
        label="Confirma la contraseña"
        help="password.confirm"
        autoComplete="new-password"
        error={errors?.confirmPassword?.[0]}
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
        className="self-start"
        disabled={pending}
      >
        {pending
          ? "Guardando..."
          : hasPassword
            ? "Cambiar contraseña"
            : "Crear contraseña"}
      </Button>
    </form>
  )
}
