"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
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
  filters: TransactionFilters
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: AccountOption[]
}

export function TransactionsFilters({
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
      router.replace(`${TRANSACTIONS_PATH}?${query}` as Route, {
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
          size="icon"
          aria-label="Mes anterior"
          onClick={() => navigate({ month: shiftMonth(month, -1) })}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant={isAllMonths ? "ghost" : "outline"}
          className="min-w-40"
          onClick={() => navigate({ month: isAllMonths ? month : ALL })}
          aria-label={isAllMonths ? "Filtrar por mes" : "Ver todos los meses"}
        >
          {isAllMonths ? "Todos los meses" : formatMonth(month)}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Mes siguiente"
          onClick={() => navigate({ month: shiftMonth(month, 1) })}
        >
          <ChevronRight />
        </Button>
        {!isAllMonths && (
          <Button
            variant="ghost"
            onClick={() => navigate({ month: ALL })}
          >
            Todos
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row lg:flex-1">
        <Select
          value={filters.type ?? ALL}
          onValueChange={(value) =>
            navigate({
              type: value === ALL ? undefined : (value as LedgerFilterType),
              // Una categoría de otro tipo dejaría la tabla vacía
              categoryId: undefined
            })
          }
        >
          <SelectTrigger
            className="sm:w-40"
            aria-label="Tipo"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            <SelectItem value="income">Ingresos</SelectItem>
            <SelectItem value="expense">Gastos</SelectItem>
            <SelectItem value="transfer">Traspasos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.categoryId ?? ALL}
          onValueChange={(value) =>
            navigate({ categoryId: value === ALL ? undefined : value })
          }
        >
          <SelectTrigger
            className="sm:w-52"
            aria-label="Categoría"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {options.map((category) => (
              <SelectItem
                key={category.id}
                value={category.id}
              >
                {category.archived_at
                  ? `${category.name} (archivada)`
                  : category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.accountId ?? ALL}
          onValueChange={(value) =>
            navigate({ accountId: value === ALL ? undefined : value })
          }
        >
          <SelectTrigger
            className="sm:w-44"
            aria-label="Cuenta"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            <SelectItem value={NO_ACCOUNT}>Sin cuenta</SelectItem>
            {accountOptions.map((account) => (
              <SelectItem
                key={account.id}
                value={account.id}
              >
                {account.archived_at
                  ? `${account.name} (archivada)`
                  : account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar en descripción o nota"
            aria-label="Buscar"
            className="pl-8"
          />
        </div>
      </div>
    </div>
  )
}
