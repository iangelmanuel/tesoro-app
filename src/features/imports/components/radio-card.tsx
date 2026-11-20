"use client"

import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/libs/cn"

interface RadioCardProps {
  /** id del radio; el texto de apoyo usa `${id}-hint` */
  id: string
  value: string
  label: string
  /** Texto de apoyo bajo la etiqueta (o un enlace, si va por encima) */
  hint: React.ReactNode
  disabled?: boolean
}

/**
 * Opción de un RadioGroup de `ui/` como tarjeta (destino de la importación,
 * modo de tipo): la etiqueta estira su área a toda la tarjeta. Sin borde;
 * la elegida se marca con relleno y anillo del primario del espacio
 */
export function RadioCard({
  id,
  value,
  label,
  hint,
  disabled = false
}: RadioCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full items-start gap-3 rounded-2xl bg-subtle p-4 transition-colors duration-150 has-data-checked:bg-primary/10 has-data-checked:ring-2 has-data-checked:ring-primary motion-reduce:transition-none",
        disabled ? "opacity-60" : "hover:bg-highlight"
      )}
    >
      <RadioGroupItem
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
      <span className="flex flex-col gap-0.5 text-sm">
        <label
          htmlFor={id}
          className={cn(
            "font-medium after:absolute after:inset-0 after:rounded-2xl",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {label}
        </label>
        {hint}
      </span>
    </div>
  )
}
