"use client"

import { useState } from "react"
import { FieldError, Input, Label, Switch, TextField } from "@heroui/react"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { amountInput } from "@/features/debts/components/field"
import { parseAmount } from "@/features/transactions/schemas"
import { formatCurrency } from "@/libs/format"
import {
  paymentShortfall,
  resolveTransferSource,
  transferSources
} from "../payment-account"
import type { AccountWithBalance } from "../types"
import {
  type AccountOption,
  AccountSelect,
  selectableAccounts
} from "./account-select"

export type PaymentAccountOption = AccountOption &
  Pick<AccountWithBalance, "balance">

export interface PaymentAccountErrors {
  account_id?: string
  transfer_from?: string
  transfer_amount?: string
}

interface PaymentAccountSectionProps {
  /** Todas las cuentas del espacio con su saldo a hoy; solo se ofrecen las activas */
  accounts: PaymentAccountOption[]
  /** Monto del pago, para avisar el faltante y proponer el traspaso */
  amount: number | null
  errors?: PaymentAccountErrors
  /** Etiqueta del select de cuenta */
  label?: string
  /** Sin traspaso: avances, retiros e ingresos */
  allowTransfer?: boolean
  /** Cuenta elegida al abrir */
  defaultAccountId?: string
}

// Cuenta del pago y traspaso previo. Envía account_id, transfer_from y
// transfer_amount ("" cuando no aplican). Sin cuenta, el pago queda por fuera
// de las cuentas y no toca ningún saldo.
export function PaymentAccountSection({
  accounts,
  amount,
  errors,
  label = "Cuenta",
  allowTransfer = true,
  defaultAccountId = ""
}: PaymentAccountSectionProps) {
  const [accountId, setAccountId] = useState(defaultAccountId)
  // null = sigue la sugerencia (faltante → encendido); true/false = decisión
  const [transferChoice, setTransferChoice] = useState<boolean | null>(null)
  const [sourceChoice, setSourceChoice] = useState("")
  // null = sigue el monto del pago
  const [transferInput, setTransferInput] = useState<string | null>(null)

  const active = selectableAccounts(accounts)
  const selected = active.find((account) => account.id === accountId)
  const sources = transferSources(accounts, accountId)
  const canTransfer =
    allowTransfer && selected !== undefined && sources.length > 0

  const shortfall = selected ? paymentShortfall(selected.balance, amount) : 0
  const transferOn = canTransfer && (transferChoice ?? shortfall > 0)
  const sourceId = resolveTransferSource(accounts, accountId, sourceChoice)
  const transferValue = transferInput ?? amountInput(amount)

  return (
    <div className="flex flex-col gap-3">
      <AccountSelect
        name="account_id"
        label={label}
        value={accountId}
        onChange={setAccountId}
        accounts={active}
        allowNone
        error={errors?.account_id}
      />

      {selected && (
        <p
          role="status"
          className="text-sm text-muted"
        >
          {shortfall > 0 ? (
            <span className={TONE_TEXT_CLASSES.warning}>
              {selected.name} tiene {formatCurrency(selected.balance)}. Faltan{" "}
              {formatCurrency(shortfall)}
            </span>
          ) : (
            <>
              Saldo de {selected.name}:{" "}
              <span className="tabular-nums">
                {formatCurrency(selected.balance)}
              </span>
            </>
          )}
        </p>
      )}

      {canTransfer && (
        <Switch
          isSelected={transferOn}
          onChange={setTransferChoice}
          className="min-h-11"
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>Traspasar fondos antes</Switch.Content>
        </Switch>
      )}

      {transferOn ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountSelect
            name="transfer_from"
            label="Desde"
            value={sourceId}
            onChange={setSourceChoice}
            accounts={sources.map((account) => ({
              ...account,
              name: `${account.name} · ${formatCurrency(account.balance)}`
            }))}
            error={errors?.transfer_from}
          />
          <TextField
            name="transfer_amount"
            inputMode="decimal"
            autoComplete="off"
            value={transferValue}
            onChange={setTransferInput}
            isInvalid={Boolean(errors?.transfer_amount)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>Monto del traspaso</Label>
            <Input placeholder="0" />
            <FieldError>{errors?.transfer_amount}</FieldError>
          </TextField>
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="transfer_from"
            value=""
          />
          <input
            type="hidden"
            name="transfer_amount"
            value=""
          />
        </>
      )}
    </div>
  )
}

/** Monto escrito en es-CO como número, o null si está vacío o es inválido */
export function parsePaymentAmount(value: string) {
  const amount = parseAmount(value)
  return Number.isNaN(amount) ? null : amount
}
