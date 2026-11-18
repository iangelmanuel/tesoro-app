"use client"

import { useEffect, useId, useState } from "react"
import { FieldError, Radio, RadioGroup } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { formatDate, formatTime } from "@/libs/format"
import { listLinkableTransactions } from "../actions"
import type { EntryType } from "../entry-types"
import type { LinkableTransaction } from "../queries"

/** "No está registrado": el valor vacío del campo */
const CREATE_NEW = ""

interface LinkableTransactionsFieldProps {
  /** Movimiento de la deuda que se edita */
  entryId: string
  /** Tipo elegido: decide si se buscan gastos o ingresos */
  type: EntryType
  /** Monto y fecha del formulario: los candidatos tienen el mismo monto */
  amount: number
  occurredOn: string
  currency: string
  /** "gasto" o "ingreso", para los textos */
  noun: "gasto" | "ingreso"
  /** Texto de la opción sin enlazar ("Crear uno nuevo", "No está registrado") */
  noneLabel: string
  /** id del candidato elegido, o "" para no enlazar */
  value: string
  /** Avisa el candidato elegido (null = no enlazar) */
  onChange: (candidate: LinkableTransaction | null) => void
  /** Error del servidor (el candidato ya no se puede enlazar) */
  error?: string
}

/**
 * "¿Ya lo registraste?" (SPEC 42): gastos o ingresos sueltos del mismo monto
 * a ±7 días, para enlazarlos en vez de contar dos veces el dinero. Sin
 * candidatos no se muestra. Envía link_transaction_id ("" = no enlazar).
 */
export function LinkableTransactionsField({
  entryId,
  type,
  amount,
  occurredOn,
  currency,
  noun,
  noneLabel,
  value,
  onChange,
  error
}: LinkableTransactionsFieldProps) {
  const labelId = useId()
  const [candidates, setCandidates] = useState<LinkableTransaction[]>([])

  useEffect(() => {
    let active = true
    listLinkableTransactions(entryId, type, amount, occurredOn)
      .then((rows) => {
        if (!active) return
        setCandidates(rows)
        // El elegido ya no calza con el monto o la fecha
        if (value && !rows.some((row) => row.id === value)) onChange(null)
      })
      .catch(() => {
        if (active) setCandidates([])
      })
    return () => {
      active = false
    }
    // value y onChange no disparan una búsqueda nueva
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, type, amount, occurredOn])

  function handleChange(next: string) {
    onChange(candidates.find((row) => row.id === next) ?? null)
  }

  return (
    <>
      <input
        type="hidden"
        name="link_transaction_id"
        value={value}
      />
      {candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p
            id={labelId}
            className="text-sm font-medium"
          >
            ¿Ya lo registraste?
          </p>
          <p className="text-sm text-muted">
            Hay un {noun} del mismo monto en esas fechas. Elígelo para no contar
            el dinero dos veces.
          </p>
          <RadioGroup
            aria-labelledby={labelId}
            value={value}
            onChange={handleChange}
            isInvalid={Boolean(error)}
            className="flex flex-col gap-2"
          >
            {candidates.map((row) => (
              <CandidateOption
                key={row.id}
                value={row.id}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  <span className="truncate font-medium">
                    {row.description}
                  </span>
                  <span className="text-muted">
                    {formatDate(row.occurred_on)}
                    {row.occurred_time && ` · ${formatTime(row.occurred_time)}`}
                    {` · ${row.account_name ?? "Fuera de cuentas"}`}
                  </span>
                </span>
                <Amount
                  value={row.amount}
                  currency={currency}
                  className="text-sm font-medium"
                />
              </CandidateOption>
            ))}
            <CandidateOption value={CREATE_NEW}>
              <span className="text-sm font-medium">{noneLabel}</span>
            </CandidateOption>
            <FieldError>{error}</FieldError>
          </RadioGroup>
        </div>
      )}
    </>
  )
}

function CandidateOption({
  value,
  children
}: {
  value: string
  children: React.ReactNode
}) {
  return (
    <Radio value={value}>
      {({ isSelected }) => (
        <Radio.Content
          data-selected={isSelected}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl bg-default p-3 transition-colors data-[selected=true]:bg-accent-soft"
        >
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          {children}
        </Radio.Content>
      )}
    </Radio>
  )
}
