"use client"

import { Plus, RefreshCw } from "lucide-react"
import { DetailSection } from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { type debtStatusLabel, isActiveDebt } from "../calculations"
import { nextPayment } from "../next-payment"
import { debtPaymentDescriptions } from "../payment-description"
import { debtProjection } from "../projection"
import type { Debt, DebtEntry } from "../queries"
import type { CollectableReceivable } from "../receivable-collect"
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

export interface DebtSheetBodyProps {
  debt: Debt
  entries: DebtEntry[]
  accounts?: PaymentAccountOption[]
  categories?: Category[]
  today: string
  currency: string
  /** Estado de la deuda (pagada, cobrada, archivada) para el aviso */
  status: ReturnType<typeof debtStatusLabel>
  /** Cuenta por cobrar con sus cuotas, para el formulario de cobro */
  collectable: CollectableReceivable
  /** "Reactivar" en curso (estado de la cabecera, sobrevive al cerrar) */
  pending: boolean
  onReactivate: () => void
  /** "Marcar pagada" de una cuota: el diálogo vive en la cabecera */
  onCollect: (installment: Installment) => void
}

/**
 * Cuerpo del Sheet de una deuda o cuenta por cobrar (SPEC 57): resumen,
 * acción, historial y detalles en el orden de DetailSheet. Se descarga al
 * abrir el panel o al pasar por su tarjeta; el estado que sobrevive al
 * cerrar vive en DebtSheet
 */
export function DebtSheetBody({
  debt,
  entries,
  accounts,
  categories,
  today,
  currency,
  status,
  collectable,
  pending,
  onReactivate,
  onCollect
}: DebtSheetBodyProps) {
  const isActive = debt.status === "active"
  const isReceivable = debt.kind === "receivable"
  // Cobro mes a mes (SPEC 28): se cobra por cuota, sin abonos ni ajustes
  // sueltos. Indefinida = sin número de cuotas ni saldo total.
  const isMonthly = isReceivable && debt.schedule === "monthly"
  const isOpenEnded = isMonthly && debt.term_months === null

  return (
    <>
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

      {/* Misma caja que el slot `action` de DetailSheet */}
      <div className="flex flex-col gap-2">
        {
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
                onClick={onReactivate}
              >
                Reactivar
              </Button>
            </div>
          )
        }
      </div>

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
            onCollect={onCollect}
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
  )
}
