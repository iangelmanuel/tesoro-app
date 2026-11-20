import { FieldLabel } from "@/components/forms/field-label"
import type { FieldHelpKey } from "@/config/help"

/**
 * Etiqueta, control y primer error para campos de HeroUI. Solo lo usa
 * `business-dialog.tsx`; SPEC 53 lo borra al migrar Empresa.
 */
export function Field({
  id,
  label,
  errors,
  help,
  children
}: {
  id: string
  label: string
  errors?: string[]
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel
        htmlFor={id}
        help={help}
      >
        {label}
      </FieldLabel>
      {children}
      {errors?.length ? (
        <p className="text-sm text-danger">{errors[0]}</p>
      ) : null}
    </div>
  )
}
