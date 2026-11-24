"use client"

import { useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import {
  MonthSwitcher,
  MonthSwitcherSkeleton
} from "@/components/dashboard/data/month-switcher"
import { CONTROL_BUTTON } from "@/components/dashboard/data/surface"
import { FieldHelp } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import type { AccountOption } from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { currentMonth, shiftMonth } from "@/libs/dates"
import { formatMonthTitle } from "@/libs/format"
import {
  FILTER_ALL,
  TYPE_FILTER_OPTIONS,
  accountFilterOptions,
  categoryFilterOptions
} from "../filter-options"
import {
  type LedgerFilterType,
  TRANSACTIONS_PATH,
  type TransactionFilters,
  hasExtraFilters,
  sheetFilterCount
} from "../filters"
import { TransactionsFiltersSelect } from "./transactions-filters-select"
import { TransactionsFiltersSheet } from "./transactions-filters-sheet"
import { useTransactionsFilters } from "./use-transactions-filters"

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
  const { pending, q, setQ, navigate } = useTransactionsFilters(path, filters)
  const [sheetOpen, setSheetOpen] = useState(false)

  const isAllMonths = filters.month === FILTER_ALL
  const month = isAllMonths ? currentMonth() : filters.month
  const activeSheetFilters = sheetFilterCount(filters)

  const typeSelect = (fullWidth: boolean) => (
    <div className={cn("flex items-center gap-0.5", fullWidth && "w-full")}>
      <TransactionsFiltersSelect
        label="Tipo"
        fullWidth={fullWidth}
        value={filters.type ?? FILTER_ALL}
        onChange={(value) =>
          navigate({
            type:
              value === FILTER_ALL ? undefined : (value as LedgerFilterType),
            // Una categoría de otro tipo dejaría la tabla vacía
            categoryId: undefined
          })
        }
        options={TYPE_FILTER_OPTIONS}
      />
      <FieldHelp
        help="filters.type"
        label="Tipo"
      />
    </div>
  )

  const categorySelect = (fullWidth: boolean) => (
    <TransactionsFiltersSelect
      label="Categoría"
      fullWidth={fullWidth}
      value={filters.categoryId ?? FILTER_ALL}
      onChange={(value) =>
        navigate({ categoryId: value === FILTER_ALL ? undefined : value })
      }
      options={categoryFilterOptions(categories, filters.type)}
    />
  )

  const accountSelect = (fullWidth: boolean) => (
    <TransactionsFiltersSelect
      label="Cuenta"
      fullWidth={fullWidth}
      value={filters.accountId ?? FILTER_ALL}
      onChange={(value) =>
        navigate({ accountId: value === FILTER_ALL ? undefined : value })
      }
      options={accountFilterOptions(accounts)}
    />
  )

  return (
    <div
      aria-busy={pending}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 transition-opacity duration-150 motion-reduce:transition-none",
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

      {/* Fila principal, todo a 44 px y centrado: buscador (ocupa el ancho
          libre) · mes · Filtros (< 768 px) · Verificar. En el teléfono el
          buscador ocupa una fila y los controles van debajo */}
      <div
        className="flex flex-wrap items-center gap-2"
        data-tour="transactions-search"
      >
        <div className="flex w-full items-center gap-1 md:min-w-72 md:flex-1 md:basis-72">
          {/* Mismo tono que las tarjetas y tablas (bg-card) */}
          <InputGroup className="min-w-0 flex-1 bg-card shadow-(--surface-shadow) hover:bg-card">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Buscar en descripción o nota"
              placeholder="Buscar"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && q) setQ("")
              }}
              className="[&::-webkit-search-cancel-button]:hidden"
            />
            {q ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label="Borrar búsqueda"
                  onClick={() => setQ("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <FieldHelp
            help="filters.search"
            label="Buscar"
          />
        </div>

        {/* El mes es texto (no botón): las flechas lo cambian y el toggle
            alterna entre un mes y todos */}
        <MonthSwitcher
          className="w-auto flex-1 md:flex-none"
          label={isAllMonths ? "Todos los meses" : formatMonthTitle(month)}
          onPrev={
            isAllMonths
              ? null
              : () => navigate({ month: shiftMonth(month, -1) })
          }
          onNext={
            isAllMonths ? null : () => navigate({ month: shiftMonth(month, 1) })
          }
        />

        <Button
          variant="ghost"
          className={cn("shrink-0 md:hidden", CONTROL_BUTTON)}
          data-tour="transactions-filters-sheet"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal />
          Filtros
          {activeSheetFilters > 0 && (
            <span
              aria-label={`${activeSheetFilters} activos`}
              className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-medium text-primary-foreground tabular-nums"
            >
              {activeSheetFilters}
            </span>
          )}
        </Button>
      </div>

      {/* >= 768 px: el resto de filtros en la barra */}
      <div
        className="hidden flex-wrap items-center gap-2 md:flex"
        data-tour="transactions-filters"
      >
        <Button
          variant="ghost"
          size="sm"
          className={CONTROL_BUTTON}
          aria-pressed={isAllMonths}
          onClick={() => navigate({ month: isAllMonths ? month : FILTER_ALL })}
        >
          {isAllMonths ? "Ver por mes" : "Todos los meses"}
        </Button>

        {typeSelect(false)}
        {categorySelect(false)}
        {accountSelect(false)}

        {hasExtraFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
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

      {/* < 768 px: hoja inferior */}
      <TransactionsFiltersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isAllMonths={isAllMonths}
        onToggleAllMonths={() =>
          navigate({ month: isAllMonths ? month : FILTER_ALL })
        }
        activeCount={activeSheetFilters}
        onClear={() =>
          navigate({
            type: undefined,
            categoryId: undefined,
            accountId: undefined,
            month: currentMonth()
          })
        }
      >
        {typeSelect(true)}
        {categorySelect(true)}
        {accountSelect(true)}
      </TransactionsFiltersSheet>
    </div>
  )
}

/**
 * Misma barra mientras carga: buscador, mes, botón Filtros (< 768 px) y la
 * fila de filtros (>= 768 px), con sus alturas
 */
export function TransactionsFiltersSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-w-0 flex-1 flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-full rounded-4xl md:min-w-72 md:flex-1 md:basis-72" />
        <MonthSwitcherSkeleton className="w-auto flex-1 md:flex-none" />
        <Skeleton className="h-11 w-28 rounded-4xl md:hidden" />
      </div>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Skeleton className="h-9 w-36 rounded-4xl" />
        <Skeleton className="h-9 w-32 rounded-4xl" />
        <Skeleton className="h-9 w-40 rounded-4xl" />
        <Skeleton className="h-9 w-36 rounded-4xl" />
      </div>
    </div>
  )
}
