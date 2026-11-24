"use client"

import { CONTROL_BUTTON } from "@/components/dashboard/data/surface"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { cn } from "@/libs/cn"
import { FILTER_ALL, type FilterOption } from "../filter-options"

// Filtro pill: el nombre del filtro va dentro del trigger ("Tipo: Gastos"),
// así se ve qué filtra aunque haya un valor elegido. Navega al elegir
export function TransactionsFiltersSelect({
  label,
  value,
  onChange,
  options,
  fullWidth = false
}: {
  fullWidth?: boolean
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
}) {
  const isActive = value !== FILTER_ALL

  const items = options.map((option) => ({
    value: option.id,
    label: option.label
  }))

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => next != null && onChange(String(next))}
    >
      <SelectTrigger
        aria-label={label}
        size={fullWidth ? "default" : "sm"}
        className={cn(
          "gap-1.5",
          fullWidth ? "w-full flex-1 text-base" : "max-w-64",
          !fullWidth && !isActive && CONTROL_BUTTON,
          // Filtro aplicado: tinte del primario del espacio
          isActive &&
            "bg-[color-mix(in_oklab,var(--primary)_14%,var(--card))] hover:bg-[color-mix(in_oklab,var(--primary)_20%,var(--card))]"
        )}
      >
        <span className={cn(!isActive && "text-muted-foreground")}>
          {label}:
        </span>
        <SelectValue
          className={cn(
            "min-w-0 truncate font-medium",
            !fullWidth && "max-w-40"
          )}
        />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        className="min-w-48"
      >
        {items.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
