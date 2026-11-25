"use client"

import { useHideAmounts } from "@/components/dashboard/hide-amounts/hide-amounts-context"
import { FormDialog } from "@/components/forms/form-dialog"
import { SegmentedField } from "@/components/forms/segmented-field"
import { Button } from "@/components/ui/button"
import { PDF_MONTHS_ERROR } from "../range"
import { type ExportFormat, MAX_EXPORT_MONTHS, MAX_PDF_MONTHS } from "../types"
import { PeriodSelect } from "./export-option-fields"
import { ExportPdfFields } from "./export-pdf-fields"
import { ExportPeriodFields } from "./export-period-fields"
import {
  EXPORT_PERIODS,
  EXPORT_PERIOD_LABELS,
  type ExportPeriod
} from "./export-selection"
import { useExportForm } from "./use-export-form"

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "xlsx", label: "Excel" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" }
]

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
        <ExportForm
          workspaceId={workspaceId}
          historyStart={historyStart}
          onDone={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

function ExportForm({
  workspaceId,
  historyStart,
  onDone,
  onCancel
}: {
  workspaceId: string
  historyStart: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const { hidden } = useHideAmounts()
  const {
    format,
    setFormat,
    pdfOptions,
    setPdfOptions,
    selection,
    setSelection,
    changePeriod,
    pending,
    historyMonths,
    isPdf,
    maxMonths,
    allDisabled,
    options,
    parsed,
    monthCount,
    download
  } = useExportForm({ workspaceId, historyStart, onDone })

  return (
    <div className="flex flex-col gap-4">
      <SegmentedField
        label="Formato"
        help="export.format"
        value={format}
        onChange={setFormat}
        options={FORMAT_OPTIONS}
      />

      <PeriodSelect
        label="Periodo"
        help="export.period"
        value={selection.period}
        onChange={(value) => changePeriod(value as ExportPeriod)}
        options={EXPORT_PERIODS.map((period) => ({
          id: period,
          label: EXPORT_PERIOD_LABELS[period],
          disabled: period === "all" && allDisabled
        }))}
      />
      {historyMonths > maxMonths && (
        <p className="-mt-2 text-sm text-muted-foreground">
          {isPdf
            ? `Tu historial tiene ${historyMonths} meses. El PDF admite hasta ${MAX_PDF_MONTHS}.`
            : `Tu historial tiene ${historyMonths} meses. Exporta por rangos de hasta ${MAX_EXPORT_MONTHS}.`}
        </p>
      )}

      <ExportPeriodFields
        selection={selection}
        onChange={setSelection}
        options={options}
      />

      {isPdf && (
        <ExportPdfFields
          pdfOptions={pdfOptions}
          onChange={setPdfOptions}
        />
      )}

      <div
        className="flex flex-col gap-2 text-sm"
        aria-live="polite"
      >
        {parsed.success ? (
          <>
            {format === "xlsx" && (
              <p className="text-muted-foreground">
                Se crearán {monthCount} {monthCount === 1 ? "hoja" : "hojas"} de
                mes
              </p>
            )}
            {isPdf && (
              <p className="text-muted-foreground">
                Incluye {monthCount} {monthCount === 1 ? "mes" : "meses"} de
                detalle
              </p>
            )}
          </>
        ) : (
          <p
            role="alert"
            className="text-destructive"
          >
            {parsed.error === PDF_MONTHS_ERROR
              ? `${PDF_MONTHS_ERROR} Usa Excel para periodos más largos.`
              : parsed.error}
          </p>
        )}
        {hidden && (
          <p className="text-warning">El archivo incluye los montos reales.</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={download}
          disabled={pending || !parsed.success}
        >
          {pending ? "Generando…" : "Descargar"}
        </Button>
      </div>
    </div>
  )
}
