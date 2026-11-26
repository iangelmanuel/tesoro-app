"use client"

import { Suspense } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { VerifyRowSkeleton } from "./verify-row"

// El filtro de cuenta y la lista se descargan al abrir (SPEC 56b)
const VerifyMovementsBody = lazyWithPreload(() =>
  import("./verify-movements-body").then((m) => m.VerifyMovementsBody)
)

/** Precarga el cuerpo de Verificar movimientos: `onPointerEnter` / `onFocus` */
export const preloadVerifyMovements = VerifyMovementsBody.preload

/** Hueco del cuerpo: las mismas 8 filas que muestra mientras carga */
function VerifyMovementsBodySkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="-mx-4 flex flex-col divide-y divide-border/70"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <VerifyRowSkeleton key={index} />
      ))}
    </ul>
  )
}

interface VerifyMovementsDialogProps {
  workspaceId: string
  /** Cuentas del espacio, activas y archivadas: nombres y selector */
  accounts: PaymentAccountOption[]
  currency: string
  /** Solo Personal ofrece el selector de cuenta */
  showAccountFilter?: boolean
  /** Se abre desde el menú Más y la hoja de acciones rápidas */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Historial completo de solo lectura, sin filtro de mes y en filas compactas,
 * para compararlo con el extracto del banco. Se carga al abrir, de 50 en 50.
 */
export function VerifyMovementsDialog({
  workspaceId,
  accounts,
  currency,
  showAccountFilter = false,
  open,
  onOpenChange
}: VerifyMovementsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      {/* Pantalla completa en el teléfono; ventana ancha desde md */}
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 max-md:inset-0 max-md:h-dvh max-md:max-h-dvh max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none md:max-w-xl">
        <DialogHeader className="pr-10">
          <DialogTitle>Verificar movimientos</DialogTitle>
          <DialogDescription>
            Todo tu historial, del más reciente al más antiguo, para compararlo
            con el extracto del banco. Solo lectura.
          </DialogDescription>
        </DialogHeader>
        {/* El cuerpo se monta al abrir y carga la primera página */}
        <Suspense fallback={<VerifyMovementsBodySkeleton />}>
          <VerifyMovementsBody.Component
            workspaceId={workspaceId}
            accounts={accounts}
            currency={currency}
            showAccountFilter={showAccountFilter}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
