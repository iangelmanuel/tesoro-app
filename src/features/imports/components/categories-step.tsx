"use client"

import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { CARD_LIST } from "@/components/dashboard/data/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Button } from "@/components/ui/button"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import { CategoryDialog } from "@/features/categories/components/category-dialog"
import { cn } from "@/libs/cn"
import { MAX_ACCOUNT_NAME_LENGTH, MAX_CATEGORY_NAME_LENGTH } from "../constants"
import { EMPTY_LINK_LABEL } from "../normalize-values"
import type {
  AccountOption,
  AccountTarget,
  AccountValue,
  CategoryOption,
  CategoryPair,
  CategoryTarget
} from "../types"
import { RowTargetSelect } from "./row-target-select"

const NEW = "new"
const SKIP = "skip"
const EXISTING_PREFIX = "existing:"

const TYPE_LABELS = { income: "Entrada", expense: "Salida" } as const

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

/** Fila que pidió crear una categoría o cuenta con el diálogo */
type CreateRequest =
  | { kind: "category"; pair: CategoryPair }
  | { kind: "account"; value: AccountValue }

/** Suma las creadas en este paso mientras llega la lista del servidor */
function withCreated<T extends { id: string }>(options: T[], created: T[]) {
  return [
    ...options,
    ...created.filter(
      (item) => !options.some((option) => option.id === item.id)
    )
  ]
}

interface CategoriesStepProps {
  /** Espacio donde se crean categorías y cuentas desde los selects */
  workspaceId: string
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
  workspaceId,
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
  // "Crear «valor»" crea al importar con el nombre del archivo. "+ Crear …"
  // abre el diálogo para elegir nombre, icono o saldo; la nueva queda
  // elegida en la fila que la pidió
  const [createRequest, setCreateRequest] = useState<CreateRequest | null>(null)
  const [createdCategories, setCreatedCategories] = useState<CategoryOption[]>(
    []
  )
  const [createdAccounts, setCreatedAccounts] = useState<AccountOption[]>([])
  const categoryOptions = withCreated(categories, createdCategories)
  const accountOptions = withCreated(accounts, createdAccounts)

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
            ? "Elige a qué categoría de salida va cada valor de tu archivo. Marca «No importar» para omitir sus gastos fijos."
            : "Elige a qué categoría va cada valor de tu archivo. Marca «No importar» para omitir filas como traspasos entre tus cuentas o saldos iniciales."}
        </p>
      </div>

      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay filas válidas para importar. Vuelve al paso anterior y revisa
          el mapeo de columnas.
        </p>
      ) : (
        <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
          {pairs.map((pair) => {
            const options = categoryOptions.filter(
              (category) =>
                category.type === pair.type &&
                (!expenseOnly || category.type === "expense")
            )

            return (
              <li
                key={pair.key}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {!expenseOnly && (
                    <ToneBadge
                      className={
                        pair.type === "income"
                          ? TONE_BADGE_CLASSES.success
                          : TONE_BADGE_CLASSES.neutral
                      }
                    >
                      {TYPE_LABELS[pair.type]}
                    </ToneBadge>
                  )}
                  {pair.label}
                  <span className="text-muted-foreground">
                    · {pair.count === 1 ? "1 fila" : `${pair.count} filas`}
                  </span>
                </span>
                <RowTargetSelect
                  aria-label={`Categoría para ${pair.label}`}
                  value={targetValue(targets[pair.key])}
                  onChange={(next) => handleChange(pair, next)}
                  groups={[
                    {
                      label: "Tus categorías",
                      options: options.map((category) => ({
                        value: `${EXISTING_PREFIX}${category.id}`,
                        label: category.name
                      }))
                    },
                    {
                      options: [
                        { value: NEW, label: `Crear «${newName(pair)}»` },
                        { value: SKIP, label: "No importar" }
                      ]
                    }
                  ]}
                  createLabel="Crear categoría"
                  onCreate={() => setCreateRequest({ kind: "category", pair })}
                />
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
          <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
            {accountValues.map((value) => {
              const name = newAccountName(value)
              const label = value.label || EMPTY_LINK_LABEL

              return (
                <li
                  key={value.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {label}
                    <span className="text-muted-foreground">
                      · {value.count === 1 ? "1 fila" : `${value.count} filas`}
                    </span>
                  </span>
                  <RowTargetSelect
                    aria-label={`Cuenta para ${label}`}
                    value={accountTargetValue(accountTargets[value.key])}
                    onChange={(next) => handleAccountChange(value, next)}
                    groups={[
                      {
                        label: "Tus cuentas",
                        options: accountOptions.map((account) => ({
                          value: `${EXISTING_PREFIX}${account.id}`,
                          label: account.name
                        }))
                      },
                      {
                        options: [
                          ...(name
                            ? [{ value: NEW, label: `Crear «${name}»` }]
                            : []),
                          { value: NO_ACCOUNT, label: "Sin cuenta" }
                        ]
                      }
                    ]}
                    createLabel="Crear cuenta"
                    onCreate={() =>
                      setCreateRequest({ kind: "account", value })
                    }
                  />
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
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          type="button"
          disabled={rowCount === 0 || loading}
          onClick={onNext}
        >
          {loading && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          Ver vista previa
        </Button>
      </div>

      <CategoryDialog
        workspaceId={workspaceId}
        type={
          createRequest?.kind === "category"
            ? createRequest.pair.type
            : "expense"
        }
        open={createRequest?.kind === "category"}
        onOpenChange={(open) => {
          if (!open) setCreateRequest(null)
        }}
        onCreated={(category) => {
          if (createRequest?.kind !== "category") return
          setCreatedCategories((current) => [
            ...current,
            { id: category.id, type: category.type, name: category.name }
          ])
          handleChange(createRequest.pair, `${EXISTING_PREFIX}${category.id}`)
        }}
      />
      <AccountDialog
        workspaceId={workspaceId}
        open={createRequest?.kind === "account"}
        onOpenChange={(open) => {
          if (!open) setCreateRequest(null)
        }}
        onCreated={(account) => {
          if (createRequest?.kind !== "account") return
          setCreatedAccounts((current) => [
            ...current,
            { id: account.id, name: account.name }
          ])
          handleAccountChange(
            createRequest.value,
            `${EXISTING_PREFIX}${account.id}`
          )
        }}
      />
    </div>
  )
}
