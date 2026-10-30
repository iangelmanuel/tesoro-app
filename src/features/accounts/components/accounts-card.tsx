import Link from "next/link"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
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
      <CardHeader>
        <CardTitle>Saldo en cuentas</CardTitle>
        <CardDescription>
          {active.length === 1
            ? "1 cuenta activa"
            : `${active.length} cuentas activas`}
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={ACCOUNTS_PATH}>Ver cuentas</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            total < 0 && "text-destructive"
          )}
        >
          {formatCurrency(total, currency)}
        </p>
      </CardContent>
    </Card>
  )
}
