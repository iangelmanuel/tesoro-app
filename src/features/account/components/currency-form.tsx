"use client"

import { useActionState, useState } from "react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { SITE } from "@/config/site"
import { updateCurrency } from "../actions"
import type { ProfileFormState } from "../types"

const CURRENCY_OPTIONS = SITE.currencies.map((item) => ({
  value: item.code as string,
  label: `${item.code} · ${item.label}`
}))

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
  const [value, setValue] = useState(state.values?.currency ?? currency)

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <SelectField
        name="currency"
        label="Moneda"
        help="currency.code"
        value={value}
        onChange={setValue}
        options={CURRENCY_OPTIONS}
        description="Solo cambia el formato. Tus montos no se convierten."
        error={state.fieldErrors?.currency?.[0]}
        className="w-full sm:w-72"
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
        {pending ? "Guardando..." : "Guardar moneda"}
      </Button>
    </form>
  )
}
