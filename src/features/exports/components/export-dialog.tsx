"use client"

import { Suspense } from "react"
import {
  FormDialog,
  FormDialogBodySkeleton
} from "@/components/forms/form-dialog"
import { lazyWithPreload } from "@/libs/lazy-with-preload"

// Formato, periodo y opciones del PDF se descargan al abrir el diálogo o al
// pasar por el botón Exportar (SPEC 56b)
const ExportForm = lazyWithPreload(() =>
  import("./export-form").then((m) => m.ExportForm)
)

/** Precarga el formulario de Exportar: `onPointerEnter` / `onFocus` */
export const preloadExportForm = ExportForm.preload

interface ExportDialogProps {
  workspaceId: string
  /** Mes YYYY-MM del primer movimiento o traspaso; null sin historial */
  historyStart: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Descarga de Excel o CSV (SPEC 32) y PDF (SPEC 33) desde Reportes */
export function ExportDialog({
  workspaceId,
  historyStart,
  open,
  onOpenChange
}: ExportDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      bottomOnMobile
      className="sm:max-w-md"
      title="Exportar"
      description="Descarga tus datos mes a mes para trabajarlos en Excel o Google Sheets."
    >
      {/* Se desmonta al cerrar: cada apertura toma el periodo actual */}
      {(close) => (
        <Suspense
          fallback={
            <FormDialogBodySkeleton
              tabs
              fields={3}
            />
          }
        >
          <ExportForm.Component
            workspaceId={workspaceId}
            historyStart={historyStart}
            onDone={close}
            onCancel={close}
          />
        </Suspense>
      )}
    </FormDialog>
  )
}
