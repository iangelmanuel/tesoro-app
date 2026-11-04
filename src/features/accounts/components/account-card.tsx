"use client"

import { useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import {
  Button,
  Card,
  Dropdown,
  Label,
  buttonVariants,
  cn
} from "@heroui/react"
import {
  Archive,
  EllipsisVertical,
  List,
  Pencil,
  RefreshCw,
  Scale
} from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
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

  return (
    // Misma superficie que el resto de tarjetas: sin borde, radio grande
    <Card
      render={(props) => <li {...(props as React.ComponentProps<"li">)} />}
      className="gap-4"
    >
      <div className="flex items-start gap-3">
        <GoalIcon
          icon={account.icon}
          color={account.color}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{account.name}</span>
          <span className="text-sm text-muted">
            {ACCOUNT_KIND_META[account.kind].label}
          </span>
        </div>

        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={`Acciones de ${account.name}`}
            isDisabled={pending}
          >
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label={`Acciones de ${account.name}`}
              onAction={(key) =>
                key === "edit" ? setEditing(true) : run("archive")
              }
            >
              <Dropdown.Item
                id="edit"
                textValue="Editar"
              >
                <Pencil className="size-4" />
                <Label>Editar</Label>
              </Dropdown.Item>
              <Dropdown.Item
                id="archive"
                textValue="Archivar"
              >
                <Archive className="size-4" />
                <Label>Archivar</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
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
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            account.balance < 0 && "text-danger"
          )}
        >
          <Amount
            value={account.balance}
            currency={currency}
          />
        </span>
        {hasScheduled && (
          <span className="text-sm text-muted tabular-nums">
            Con lo programado:{" "}
            <span
              className={cn(
                "font-medium text-foreground",
                account.scheduled_balance < 0 && "text-danger"
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
            className="max-md:h-11"
            onPress={() => setReconciling(true)}
          >
            Conciliar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setAdjusting(true)}
        >
          <RefreshCw />
          Actualizar saldo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="max-md:h-11"
          onPress={() => setReconciling(true)}
        >
          <Scale />
          Conciliar
        </Button>
        <Link
          href={accountTransactionsHref(account.id, transactionsPath)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <List className="size-4" />
          Ver movimientos
        </Link>
      </div>
    </Card>
  )
}
