"use client"

import { useActionState } from "react"
import {
  Button,
  Description,
  FieldError,
  Label,
  ListBox,
  Select,
  toast
} from "@heroui/react"
import { SITE } from "@/config/site"
import { updateCurrency } from "../actions"
import type { ProfileFormState } from "../types"

export function CurrencyForm({ currency }: { currency: string }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await updateCurrency(prevState, formData)
    if (result.ok) {
      toast.success("Moneda actualizada")
    }
    return result
  }, {})

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <Select
        name="currency"
        defaultValue={state.values?.currency ?? currency}
        isInvalid={Boolean(state.fieldErrors?.currency)}
        className="flex w-full flex-col gap-2 sm:w-72"
      >
        <Label>Moneda</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SITE.currencies.map((item) => (
              <ListBox.Item
                key={item.code}
                id={item.code}
                textValue={`${item.code} · ${item.label}`}
              >
                {item.code} · {item.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <Description>
          Solo cambia el formato. Tus montos no se convierten.
        </Description>
        <FieldError>{state.fieldErrors?.currency?.[0]}</FieldError>
      </Select>
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
        {pending ? "Guardando..." : "Guardar moneda"}
      </Button>
    </form>
  )
}
