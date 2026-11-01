"use client"

import { useActionState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  toast
} from "@heroui/react"
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
      <TextField
        name="fullName"
        autoComplete="name"
        maxLength={80}
        defaultValue={state.values?.fullName ?? fullName}
        isInvalid={Boolean(state.fieldErrors?.fullName)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input />
        <FieldError>{state.fieldErrors?.fullName?.[0]}</FieldError>
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
        {pending ? "Guardando..." : "Guardar nombre"}
      </Button>
    </form>
  )
}
