"use client"

import { TextInputField } from "@/components/forms/text-input-field"
import type { FieldHelpKey } from "@/config/help"

export function DebtDialogAmountField({
  id,
  label,
  errors,
  defaultValue,
  required,
  help
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue: string
  required?: boolean
  help?: FieldHelpKey
}) {
  return (
    <TextInputField
      name={id}
      label={label}
      help={help}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      defaultValue={defaultValue}
      isRequired={required}
      error={errors?.[0]}
    />
  )
}

export function DebtDialogDayField({
  id,
  label,
  errors,
  defaultValue,
  required,
  help
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue?: string | number
  required?: boolean
  help?: FieldHelpKey
}) {
  return (
    <TextInputField
      name={id}
      label={label}
      help={help}
      type="number"
      inputMode="numeric"
      min={1}
      max={31}
      placeholder="15"
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      isRequired={required}
      error={errors?.[0]}
    />
  )
}
