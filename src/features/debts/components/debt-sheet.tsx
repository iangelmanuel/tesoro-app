"use client"

import { Suspense, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import {
  DetailSheet,
  DetailSheetSkeleton
} from "@/components/dashboard/overlays/detail-sheet"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { debtStatusLabel, isReceivableOverdue } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import { toCollectableReceivable } from "../receivable-collect"
import type { Installment } from "../receivable-schedule"
import { ReceivableCollectDialog } from "./receivable-collect-form"
import { useDebtAction } from "./use-debt-action"

// Resumen, proyección, simulador, historial y sus diálogos se descargan al
// abrir el panel o al pasar por su tarjeta (SPEC 57)
const DebtSheetBody = lazyWithPreload(() =>
  import("./debt-sheet-body").then((m) => m.DebtSheetBody)
)

/** Precarga el cuerpo del Sheet de deuda: `onPointerEnter` / `onFocus` */
export const preloadDebtSheet = DebtSheetBody.preload

interface DebtSheetProps {
  debt: Debt
  entries: DebtEntry[]
  /** Cuentas para el movimiento de un pago nuevo; solo en deudas activas */
  accounts?: PaymentAccountOption[]
  /** Categorías del espacio, para editar el movimiento de un pago */
  categories?: Category[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de una deuda o cuenta por cobrar: resumen, proyección y simulador
 * (tarjetas y préstamos), "Registrar movimiento" / "Actualizar saldo" e historial.
 * Las pagadas, cobradas o archivadas son de solo lectura, con "Reactivar".
 * La cabecera y el estado que sobrevive al cerrar viven aquí; el cuerpo es
 * diferido (DebtSheetBody)
 */
export function DebtSheet({
  debt,
  entries,
  accounts,
  categories,
  today,
  currency,
  open,
  onOpenChange
}: DebtSheetProps) {
  const isReceivable = debt.kind === "receivable"
  const isOpenEnded =
    isReceivable && debt.schedule === "monthly" && debt.term_months === null
  const status = debtStatusLabel(debt)
  const { pending, run } = useDebtAction(debt)
  // Cuota que se está cobrando con "Marcar pagada"
  const [collecting, setCollecting] = useState<Installment | null>(null)
  const collectable = toCollectableReceivable(debt, entries, today)

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={debt.name}
        status={
          <>
            {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
            {isReceivableOverdue(debt, today) && (
              <ToneBadge tone="warning">Vencida</ToneBadge>
            )}
          </>
        }
        figure={
          <Amount
            value={isOpenEnded ? (debt.installment ?? 0) : debt.balance}
            currency={currency}
          />
        }
        figureCaption={
          isOpenEnded
            ? "Mensual"
            : isReceivable
              ? "Por cobrar"
              : "Saldo pendiente"
        }
        summary={
          <Suspense fallback={<DetailSheetSkeleton />}>
            <DebtSheetBody.Component
              debt={debt}
              entries={entries}
              accounts={accounts}
              categories={categories}
              today={today}
              currency={currency}
              status={status}
              collectable={collectable}
              pending={pending}
              onReactivate={() => run("reactivate")}
              onCollect={setCollecting}
            />
          </Suspense>
        }
      />

      {/* Cobro de una cuota: "Una cuota" con esa cuota y lo que le falta
          prellenado (SPEC 28, 29 y 39) */}
      {collecting && (
        <ReceivableCollectDialog
          workspaceId={debt.workspace_id}
          receivable={collectable}
          periodOn={collecting.period_on}
          accounts={accounts ?? []}
          open
          onOpenChange={(open) => {
            if (!open) setCollecting(null)
          }}
        />
      )}
    </>
  )
}
