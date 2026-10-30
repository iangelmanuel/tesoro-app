"use client"

import { useActionState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/features/debts/components/field"
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
        <Field
          id="currentPassword"
          label="Contraseña actual"
          errors={errors?.currentPassword}
        >
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors?.currentPassword) || undefined}
          />
        </Field>
      )}
      <Field
        id="password"
        label="Nueva contraseña"
        errors={errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors?.password) || undefined}
        />
      </Field>
      <Field
        id="confirmPassword"
        label="Confirma la contraseña"
        errors={errors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors?.confirmPassword) || undefined}
        />
      </Field>
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
