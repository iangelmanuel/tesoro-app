"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/features/debts/components/field"
import { updateProfile } from "../actions"
import type { ProfileFormState } from "../types"

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await updateProfile(prevState, formData)
    if (result.ok) {
      toast.success("Nombre actualizado")
    }
    return result
  }, {})

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field
        id="fullName"
        label="Nombre"
        errors={state.fieldErrors?.fullName}
      >
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          maxLength={80}
          defaultValue={state.values?.fullName ?? fullName}
          aria-invalid={Boolean(state.fieldErrors?.fullName) || undefined}
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
        {pending ? "Guardando..." : "Guardar nombre"}
      </Button>
    </form>
  )
}
