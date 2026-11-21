"use client"

import { useActionState } from "react"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
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
      <TextInputField
        name="fullName"
        label="Nombre"
        help="profile.name"
        autoComplete="name"
        maxLength={80}
        defaultValue={state.values?.fullName ?? fullName}
        error={state.fieldErrors?.fullName?.[0]}
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
        {pending ? "Guardando..." : "Guardar nombre"}
      </Button>
    </form>
  )
}
