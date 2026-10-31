"use client"

import { useActionState, useRef } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  toast
} from "@heroui/react"
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
        <TextField
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          isInvalid={Boolean(errors?.currentPassword)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Contraseña actual</Label>
          <Input />
          <FieldError>{errors?.currentPassword?.[0]}</FieldError>
        </TextField>
      )}
      <TextField
        name="password"
        type="password"
        autoComplete="new-password"
        isInvalid={Boolean(errors?.password)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nueva contraseña</Label>
        <Input />
        <FieldError>{errors?.password?.[0]}</FieldError>
      </TextField>
      <TextField
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        isInvalid={Boolean(errors?.confirmPassword)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Confirma la contraseña</Label>
        <Input />
        <FieldError>{errors?.confirmPassword?.[0]}</FieldError>
      </TextField>
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
        className="self-start"
        isDisabled={pending}
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
