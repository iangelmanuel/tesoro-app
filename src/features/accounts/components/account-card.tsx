"use client"

import { useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import {
  Archive,
  EllipsisVertical,
  List,
  Pencil,
  RefreshCw,
  Scale
} from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/data/row-actions"
import { SURFACE_ITEM } from "@/components/dashboard/data/surface"
import {
  TONE_BADGE_CLASSES,
  TONE_TEXT_CLASSES
} from "@/components/dashboard/feedback/tone"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { cn } from "@/libs/cn"
import { ACCOUNT_KIND_META } from "../constants"
import { isNegativeAccount } from "../negative-balance"
import type { AccountWithBalance } from "../types"
import { AccountDialog } from "./account-dialog"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { ReconcileDialog } from "./reconcile-dialog"
import { useAccountAction } from "./use-account-action"

/** Movimientos de la cuenta, de todos los meses */
export function accountTransactionsHref(
  accountId: string,
  transactionsPath: string = TRANSACTIONS_PATH
) {
  return `${transactionsPath}?month=all&account=${accountId}` as Route
}

/** Contenedor de la tarjeta y de su skeleton: misma superficie y espacios */
const CARD_FRAME = cn(SURFACE_ITEM, "flex flex-col gap-4")

interface AccountCardProps {
  /** Cuenta activa */
  account: AccountWithBalance
  currency: string
  /** Ruta de Movimientos del espacio, para "Ver movimientos" */
  transactionsPath?: string
}

export function AccountCard({
  account,
  currency,
  transactionsPath
}: AccountCardProps) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const { pending, run } = useAccountAction(account)
  const hasScheduled = account.scheduled_balance !== account.balance
  // Billeteras y bancos no deberían quedar en rojo; efectivo y otras sí pueden
  const warnNegative = isNegativeAccount(account)

  // Las mismas acciones en el botón ⋯ y en el menú contextual (clic derecho
  // y pulsación larga)
  const actions: RowAction[] = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil />,
      onAction: () => setEditing(true)
    },
    {
      id: "archive",
      label: "Archivar",
      icon: <Archive />,
      onAction: () => run("archive"),
      disabled: pending
    }
  ]

  return (
    <RowContextMenu
      label={account.name}
      actions={actions}
    >
      <li
        className={CARD_FRAME}
        data-tour="accounts-card"
      >
        <div className="flex items-start gap-3">
          <GoalIcon
            icon={account.icon}
            color={account.color}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-medium">{account.name}</span>
            <span className="text-sm text-muted-foreground">
              {ACCOUNT_KIND_META[account.kind].label}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Acciones de ${account.name}`}
                  disabled={pending}
                  data-tour="accounts-menu"
                  className="-mt-2 -mr-2"
                />
              }
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-auto min-w-44"
            >
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  disabled={action.disabled}
                  onClick={action.onAction}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              account.balance < 0 && TONE_TEXT_CLASSES.danger
            )}
          >
            <Amount
              value={account.balance}
              currency={currency}
            />
          </span>
          {hasScheduled && (
            <span className="text-sm text-muted-foreground tabular-nums">
              Con lo programado:{" "}
              <span
                className={cn(
                  "font-medium text-foreground",
                  account.scheduled_balance < 0 && TONE_TEXT_CLASSES.danger
                )}
              >
                <Amount
                  value={account.scheduled_balance}
                  currency={currency}
                />
              </span>
            </span>
          )}
        </div>

        {warnNegative && (
          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm",
              TONE_BADGE_CLASSES.danger
            )}
          >
            <span>Saldo negativo: probablemente faltan movimientos.</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReconciling(true)}
            >
              Cuadrar saldo
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-tour="accounts-update-balance"
            onClick={() => setAdjusting(true)}
          >
            <RefreshCw />
            Actualizar saldo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-tour="accounts-reconcile"
            onClick={() => setReconciling(true)}
          >
            <Scale />
            Cuadrar saldo
          </Button>
          <Link
            href={accountTransactionsHref(account.id, transactionsPath)}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            data-tour="accounts-transactions"
          >
            <List />
            Ver movimientos
          </Link>
        </div>

        {/* Los diálogos se pintan en un portal; RowMenuBoundary evita que
              un clic derecho dentro de ellos abra el menú de la tarjeta */}
        <RowMenuBoundary>
          <AccountDialog
            workspaceId={account.workspace_id}
            account={account}
            open={editing}
            onOpenChange={setEditing}
          />
          <AdjustBalanceDialog
            account={account}
            currency={currency}
            open={adjusting}
            onOpenChange={setAdjusting}
          />
          <ReconcileDialog
            account={account}
            currency={currency}
            open={reconciling}
            onOpenChange={setReconciling}
          />
        </RowMenuBoundary>
      </li>
    </RowContextMenu>
  )
}

/** Misma tarjeta mientras carga: cabecera, saldo y fila de botones */
export function AccountCardSkeleton() {
  return (
    <li className={CARD_FRAME}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="-mt-2 -mr-2 size-11 rounded-full" />
      </div>
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40 rounded-4xl" />
        <Skeleton className="h-9 w-36 rounded-4xl" />
        <Skeleton className="h-9 w-40 rounded-4xl" />
      </div>
    </li>
  )
}
