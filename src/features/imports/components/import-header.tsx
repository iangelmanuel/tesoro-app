import type { Route } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import { cn } from "@/libs/cn"

/** Volver a Movimientos y qué hace el asistente. El título "Importar" lo
 *  pone el header del dashboard */
export function ImportHeader() {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href={TRANSACTIONS_PATH as Route}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "self-start"
        )}
      >
        <ArrowLeft aria-hidden="true" />
        Movimientos
      </Link>
      <p className="text-sm text-muted-foreground">
        Trae tus movimientos, gastos fijos, pagos de deudas o aportes a metas
        desde un Excel o un CSV. Revisas todo antes de guardar y puedes deshacer
        la importación.
      </p>
    </header>
  )
}
