"use client"

import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import {
  DetailSection,
  DetailSheet
} from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import {
  debtStatusLabel,
  isActiveDebt,
  isReceivableOverdue
} from "../calculations"
import { nextPayment } from "../next-payment"
import { debtPaymentDescriptions } from "../payment-description"
import { debtProjection } from "../projection"
import type { Debt, DebtEntry } from "../queries"
import { toCollectableReceivable } from "../receivable-collect"
import {
  type Installment,
  receivableInstallments
} from "../receivable-schedule"
import { AdjustDebtBalanceDialog } from "./adjust-debt-balance-dialog"
import { DebtEntriesList } from "./debt-entries-list"
import { DebtProgress, ReceivableProgress } from "./debt-progress"
import {
  DebtSheetDetails,
  DebtSheetProjection,
  DebtSheetSimulator
} from "./debt-sheet-details"
import {
  DebtSheetCollectedThisYear,
  DebtSheetInstallmentsDue,
  DebtSheetNextFee
} from "./debt-sheet-summary"
import { PaymentDialog } from "./payment-dialog"
import { ReceivableCollectDialog } from "./receivable-collect-form"
import { ReceivableInstallments } from "./receivable-installments"
import { useDebtAction } from "./use-debt-action"

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
  const isActive = debt.status === "active"
  const isReceivable = debt.kind === "receivable"
  // Cobro mes a mes (SPEC 28): se cobra por cuota, sin abonos ni ajustes
  // sueltos. Indefinida = sin número de cuotas ni saldo total.
  const isMonthly = isReceivable && debt.schedule === "monthly"
  const isOpenEnded = isMonthly && debt.term_months === null
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
          <div className="flex flex-col gap-3">
            {isOpenEnded ? (
              <DebtSheetCollectedThisYear
                entries={entries}
                today={today}
                currency={currency}
              />
            ) : isReceivable ? (
              <ReceivableProgress debt={debt} />
            ) : (
              <DebtProgress debt={debt} />
            )}
            {isMonthly && debt.term_months !== null && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {
                  receivableInstallments(debt, entries, today).filter(
                    (installment) => installment.status === "paid"
                  ).length
                }{" "}
                de {debt.term_months} cuotas cobradas
              </p>
            )}
            <DebtSheetNextFee
              debt={debt}
              today={today}
              currency={currency}
            />
            {isActive && (
              <DebtSheetInstallmentsDue
                debt={debt}
                currency={currency}
              />
            )}
          </div>
        }
        action={
          // Cuentas por cobrar: el formulario de cobro compartido con el tab
          // Me deben (SPEC 39). Mes a mes no lleva ajustes
          isActive && isReceivable ? (
            <div className="flex flex-wrap gap-2">
              <ReceivableCollectDialog
                workspaceId={debt.workspace_id}
                receivable={collectable}
                accounts={accounts ?? []}
                trigger={
                  <Button
                    className="min-w-fit flex-1"
                    disabled={!isOpenEnded && debt.balance <= 0}
                  >
                    <Plus />
                    Registrar cobro
                  </Button>
                }
              />
              {!isMonthly && (
                <AdjustDebtBalanceDialog
                  debt={debt}
                  currency={currency}
                  trigger={
                    <Button
                      className="min-w-fit flex-1"
                      variant="outline"
                    >
                      <RefreshCw />
                      Actualizar saldo
                    </Button>
                  }
                />
              )}
            </div>
          ) : isActive ? (
            <div className="flex flex-wrap gap-2">
              <PaymentDialog
                workspaceId={debt.workspace_id}
                debt={{
                  ...debt,
                  descriptions: debtPaymentDescriptions(debt)
                }}
                accounts={accounts}
                trigger={
                  <Button
                    className="min-w-fit flex-1"
                    // Sin saldo, una tarjeta igual registra compras y cargos
                    disabled={debt.balance <= 0 && debt.kind !== "credit_card"}
                  >
                    <Plus />
                    Registrar movimiento
                  </Button>
                }
              />
              <AdjustDebtBalanceDialog
                debt={debt}
                currency={currency}
                trigger={
                  <Button
                    className="min-w-fit flex-1"
                    variant="outline"
                  >
                    <RefreshCw />
                    Actualizar saldo
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-subtle p-4">
              <p className="text-sm text-muted-foreground">
                {status?.label}. Reactívala para registrar{" "}
                {isReceivable ? "abonos" : "pagos"}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => run("reactivate")}
              >
                Reactivar
              </Button>
            </div>
          )
        }
        history={
          <>
            {isMonthly && (
              <DetailSection
                title="Cuotas"
                help="installment"
              >
                <ReceivableInstallments
                  debt={debt}
                  entries={entries}
                  today={today}
                  currency={currency}
                  readOnly={!isActive}
                  onCollect={setCollecting}
                />
              </DetailSection>
            )}
            <DetailSection title="Historial">
              <DebtEntriesList
                debt={debt}
                entries={entries}
                accounts={accounts}
                categories={categories}
                currency={currency}
                cycleCovered={nextPayment(debt)?.status === "paid"}
                collectable={isMonthly ? collectable : undefined}
                readOnly={!isActive}
              />
            </DetailSection>
          </>
        }
        details={
          <>
            <DetailSection title="Detalles">
              <DebtSheetDetails
                debt={debt}
                currency={currency}
              />
            </DetailSection>
            {isActiveDebt(debt) && debt.balance > 0 && (
              <DetailSection title="Proyección">
                <DebtSheetProjection
                  projection={debtProjection(debt)}
                  currency={currency}
                />
                <DebtSheetSimulator
                  debt={debt}
                  currency={currency}
                />
              </DetailSection>
            )}
          </>
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
