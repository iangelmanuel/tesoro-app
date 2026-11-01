"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button, ListBox, SearchField, Select, cn } from "@heroui/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-opacity lg:flex-row lg:items-center",
        pending && "opacity-60"
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          isIconOnly
          aria-label="Mes anterior"
          onPress={() => navigate({ month: shiftMonth(month, -1) })}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant={isAllMonths ? "ghost" : "outline"}
          className="min-w-40"
          onPress={() => navigate({ month: isAllMonths ? month : ALL })}
          aria-label={isAllMonths ? "Filtrar por mes" : "Ver todos los meses"}
        >
          {isAllMonths ? "Todos los meses" : formatMonth(month)}
        </Button>
        <Button
          variant="outline"
          isIconOnly
          aria-label="Mes siguiente"
          onPress={() => navigate({ month: shiftMonth(month, 1) })}
        >
          <ChevronRight />
        </Button>
        {!isAllMonths && (
          <Button
            variant="ghost"
            onPress={() => navigate({ month: ALL })}
          >
            Todos
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row lg:flex-1">
        <FilterSelect
          label="Tipo"
          className="sm:w-40"
          value={filters.type ?? ALL}
          onChange={(value) =>
            navigate({
              type: value === ALL ? undefined : (value as LedgerFilterType),
              // Una categoría de otro tipo dejaría la tabla vacía
              categoryId: undefined
            })
          }
          options={[
            { id: ALL, label: "Todos los tipos" },
            { id: "income", label: "Ingresos" },
            { id: "expense", label: "Gastos" },
            { id: "transfer", label: "Traspasos" }
          ]}
        />

        <FilterSelect
          label="Categoría"
          className="sm:w-52"
          value={filters.categoryId ?? ALL}
          onChange={(value) =>
            navigate({ categoryId: value === ALL ? undefined : value })
          }
          options={[
            { id: ALL, label: "Todas las categorías" },
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
          className="sm:w-44"
          value={filters.accountId ?? ALL}
          onChange={(value) =>
            navigate({ accountId: value === ALL ? undefined : value })
          }
          options={[
            { id: ALL, label: "Todas las cuentas" },
            { id: NO_ACCOUNT, label: "Sin cuenta" },
            ...accountOptions.map((account) => ({
              id: account.id,
              label: account.archived_at
                ? `${account.name} (archivada)`
                : account.name
            }))
          ]}
        />

        <SearchField
          aria-label="Buscar"
          value={q}
          onChange={setQ}
          className="sm:flex-1"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar en descripción o nota" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
    </div>
  )
}

// Select de filtro sin etiqueta visible: navega al elegir
function FilterSelect({
  label,
  className,
  value,
  onChange,
  options
}: {
  label: string
  className?: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <Select
      aria-label={label}
      className={className}
      value={value}
      onChange={(key) => key != null && onChange(String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
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
