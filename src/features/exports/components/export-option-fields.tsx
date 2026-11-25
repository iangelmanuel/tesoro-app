import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import type { FieldHelpKey } from "@/config/help"

/** Select del diálogo de Exportar, con opciones `{ id, label }` */
export function PeriodSelect({
  label,
  help,
  value,
  onChange,
  options
}: {
  label: string
  help: FieldHelpKey
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string; disabled?: boolean }[]
}) {
  return (
    <SelectField
      label={label}
      help={help}
      value={value}
      onChange={onChange}
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled
      }))}
    />
  )
}

/** Tabs segmentadas con etiqueta visible, para opciones de pocas alternativas */
export function OptionTabs({
  label,
  help,
  value,
  onChange,
  options,
  hint
}: {
  label: string
  help: FieldHelpKey
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <SegmentedField
        label={label}
        help={help}
        value={value}
        onChange={onChange}
        options={options.map((option) => ({
          value: option.id,
          label: option.label
        }))}
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
