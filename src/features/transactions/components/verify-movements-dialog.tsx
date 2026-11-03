"use client"

import { useRef, useState } from "react"
import { Button, Label, ListBox, Modal, Select, cn } from "@heroui/react"
import { ListChecks } from "lucide-react"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { loadVerifyEntries } from "../actions"
import type { VerifyEntry } from "../queries"
import { VerifyRow } from "./verify-row"

const ALL_ACCOUNTS = "__all__"

type Status = "idle" | "loading" | "error"

interface VerifyMovementsDialogProps {
  workspaceId: string
  /** Cuentas del espacio, activas y archivadas: nombres y selector */
  accounts: PaymentAccountOption[]
  currency: string
  /** Solo Personal ofrece el selector de cuenta */
  showAccountFilter?: boolean
}

/**
 * Historial completo de solo lectura, sin filtro de mes y en filas compactas,
 * para compararlo con el extracto del banco. Se carga al abrir, de 50 en 50.
 */
export function VerifyMovementsDialog({
  workspaceId,
  accounts,
  currency,
  showAccountFilter = false
}: VerifyMovementsDialogProps) {
  const [open, setOpen] = useState(false)
  const [accountKey, setAccountKey] = useState(ALL_ACCOUNTS)
  const [rows, setRows] = useState<VerifyEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  // Descarta la respuesta de una carga que ya no es la última (cambio de
  // cuenta o cierre mientras viaja)
  const requestRef = useRef(0)

  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name])
  )
  const selectedAccountId = accountKey === ALL_ACCOUNTS ? null : accountKey

  async function load(account: string | null, offset: number) {
    const requestId = ++requestRef.current
    setStatus("loading")

    const result = await loadVerifyEntries(workspaceId, account, offset)

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
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setRows([])
      setHasMore(false)
      void load(selectedAccountId, 0)
    } else {
      requestRef.current++
    }
  }

  function handleAccountChange(key: string) {
    setAccountKey(key)
    setRows([])
    setHasMore(false)
    void load(key === ALL_ACCOUNTS ? null : key, 0)
  }

  const isLoading = status === "loading"

  return (
    <Modal
      isOpen={open}
      onOpenChange={handleOpenChange}
    >
      <Button
        variant="ghost"
        className={cn(
          "min-h-11 shrink-0 max-sm:min-w-11 max-sm:px-0",
          CONTROL_BUTTON
        )}
        aria-label="Verificar movimientos"
      >
        <ListChecks />
        <span className="max-sm:sr-only">Verificar</span>
      </Button>
      <Modal.Backdrop>
        <Modal.Container
          scroll="inside"
          className="max-md:p-0"
        >
          <Modal.Dialog className="max-md:h-full max-md:max-h-full max-md:rounded-none md:max-w-xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Verificar movimientos</Modal.Heading>
              <p className="text-sm text-muted">
                Todo tu historial, del más reciente al más antiguo, para
                compararlo con el extracto del banco. Solo lectura.
              </p>
            </Modal.Header>
            <Modal.Body>
              {showAccountFilter && accounts.length > 0 ? (
                <Select
                  fullWidth
                  aria-label="Cuenta"
                  value={accountKey}
                  onChange={(key) =>
                    handleAccountChange(
                      key == null ? ALL_ACCOUNTS : String(key)
                    )
                  }
                  className="mb-4 flex flex-col gap-2"
                >
                  <Label>Cuenta</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item
                        id={ALL_ACCOUNTS}
                        textValue="Todas"
                      >
                        Todas
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {accounts.map((account) => (
                        <ListBox.Item
                          key={account.id}
                          id={account.id}
                          textValue={account.name}
                        >
                          {account.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              ) : null}

              <p
                role="status"
                className="sr-only"
              >
                {isLoading
                  ? "Cargando movimientos"
                  : `${rows.length} movimientos`}
              </p>

              {rows.length > 0 ? (
                <ul className="flex flex-col divide-y divide-separator">
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
              ) : status === "idle" ? (
                <p className="py-8 text-center text-sm text-muted">
                  No hay movimientos para mostrar.
                </p>
              ) : null}

              {status === "error" ? (
                <p
                  role="alert"
                  className="py-4 text-center text-sm text-danger"
                >
                  No se pudieron cargar los movimientos.
                </p>
              ) : null}

              {isLoading && rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  Cargando...
                </p>
              ) : null}

              {hasMore || (status === "error" && rows.length > 0) ? (
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4 min-h-11"
                  isDisabled={isLoading}
                  onPress={() => void load(selectedAccountId, rows.length)}
                >
                  {isLoading ? "Cargando..." : "Cargar más"}
                </Button>
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
