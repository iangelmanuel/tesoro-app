"use client"

import { useEffect, useId, useState } from "react"
import { Radio, RadioGroup, Skeleton } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { formatDate, formatTime } from "@/libs/format"
import { listLinkableTransactions } from "../actions"
import type { LinkableTransaction } from "../queries"

/** "Crear movimiento nuevo": el valor vacío del campo */
const CREATE_NEW = ""

interface LinkableTransactionsFieldProps {
  /** Ajuste que se convierte en pago */
  entryId: string
  currency: string
  /** Gasto (tarjetas y préstamos) o ingreso (Me deben) */
  noun: "gasto" | "ingreso"
  /** id del candidato elegido, o "" para crear uno nuevo */
  value: string
  /** Avisa el candidato elegido (null = crear uno nuevo) */
  onChange: (candidate: LinkableTransaction | null) => void
}

/**
 * "Movimiento ya registrado" (SPEC 42): movimientos sueltos del mismo monto a
 * ±7 días del ajuste, con la opción final "Crear movimiento nuevo". Envía
 * link_transaction_id ("" = crear uno nuevo).
 */
export function LinkableTransactionsField({
  entryId,
  currency,
  noun,
  value,
  onChange
}: LinkableTransactionsFieldProps) {
  const labelId = useId()
  const [candidates, setCandidates] = useState<LinkableTransaction[] | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    listLinkableTransactions(entryId)
      .then((rows) => {
        if (active) setCandidates(rows)
      })
      .catch(() => {
        if (active) {
          setFailed(true)
          setCandidates([])
        }
      })
    return () => {
      active = false
    }
  }, [entryId])

  function handleChange(next: string) {
    onChange(candidates?.find((row) => row.id === next) ?? null)
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        id={labelId}
        className="text-sm font-medium"
      >
        Movimiento ya registrado
      </p>
      <input
        type="hidden"
        name="link_transaction_id"
        value={value}
      />

      {candidates === null ? (
        <div
          role="status"
          aria-label="Buscando movimientos"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {failed
              ? "No se pudieron buscar movimientos. Puedes crear uno nuevo."
              : candidates.length === 0
                ? `No hay un ${noun} del mismo monto a ±7 días. Se crea uno nuevo.`
                : `Si ya registraste este ${noun}, elígelo para no contarlo dos veces.`}
          </p>
          <RadioGroup
            aria-labelledby={labelId}
            value={value}
            onChange={handleChange}
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
              <span className="text-sm font-medium">
                Crear movimiento nuevo
              </span>
            </CandidateOption>
          </RadioGroup>
        </>
      )}
    </div>
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
