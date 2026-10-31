import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  buttonVariants,
  cn
} from "@heroui/react"
import { formatCurrency } from "@/libs/format"
import { ACCOUNTS_PATH } from "../constants"
import { getAccountBalances } from "../queries"

interface AccountsCardProps {
  workspaceId: string
  currency: string
}

// "Saldo en cuentas": suma de los saldos a hoy de las cuentas activas
export async function AccountsCard({
  workspaceId,
  currency
}: AccountsCardProps) {
  const accounts = await getAccountBalances(workspaceId)
  const active = accounts.filter((account) => !account.archived_at)
  const total = active.reduce((sum, account) => sum + account.balance, 0)

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <CardHeader>
          <CardTitle>Saldo en cuentas</CardTitle>
          <CardDescription>
            {active.length === 1
              ? "1 cuenta activa"
              : `${active.length} cuentas activas`}
          </CardDescription>
        </CardHeader>
        <Link
          href={ACCOUNTS_PATH}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ver cuentas
        </Link>
      </div>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            total < 0 && "text-danger"
          )}
        >
          {formatCurrency(total, currency)}
        </p>
      </CardContent>
    </Card>
  )
}
