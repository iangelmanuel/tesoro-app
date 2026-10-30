"use client"

import { LoaderCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { MAX_ACCOUNT_NAME_LENGTH, MAX_CATEGORY_NAME_LENGTH } from "../constants"
import { EMPTY_LINK_LABEL } from "../normalize"
import type {
  AccountOption,
  AccountTarget,
  AccountValue,
  CategoryOption,
  CategoryPair,
  CategoryTarget
} from "../types"

const NEW = "new"
const SKIP = "skip"
const EXISTING_PREFIX = "existing:"

const TYPE_LABELS = { income: "Ingreso", expense: "Gasto" } as const

function targetValue(target: CategoryTarget | undefined) {
  if (!target || target.kind === "skip") return SKIP
  if (target.kind === "new") return NEW
  return `${EXISTING_PREFIX}${target.categoryId}`
}

function newName(pair: CategoryPair) {
  return pair.label.slice(0, MAX_CATEGORY_NAME_LENGTH).trim()
}

const NO_ACCOUNT = "none"

function accountTargetValue(target: AccountTarget | undefined) {
  if (!target || target.kind === "none") return NO_ACCOUNT
  if (target.kind === "new") return NEW
  return `${EXISTING_PREFIX}${target.accountId}`
}

function newAccountName(value: AccountValue) {
  return value.label.slice(0, MAX_ACCOUNT_NAME_LENGTH).trim()
}

interface CategoriesStepProps {
  /** Gastos fijos: solo categorías de gasto, sin la etiqueta de tipo */
  expenseOnly?: boolean
  pairs: CategoryPair[]
  targets: Record<string, CategoryTarget>
  categories: CategoryOption[]
  onTargetChange: (key: string, target: CategoryTarget) => void
  /** Movimientos con la columna Método mapeada: sus valores y destinos */
  accountValues?: AccountValue[]
  accountTargets?: Record<string, AccountTarget>
  /** Cuentas activas */
  accounts?: AccountOption[]
  onAccountTargetChange?: (key: string, target: AccountTarget) => void
  /** Revisando duplicados antes de la vista previa */
  loading: boolean
  error: string | null
  onBack: () => void
  onNext: () => void
}

// Paso 4: cada par (tipo, valor de origen) con su número de filas y su
// destino: una categoría existente, una nueva o "No importar"
export function CategoriesStep({
  expenseOnly = false,
  pairs,
  targets,
  categories,
  onTargetChange,
  accountValues = [],
  accountTargets = {},
  accounts = [],
  onAccountTargetChange,
  loading,
  error,
  onBack,
  onNext
}: CategoriesStepProps) {
  const importable = pairs.filter((pair) => targets[pair.key]?.kind !== "skip")
  const rowCount = importable.reduce((total, pair) => total + pair.count, 0)

  function handleChange(pair: CategoryPair, value: string) {
    if (value === SKIP) onTargetChange(pair.key, { kind: "skip" })
    else if (value === NEW) {
      onTargetChange(pair.key, { kind: "new", name: newName(pair) })
    } else {
      onTargetChange(pair.key, {
        kind: "existing",
        categoryId: value.slice(EXISTING_PREFIX.length)
      })
    }
  }

  function handleAccountChange(value: AccountValue, selected: string) {
    if (!onAccountTargetChange) return
    if (selected === NO_ACCOUNT) {
      onAccountTargetChange(value.key, { kind: "none" })
    } else if (selected === NEW) {
      onAccountTargetChange(value.key, {
        kind: "new",
        name: newAccountName(value)
      })
    } else {
      onAccountTargetChange(value.key, {
        kind: "existing",
        accountId: selected.slice(EXISTING_PREFIX.length)
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Categorías</h2>
        <p className="text-sm text-muted-foreground">
          {expenseOnly
            ? "Elige a qué categoría de gasto va cada valor de tu archivo. Marca «No importar» para omitir sus gastos fijos."
            : "Elige a qué categoría va cada valor de tu archivo. Marca «No importar» para omitir filas como traspasos entre tus cuentas o saldos iniciales."}
        </p>
      </div>

      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay filas válidas para importar. Vuelve al paso anterior y revisa
          el mapeo de columnas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {pairs.map((pair) => {
            const options = categories.filter(
              (category) =>
                category.type === pair.type &&
                (!expenseOnly || category.type === "expense")
            )

            return (
              <li
                key={pair.key}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {!expenseOnly && (
                    <Badge
                      variant={pair.type === "income" ? "secondary" : "outline"}
                    >
                      {TYPE_LABELS[pair.type]}
                    </Badge>
                  )}
                  {pair.label}
                  <span className="text-muted-foreground">
                    · {pair.count === 1 ? "1 fila" : `${pair.count} filas`}
                  </span>
                </span>
                <Select
                  value={targetValue(targets[pair.key])}
                  onValueChange={(value) => handleChange(pair, value)}
                >
                  <SelectTrigger
                    className="w-full sm:w-56"
                    aria-label={`Categoría para ${pair.label}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Tus categorías</SelectLabel>
                      {options.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={`${EXISTING_PREFIX}${category.id}`}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectItem value={NEW}>Crear «{newName(pair)}»</SelectItem>
                    <SelectItem value={SKIP}>No importar</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            )
          })}
        </ul>
      )}

      {/* La cuenta no omite filas: no hay "No importar" */}
      {pairs.length > 0 && accountValues.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Cuentas</h2>
            <p className="text-sm text-muted-foreground">
              Elige a qué cuenta va cada valor de la columna Método. Los
              movimientos sin cuenta se importan igual.
            </p>
          </div>
          <ul className="flex flex-col divide-y rounded-lg border">
            {accountValues.map((value) => {
              const name = newAccountName(value)
              const label = value.label || EMPTY_LINK_LABEL

              return (
                <li
                  key={value.key}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {label}
                    <span className="text-muted-foreground">
                      · {value.count === 1 ? "1 fila" : `${value.count} filas`}
                    </span>
                  </span>
                  <Select
                    value={accountTargetValue(accountTargets[value.key])}
                    onValueChange={(selected) =>
                      handleAccountChange(value, selected)
                    }
                  >
                    <SelectTrigger
                      className="w-full sm:w-56"
                      aria-label={`Cuenta para ${label}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.length > 0 && (
                        <>
                          <SelectGroup>
                            <SelectLabel>Tus cuentas</SelectLabel>
                            {accounts.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={`${EXISTING_PREFIX}${account.id}`}
                              >
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectSeparator />
                        </>
                      )}
                      {name && (
                        <SelectItem value={NEW}>Crear «{name}»</SelectItem>
                      )}
                      <SelectItem value={NO_ACCOUNT}>Sin cuenta</SelectItem>
                    </SelectContent>
                  </Select>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          disabled={loading}
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          disabled={rowCount === 0 || loading}
          onClick={onNext}
        >
          {loading && (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
            />
          )}
          Ver vista previa
        </Button>
      </div>
    </div>
  )
}
