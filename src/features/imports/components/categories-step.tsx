"use client"

import { Button, Chip, Header, ListBox, Select, Separator } from "@heroui/react"
import { LoaderCircle } from "lucide-react"
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
        <p className="text-sm text-muted">
          {expenseOnly
            ? "Elige a qué categoría de gasto va cada valor de tu archivo. Marca «No importar» para omitir sus gastos fijos."
            : "Elige a qué categoría va cada valor de tu archivo. Marca «No importar» para omitir filas como traspasos entre tus cuentas o saldos iniciales."}
        </p>
      </div>

      {pairs.length === 0 ? (
        <p className="text-sm text-muted">
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
                    <Chip
                      size="sm"
                      variant={
                        pair.type === "income" ? "secondary" : "tertiary"
                      }
                    >
                      {TYPE_LABELS[pair.type]}
                    </Chip>
                  )}
                  {pair.label}
                  <span className="text-muted">
                    · {pair.count === 1 ? "1 fila" : `${pair.count} filas`}
                  </span>
                </span>
                <Select
                  value={targetValue(targets[pair.key]) || null}
                  onChange={(key) =>
                    key != null &&
                    ((value) => handleChange(pair, value))(String(key))
                  }
                  fullWidth
                  className="sm:w-56"
                  aria-label={`Categoría para ${pair.label}`}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Section>
                        <Header>Tus categorías</Header>
                        {options.map((category) => (
                          <ListBox.Item
                            key={category.id}
                            id={`${EXISTING_PREFIX}${category.id}`}
                            textValue={String(category.name)}
                          >
                            {category.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox.Section>
                      <Separator />
                      <ListBox.Item
                        id={NEW}
                        textValue={`Crear «${newName(pair)}»`}
                      >
                        Crear «{newName(pair)}»<ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        id={SKIP}
                        textValue="No importar"
                      >
                        No importar
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
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
            <p className="text-sm text-muted">
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
                    <span className="text-muted">
                      · {value.count === 1 ? "1 fila" : `${value.count} filas`}
                    </span>
                  </span>
                  <Select
                    value={
                      accountTargetValue(accountTargets[value.key]) || null
                    }
                    onChange={(key) =>
                      key != null &&
                      ((selected) => handleAccountChange(value, selected))(
                        String(key)
                      )
                    }
                    fullWidth
                    className="sm:w-56"
                    aria-label={`Cuenta para ${label}`}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {accounts.length > 0 && (
                          <>
                            <ListBox.Section>
                              <Header>Tus cuentas</Header>
                              {accounts.map((account) => (
                                <ListBox.Item
                                  key={account.id}
                                  id={`${EXISTING_PREFIX}${account.id}`}
                                  textValue={String(account.name)}
                                >
                                  {account.name}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox.Section>
                            <Separator />
                          </>
                        )}
                        {name && (
                          <ListBox.Item
                            id={NEW}
                            textValue={`Crear «${name}»`}
                          >
                            Crear «{name}»<ListBox.ItemIndicator />
                          </ListBox.Item>
                        )}
                        <ListBox.Item
                          id={NO_ACCOUNT}
                          textValue="Sin cuenta"
                        >
                          Sin cuenta
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
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
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          isDisabled={loading}
          onPress={onBack}
        >
          Atrás
        </Button>
        <Button
          isDisabled={rowCount === 0 || loading}
          onPress={onNext}
        >
          {loading && <LoaderCircle className="animate-spin" />}
          Ver vista previa
        </Button>
      </div>
    </div>
  )
}
