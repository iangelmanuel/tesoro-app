"use client"

import { useActionState } from "react"
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  TextField
} from "@heroui/react"
import { changeEmail } from "../actions"
import type { ProfileFormState } from "../types"

interface ChangeEmailFormProps {
  email: string
  /** Email nuevo pendiente de confirmar, si lo hay */
  newEmail: string | null
}

export function ChangeEmailForm({ email, newEmail }: ChangeEmailFormProps) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(changeEmail, {})

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email ?? email}
        isInvalid={Boolean(state.fieldErrors?.email)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Email</Label>
        <Input />
        {newEmail && (
          <Description>
            Cambio pendiente a{" "}
            <span className="font-medium text-foreground">{newEmail}</span>
          </Description>
        )}
        <FieldError>{state.fieldErrors?.email?.[0]}</FieldError>
      </TextField>
      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
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
        variant="outline"
        className="self-start"
        isDisabled={pending}
      >
        {pending ? "Enviando..." : "Cambiar email"}
      </Button>
    </form>
  )
}
