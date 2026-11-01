"use client"

import { useEffect, useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button, Drawer, ListBox, SearchField, Select, cn } from "@heroui/react"
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react"
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
  /** Acceso a Categorías que se muestra dentro de la hoja del teléfono */
  categoriesAction?: React.ReactNode
}

export function TransactionsFilters({
  path = TRANSACTIONS_PATH,
  filters,
  categories,
  accounts,
  categoriesAction
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
        { id: "income", label: "Ingresos" },
        { id: "expense", label: "Gastos" },
        { id: "transfer", label: "Traspasos" }
      ]}
    />
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

      {/* < 768 px: fila `‹ Mes ›` + Filtros. Desde 768 px la fila se
          aplana (`contents`) y todo queda en la misma barra */}
      <div className="flex w-full items-center gap-2 md:contents">
        {/* El mes es texto (no botón): las flechas lo cambian y el toggle
            alterna entre un mes y todos */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-3xl bg-default/60 p-0.5 md:flex-none">
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            className="max-md:size-11"
            aria-label="Mes anterior"
            isDisabled={isAllMonths}
            onPress={() => navigate({ month: shiftMonth(month, -1) })}
          >
            <ChevronLeft />
          </Button>
          <span
            aria-live="polite"
            className="min-w-0 flex-1 truncate px-1 text-center text-sm font-medium md:min-w-32 md:flex-none"
          >
            {isAllMonths ? "Todos los meses" : formatMonth(month)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            className="max-md:size-11"
            aria-label="Mes siguiente"
            isDisabled={isAllMonths}
            onPress={() => navigate({ month: shiftMonth(month, 1) })}
          >
            <ChevronRight />
          </Button>
        </div>

        <Button
          variant="secondary"
          className="shrink-0 max-md:min-h-11 md:hidden"
          onPress={() => setSheetOpen(true)}
        >
          <SlidersHorizontal />
          Filtros
          {sheetFilterCount > 0 && (
            <span
              aria-label={`${sheetFilterCount} activos`}
              className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-medium text-accent-foreground tabular-nums"
            >
              {sheetFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* >= 768 px: el resto de filtros en la barra */}
      <div className="hidden md:contents">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isAllMonths}
          onPress={() => navigate({ month: isAllMonths ? month : ALL })}
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

      {/* < 768 px: hoja inferior. Aplica al elegir, sin botón "Aplicar" */}
      <Drawer
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      >
        <Drawer.Backdrop className="md:hidden">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label="Filtros de movimientos"
              className="pb-[env(safe-area-inset-bottom)]"
            >
              <Drawer.Handle />
              <Drawer.Header>
                <Drawer.Heading>Filtros</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-3">
                {typeSelect(true)}
                {categorySelect(true)}
                {accountSelect(true)}
                <Button
                  variant="secondary"
                  fullWidth
                  className="min-h-11"
                  aria-pressed={isAllMonths}
                  onPress={() => navigate({ month: isAllMonths ? month : ALL })}
                >
                  {isAllMonths ? "Ver por mes" : "Todos los meses"}
                </Button>
                {/* Elemento del servidor: en un div propio para que React
                    no le pida `key` dentro del array de hijos */}
                {categoriesAction && <div>{categoriesAction}</div>}
              </Drawer.Body>
              <Drawer.Footer className="items-center justify-between gap-3">
                {sheetFilterCount > 0 ? (
                  <Button
                    variant="ghost"
                    className="min-h-11"
                    onPress={() =>
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
                  className="min-h-11 min-w-11"
                  onPress={() => setSheetOpen(false)}
                >
                  Cerrar
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
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

  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => key != null && onChange(String(key))}
      className={fullWidth ? "w-full" : "w-auto"}
    >
      <Select.Trigger
        className={cn(
          "min-h-8 gap-1.5 rounded-3xl py-1 text-sm",
          fullWidth &&
            "relative min-h-11 w-full justify-center px-10 text-base",
          isActive && "bg-accent-soft text-accent-soft-foreground"
        )}
      >
        <span className={cn(!isActive && "text-muted")}>{label}:</span>
        <Select.Value
          className={cn(
            "truncate font-medium",
            fullWidth ? "min-w-0" : "max-w-40"
          )}
        />
        <Select.Indicator className={cn(fullWidth && "absolute right-4")} />
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
