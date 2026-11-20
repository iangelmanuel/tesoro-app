"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Search, SlidersHorizontal, X } from "lucide-react"
import {
  MonthSwitcher,
  MonthSwitcherSkeleton
} from "@/components/dashboard/month-switcher"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"
import { FieldHelp } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { AccountOption } from "@/features/accounts/components/account-select"
import { NO_ACCOUNT } from "@/features/accounts/constants"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
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
  const [sheetOpen, setSheetOpen] = useState(false)
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
  // Filtros que viven en la hoja del teléfono: el buscador queda fuera.
  // "Todos los meses" cuenta como activo.
  const sheetFilterCount =
    Number(Boolean(filters.type)) +
    Number(Boolean(filters.categoryId)) +
    Number(Boolean(filters.accountId)) +
    Number(isAllMonths)

  const typeSelect = (fullWidth: boolean) => (
    <div className={cn("flex items-center gap-0.5", fullWidth && "w-full")}>
      <FilterSelect
        label="Tipo"
        fullWidth={fullWidth}
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
          { id: "income", label: "Entradas" },
          { id: "expense", label: "Salidas" },
          { id: "transfer", label: "Traspasos" }
        ]}
      />
      <FieldHelp
        help="filters.type"
        label="Tipo"
      />
    </div>
  )

  const categorySelect = (fullWidth: boolean) => (
    <FilterSelect
      label="Categoría"
      fullWidth={fullWidth}
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
  )

  const accountSelect = (fullWidth: boolean) => (
    <FilterSelect
      label="Cuenta"
      fullWidth={fullWidth}
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
          label={isAllMonths ? "Todos los meses" : formatMonth(month)}
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
          {sheetFilterCount > 0 && (
            <span
              aria-label={`${sheetFilterCount} activos`}
              className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-medium text-primary-foreground tabular-nums"
            >
              {sheetFilterCount}
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
          onClick={() => navigate({ month: isAllMonths ? month : ALL })}
        >
          {isAllMonths ? "Ver por mes" : "Todos los meses"}
        </Button>

        {typeSelect(false)}
        {categorySelect(false)}
        {accountSelect(false)}

        {hasExtraFilters && (
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

      {/* < 768 px: hoja inferior. Aplica al elegir, sin botón "Aplicar" */}
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] rounded-t-4xl pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 overflow-y-auto px-6 py-1">
            {typeSelect(true)}
            {categorySelect(true)}
            {accountSelect(true)}
            <Button
              variant="secondary"
              className="w-full"
              aria-pressed={isAllMonths}
              onClick={() => navigate({ month: isAllMonths ? month : ALL })}
            >
              {isAllMonths ? "Ver por mes" : "Todos los meses"}
            </Button>
          </div>
          <SheetFooter className="flex-row items-center justify-between gap-3">
            {sheetFilterCount > 0 ? (
              <Button
                variant="ghost"
                onClick={() =>
                  navigate({
                    type: undefined,
                    categoryId: undefined,
                    accountId: undefined,
                    month: currentMonth()
                  })
                }
              >
                <X />
                Limpiar filtros
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="ghost"
              onClick={() => setSheetOpen(false)}
            >
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Filtro pill: el nombre del filtro va dentro del trigger ("Tipo: Gastos"),
// así se ve qué filtra aunque haya un valor elegido. Navega al elegir
function FilterSelect({
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
  options: { id: string; label: string }[]
}) {
  const isActive = value !== ALL

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
