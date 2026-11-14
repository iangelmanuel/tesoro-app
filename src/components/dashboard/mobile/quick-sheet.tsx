"use client"

import { useState } from "react"
import { Button, Drawer, Separator, Switch } from "@heroui/react"
import { ListChecks, Plus, Tags } from "lucide-react"
import { CategoriesSheet } from "@/features/categories/components/categories-sheet"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { VerifyMovementsDialog } from "@/features/transactions/components/verify-movements-dialog"
import { useQuickActions } from "../quick-actions-context"
import { useActiveWorkspace } from "../use-active-workspace"

type QuickSheetAction = "movement" | "categories" | "verify"

interface ActionItem {
  id: QuickSheetAction
  label: string
  icon: React.ComponentType<{ className?: string }>
}

// Una sola acción de registro con todos los tipos en tabs (SPEC 30)
const MOVEMENT_ACTION: ActionItem = {
  id: "movement",
  label: "Movimiento rápido",
  icon: Plus
}

// Herramientas del espacio (las mismas del menú Más): van aparte, bajo la
// acción de registro
const TOOL_ACTIONS: ActionItem[] = [
  { id: "categories", label: "Categorías", icon: Tags },
  { id: "verify", label: "Verificar movimientos", icon: ListChecks }
]

interface QuickSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Apertura automática al entrar (preferencia de este dispositivo) */
  autoOpen: boolean
  onAutoOpenChange: (autoOpen: boolean) => void
}

// Hoja inferior de acciones rápidas del teléfono, igual en Personal y
// Empresa. "Movimiento rápido" abre el mismo diálogo que el + del escritorio,
// con todos los tabs del espacio y en Gasto por defecto. Cada acción cierra la
// hoja y abre su diálogo sin cambiar de página. Se cierra deslizando el asa,
// tocando el fondo, con "Cerrar" o con Escape. Solo existe en rutas de un
// espacio.
export function QuickSheet({
  open,
  onOpenChange,
  autoOpen,
  onAutoOpenChange
}: QuickSheetProps) {
  const { goals, debts, receivables, pendingPayments, incomeSources } =
    useQuickActions()
  const workspace = useActiveWorkspace()
  const [dialog, setDialog] = useState<QuickSheetAction | null>(null)

  if (!workspace) {
    return null
  }

  const isPersonal = workspace.type === "personal"

  function onAction(action: QuickSheetAction) {
    onOpenChange(false)
    setDialog(action)
  }

  function closeDialog(isOpen: boolean) {
    if (!isOpen) setDialog(null)
  }

  function renderAction({ id, label, icon: Icon }: ActionItem) {
    return (
      <Button
        key={id}
        variant="secondary"
        fullWidth
        className="min-h-14 justify-start gap-3 text-base"
        onPress={() => onAction(id)}
      >
        <Icon className="size-5" />
        {label}
      </Button>
    )
  }

  return (
    <>
      <Drawer
        isOpen={open}
        onOpenChange={onOpenChange}
      >
        <Drawer.Backdrop className="md:hidden">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label="Acciones rápidas"
              className="pb-[env(safe-area-inset-bottom)]"
            >
              <Drawer.Handle />
              <Drawer.Header>
                <Drawer.Heading>
                  {isPersonal ? "Registrar" : "Registrar operación"}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-2">
                {renderAction(MOVEMENT_ACTION)}
                <Separator className="my-1" />
                {TOOL_ACTIONS.map(renderAction)}
              </Drawer.Body>
              <Drawer.Footer className="items-center justify-between gap-3">
                <Switch
                  isSelected={autoOpen}
                  onChange={onAutoOpenChange}
                  className="min-h-11"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>Abrir al entrar</Switch.Content>
                </Switch>
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  onPress={() => onOpenChange(false)}
                >
                  Cerrar
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* Controlados por la hoja: no tienen trigger propio */}
      {dialog === "movement" && (
        <TransactionDialog
          // Al cambiar de espacio el diálogo empieza de cero
          key={workspace.id}
          workspaceId={workspace.id}
          workspaceType={workspace.type}
          categories={workspace.categories}
          accounts={workspace.accounts}
          // Personal: tabs "Deuda", "Me deben", "Gasto fijo" y "Meta", y el select
          // "Ingreso fijo" del tab Ingreso. Empresa: Venta, Costo o gasto y
          // Traspaso
          paymentTabs={
            isPersonal
              ? { debts, receivables, pendingPayments, goals, incomeSources }
              : undefined
          }
          open
          onOpenChange={closeDialog}
        />
      )}
      <CategoriesSheet
        workspaceId={workspace.id}
        categories={workspace.categories}
        open={dialog === "categories"}
        onOpenChange={closeDialog}
      />
      <VerifyMovementsDialog
        workspaceId={workspace.id}
        accounts={workspace.accounts}
        currency={workspace.currency}
        showAccountFilter={isPersonal}
        open={dialog === "verify"}
        onOpenChange={closeDialog}
      />
    </>
  )
}
