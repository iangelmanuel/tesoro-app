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
  RefreshCw
} from "lucide-react"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { formatCurrency } from "@/libs/format"
import { ACCOUNT_KIND_META } from "../constants"
import type { AccountWithBalance } from "../types"
import { AccountDialog } from "./account-dialog"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
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
  const { pending, run } = useAccountAction(account)
  const hasScheduled = account.scheduled_balance !== account.balance

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
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            account.balance < 0 && "text-danger"
          )}
        >
          {formatCurrency(account.balance, currency)}
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
              {formatCurrency(account.scheduled_balance, currency)}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setAdjusting(true)}
        >
          <RefreshCw />
          Actualizar saldo
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
