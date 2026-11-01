"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button, ListBox, SearchField, Select, cn } from "@heroui/react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import type { AccountOption } from "@/features/accounts/components/account-select"
import { NO_ACCOUNT } from "@/features/accounts/constants"
import type { Category } from "@/features/categories/queries"
import { currentMonth } from "@/libs/dates"
import {
  type LedgerFilterType,
  TRANSACTIONS_PATH,
  type TransactionFilters,
  buildFiltersQuery
} from "../filters"

const ALL = "all"
const SEARCH_DEBOUNCE_MS = 400

const MONTH_LABEL = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
})

function formatMonth(month: string) {
  const label = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

interface TransactionsFiltersProps {
  /** Ruta de Movimientos del espacio */
  path?: string
  filters: TransactionFilters
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: AccountOption[]
}

export function TransactionsFilters({
  path = TRANSACTIONS_PATH,
  filters,
  categories,
  accounts
}: TransactionsFiltersProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? "")
  // Si la URL cambia desde fuera (p. ej. "limpiar filtros"), el texto la sigue
  const [syncedQ, setSyncedQ] = useState(filters.q)
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q)
    setQ(filters.q ?? "")
  }

  // Cualquier cambio de filtro vuelve a la página 1
  function navigate(overrides: Partial<TransactionFilters>) {
    const query = buildFiltersQuery(filters, { ...overrides, page: 1 })
    startTransition(() => {
      router.replace(`${path}?${query}` as Route, {
        scroll: false
      })
    })
  }

  useEffect(() => {
    const value = q.trim()
    if (value === (filters.q ?? "")) return

    const timeout = setTimeout(
      () => navigate({ q: value || undefined }),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timeout)
    // navigate depende de filters, que ya está cubierto por filters.q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters.q])

  const isAllMonths = filters.month === ALL
  const month = isAllMonths ? currentMonth() : filters.month

  // Con tipo elegido solo se ofrecen sus categorías. Las archivadas van al
  // final, marcadas, para revisar movimientos históricos.
  const options = categories
    .filter((category) => !filters.type || category.type === filters.type)
    .toSorted(
      (a, b) => Number(a.archived_at !== null) - Number(b.archived_at !== null)
    )
  // Igual con las cuentas: archivadas al final
  const accountOptions = accounts.toSorted(
    (a, b) => Number(a.archived_at !== null) - Number(b.archived_at !== null)
  )

  const hasExtraFilters = Boolean(
    filters.type || filters.categoryId || filters.accountId || filters.q
  )

  return (
    <div
      aria-busy={pending}
      className={cn(
        "flex min-w-0 flex-1 flex-wrap items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none",
        pending && "opacity-60"
      )}
    >
      {/* Anuncia la recarga a lectores de pantalla; la tabla anuncia el total */}
      <p
        role="status"
        className="sr-only"
      >
        {pending ? "Actualizando movimientos…" : ""}
      </p>

      <SearchField
        aria-label="Buscar en descripción o nota"
        value={q}
        onChange={setQ}
        className="w-full sm:w-64"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Buscar" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {/* El mes es texto (no botón): las flechas lo cambian y el toggle
          alterna entre un mes y todos */}
      <div className="flex items-center gap-0.5 rounded-3xl bg-default/60 p-0.5">
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Mes anterior"
          isDisabled={isAllMonths}
          onPress={() => navigate({ month: shiftMonth(month, -1) })}
        >
          <ChevronLeft />
        </Button>
        <span
          aria-live="polite"
          className="min-w-32 px-1 text-center text-sm font-medium"
        >
          {isAllMonths ? "Todos los meses" : formatMonth(month)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Mes siguiente"
          isDisabled={isAllMonths}
          onPress={() => navigate({ month: shiftMonth(month, 1) })}
        >
          <ChevronRight />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={isAllMonths}
        onPress={() => navigate({ month: isAllMonths ? month : ALL })}
      >
        {isAllMonths ? "Ver por mes" : "Todos los meses"}
      </Button>

      <FilterSelect
        label="Tipo"
        value={filters.type ?? ALL}
        onChange={(value) =>
          navigate({
            type: value === ALL ? undefined : (value as LedgerFilterType),
            // Una categoría de otro tipo dejaría la tabla vacía
            categoryId: undefined
          })
        }
        options={[
          { id: ALL, label: "Todos" },
          { id: "income", label: "Ingresos" },
          { id: "expense", label: "Gastos" },
          { id: "transfer", label: "Traspasos" }
        ]}
      />

      <FilterSelect
        label="Categoría"
        value={filters.categoryId ?? ALL}
        onChange={(value) =>
          navigate({ categoryId: value === ALL ? undefined : value })
        }
        options={[
          { id: ALL, label: "Todas" },
          ...options.map((category) => ({
            id: category.id,
            label: category.archived_at
              ? `${category.name} (archivada)`
              : category.name
          }))
        ]}
      />

      <FilterSelect
        label="Cuenta"
        value={filters.accountId ?? ALL}
        onChange={(value) =>
          navigate({ accountId: value === ALL ? undefined : value })
        }
        options={[
          { id: ALL, label: "Todas" },
          { id: NO_ACCOUNT, label: "Sin cuenta" },
          ...accountOptions.map((account) => ({
            id: account.id,
            label: account.archived_at
              ? `${account.name} (archivada)`
              : account.name
          }))
        ]}
      />

      {hasExtraFilters && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => {
            setQ("")
            navigate({
              type: undefined,
              categoryId: undefined,
              accountId: undefined,
              q: undefined
            })
          }}
        >
          <X />
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

// Filtro pill: el nombre del filtro va dentro del trigger ("Tipo: Gastos"),
// así se ve qué filtra aunque haya un valor elegido. Navega al elegir
function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  const isActive = value !== ALL

  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => key != null && onChange(String(key))}
      className="w-auto"
    >
      <Select.Trigger
        className={cn(
          "min-h-8 gap-1.5 rounded-3xl py-1 text-sm",
          isActive && "bg-accent-soft text-accent-soft-foreground"
        )}
      >
        <span className={cn(!isActive && "text-muted")}>{label}:</span>
        <Select.Value className="max-w-40 truncate font-medium" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="min-w-48">
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
