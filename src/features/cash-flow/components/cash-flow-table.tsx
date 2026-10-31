import { cn } from "cn"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { NEGATIVE } from "@/features/reports/change"
import { formatCurrency } from "@/libs/format"
import type { CashFlowMonth } from "../queries"

// `month` es una fecha de Postgres: se arma en local para que no se corra
function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  return format(new Date(year, monthIndex - 1, 1), "MMMM yyyy", { locale: es })
}

interface CashFlowTableProps {
  months: CashFlowMonth[]
  currency: string
}

/** Entradas, salidas, neto y saldo en cuentas al cierre, mes a mes */
export function CashFlowTable({ months, currency }: CashFlowTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Entradas</TableHead>
            <TableHead className="text-right">Salidas</TableHead>
            <TableHead className="text-right">Neto</TableHead>
            <TableHead className="text-right">Saldo al cierre</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((row) => (
            <TableRow key={row.month}>
              <TableCell className="first-letter:uppercase">
                {monthLabel(row.month)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.inflow, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.outflow, currency)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  row.net < 0 && NEGATIVE
                )}
              >
                {formatCurrency(row.net, currency)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.closingBalance < 0 && NEGATIVE
                )}
              >
                {formatCurrency(row.closingBalance, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
