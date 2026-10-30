"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/features/debts/components/field"
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
      <Field
        id="email"
        label="Email"
        errors={state.fieldErrors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email ?? email}
          aria-invalid={Boolean(state.fieldErrors?.email) || undefined}
        />
        {newEmail && (
          <p className="text-sm text-muted-foreground">
            Cambio pendiente a{" "}
            <span className="font-medium text-foreground">{newEmail}</span>
          </p>
        )}
      </Field>
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
        className="self-start"
        disabled={pending}
      >
        {pending ? "Enviando..." : "Cambiar email"}
      </Button>
    </form>
  )
}
