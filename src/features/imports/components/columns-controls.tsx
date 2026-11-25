import { FieldHelp } from "@/components/forms/field-label"
import { RadioGroup } from "@/components/ui/radio-group"
import type { FieldHelpKey } from "@/config/help"
import type { ModeOption } from "./columns-options"
import { RadioCard } from "./radio-card"
import { RowTargetSelect } from "./row-target-select"

/** Valor del select cuando el campo o el valor no tiene destino */
export const UNMAPPED = "none"

interface ModeRadioProps<T extends string> {
  id: string
  title: string
  help: FieldHelpKey
  options: ModeOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** Radios de modo con su título y ayuda */
export function ModeRadio<T extends string>({
  id,
  title,
  help,
  options,
  value,
  onChange
}: ModeRadioProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5">
        <p
          id={id}
          className="text-sm font-medium"
        >
          {title}
        </p>
        <FieldHelp
          help={help}
          label={title}
        />
      </div>
      <RadioGroup
        aria-labelledby={id}
        className="grid gap-3 sm:grid-cols-3"
        value={value}
        onValueChange={(next) => onChange(next as T)}
      >
        {options.map((mode) => (
          <RadioCard
            key={mode.value}
            id={`${id}-${mode.value}`}
            value={mode.value}
            label={mode.label}
            hint={
              <span
                id={`${id}-${mode.value}-hint`}
                className="text-muted-foreground"
              >
                {mode.hint}
              </span>
            }
          />
        ))}
      </RadioGroup>
    </div>
  )
}

interface ValueSelectProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T | undefined) => void
}

/** Destino de un valor de la columna; vacío = sin asignar */
export function ValueSelect<T extends string>({
  label,
  options,
  value,
  onChange
}: ValueSelectProps<T>) {
  return (
    <RowTargetSelect
      aria-label={`Destino de ${label || "(vacío)"}`}
      value={value ?? UNMAPPED}
      onChange={(next) => onChange(next === UNMAPPED ? undefined : (next as T))}
      groups={[
        { options: [{ value: UNMAPPED, label: "Sin asignar" }] },
        { options }
      ]}
    />
  )
}
