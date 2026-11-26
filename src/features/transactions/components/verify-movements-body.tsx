"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { loadVerifyEntries } from "../ledger-actions"
import type { VerifyEntry } from "../types"
import { VerifyRow, VerifyRowSkeleton } from "./verify-row"

const ALL_ACCOUNTS = "__all__"

type Status = "idle" | "loading" | "error"

interface VerifyMovementsBodyProps {
  workspaceId: string
  accounts: PaymentAccountOption[]
  currency: string
  showAccountFilter: boolean
}

/**
 * Cuerpo de Verificar movimientos: lo carga VerifyMovementsDialog al abrir
 * (SPEC 56b) y pide la primera página al montar
 */
export function VerifyMovementsBody({
  workspaceId,
  accounts,
  currency,
  showAccountFilter
}: VerifyMovementsBodyProps) {
  const [accountKey, setAccountKey] = useState(ALL_ACCOUNTS)
  const [rows, setRows] = useState<VerifyEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  // Empieza cargando: la primera página se pide al montar
  const [status, setStatus] = useState<Status>("loading")
  // Descarta la respuesta de una carga que ya no es la última (cambio de
  // cuenta o cierre mientras viaja)
  const requestRef = useRef(0)

  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name])
  )
  const selectedAccountId = accountKey === ALL_ACCOUNTS ? null : accountKey

  type PageResult = Awaited<ReturnType<typeof loadVerifyEntries>>

  // Aplica una página si su pedido sigue siendo el último
  const applyPage = useCallback(
    (requestId: number, offset: number, result: PageResult) => {
      if (requestId !== requestRef.current) {
        return
      }
      if ("error" in result) {
        setStatus("error")
        return
      }
      setRows((current) =>
        offset === 0 ? result.rows : [...current, ...result.rows]
      )
      setHasMore(result.hasMore)
      setStatus("idle")
    },
    []
  )

  // Primera página al montar (el cuerpo solo existe con el diálogo abierto).
  // Al desmontar, el pedido en vuelo queda descartado
  useEffect(() => {
    const requestRefCurrent = requestRef
    const requestId = ++requestRefCurrent.current
    void loadVerifyEntries(workspaceId, null, 0).then((result) =>
      applyPage(requestId, 0, result)
    )
    return () => {
      requestRefCurrent.current++
    }
  }, [workspaceId, applyPage])

  async function load(account: string | null, offset: number) {
    const requestId = ++requestRef.current
    setStatus("loading")
    applyPage(
      requestId,
      offset,
      await loadVerifyEntries(workspaceId, account, offset)
    )
  }

  function handleAccountChange(key: string) {
    setAccountKey(key)
    setRows([])
    setHasMore(false)
    void load(key === ALL_ACCOUNTS ? null : key, 0)
  }

  const isLoading = status === "loading"

  return (
    <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6">
      {showAccountFilter && accounts.length > 0 ? (
        <SelectField
          label="Cuenta"
          help="verify.account"
          value={accountKey}
          onChange={handleAccountChange}
          options={[
            { value: ALL_ACCOUNTS, label: "Todas" },
            ...accounts.map((account) => ({
              value: account.id,
              label: account.name
            }))
          ]}
        />
      ) : null}

      <p
        role="status"
        className="sr-only"
      >
        {isLoading ? "Cargando movimientos" : `${rows.length} movimientos`}
      </p>

      {rows.length > 0 ? (
        <ul className="-mx-4 flex flex-col divide-y divide-border/70">
          {rows.map((entry) => (
            <VerifyRow
              key={entry.key}
              entry={entry}
              selectedAccountId={selectedAccountId}
              accountNames={accountNames}
              currency={currency}
            />
          ))}
        </ul>
      ) : null}

      {rows.length === 0 && status === "idle" ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay movimientos para mostrar.
        </p>
      ) : null}

      {status === "error" ? (
        <p
          role="alert"
          className="py-4 text-center text-sm text-destructive"
        >
          No se pudieron cargar los movimientos.
        </p>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <ul
          aria-hidden="true"
          className="-mx-4 flex flex-col divide-y divide-border/70"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <VerifyRowSkeleton key={index} />
          ))}
        </ul>
      ) : null}

      {hasMore || (status === "error" && rows.length > 0) ? (
        <Button
          variant="secondary"
          className="w-full shrink-0"
          disabled={isLoading}
          onClick={() => void load(selectedAccountId, rows.length)}
        >
          {isLoading ? "Cargando..." : "Cargar más"}
        </Button>
      ) : null}
    </div>
  )
}
