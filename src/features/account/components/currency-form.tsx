"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { SITE } from "@/config/site"
import { Field } from "@/features/debts/components/field"
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
      <Field
        id="currency"
        label="Moneda"
        errors={state.fieldErrors?.currency}
      >
        <Select
          name="currency"
          defaultValue={state.values?.currency ?? currency}
        >
          <SelectTrigger
            id="currency"
            className="w-full sm:w-72"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SITE.currencies.map((item) => (
              <SelectItem
                key={item.code}
                value={item.code}
              >
                {item.code} · {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Solo cambia el formato. Tus montos no se convierten.
        </p>
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
        {pending ? "Guardando..." : "Guardar moneda"}
      </Button>
    </form>
  )
}
