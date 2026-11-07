"use client"

import { useId, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Button,
  Label,
  ListBox,
  Modal,
  Select,
  Tabs,
  toast
} from "@heroui/react"
import { useHideAmounts } from "@/components/dashboard/hide-amounts-context"
import { parseReportParams } from "@/features/reports/period"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { todayISO } from "@/libs/dates"
import {
  PDF_MONTHS_ERROR,
  listMonths,
  monthLabel,
  monthsSpanned,
  parseExportRange
} from "../range"
import {
  DEFAULT_PDF_OPTIONS,
  type ExportFormat,
  MAX_EXPORT_MONTHS,
  MAX_PDF_MONTHS,
  type PdfOptions
} from "../types"

const PERIODS = ["month", "quarter", "year", "range", "all"] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABELS: Record<Period, string> = {
  month: "Mes",
  quarter: "Trimestre",
  year: "Año",
  range: "Rango de meses",
  all: "Todo el historial"
}

const PDF_SIZE_LABELS: Record<PdfOptions["size"], string> = {
  a4: "A4",
  letter: "Carta"
}

const PDF_THEME_HINTS: Record<PdfOptions["theme"], string> = {
  color: "Bandas y montos con los colores de tu espacio.",
  ink: "Sin rellenos de color: ideal para imprimir en blanco y negro."
}

interface Selection {
  period: Period
  /** YYYY-MM, YYYY-Qn o YYYY según el periodo */
  value: string
  /** YYYY-MM, solo en "range" */
  from: string
  to: string
}

const quarterOf = (month: string) =>
  `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`

const minMonth = (a: string, b: string) => (a < b ? a : b)
const maxMonth = (a: string, b: string) => (a > b ? a : b)

/** Meses (YYYY-MM) de una selección, cortados en el mes actual */
function selectionMonths(
  selection: Selection,
  current: string,
  historyStart: string
): { from: string; to: string } {
  switch (selection.period) {
    case "month":
      return { from: selection.value, to: selection.value }
    case "quarter": {
      const [year, quarter] = selection.value.split("-Q").map(Number)
      const first = (quarter - 1) * 3 + 1
      const pad = (n: number) => String(n).padStart(2, "0")
      return {
        from: `${year}-${pad(first)}`,
        to: minMonth(`${year}-${pad(first + 2)}`, current)
      }
    }
    case "year":
      return {
        from: `${selection.value}-01`,
        to: minMonth(`${selection.value}-12`, current)
      }
    case "range":
      return { from: selection.from, to: selection.to }
    case "all":
      return { from: historyStart, to: current }
  }
}

// Prellenado con el periodo de Reportes: mes, trimestre y año pasan igual;
// un rango por días pasa a los meses que contienen `from` y `to`
function initialSelection(
  searchParams: URLSearchParams,
  current: string
): Selection {
  const params = parseReportParams(Object.fromEntries(searchParams))
  const base = { from: current, to: current }

  if (params.period === "range") {
    return {
      period: "range",
      value: current,
      from: minMonth(params.from.slice(0, 7), current),
      to: minMonth(params.to.slice(0, 7), current)
    }
  }
  if (params.period === "month") {
    const value = minMonth(params.value ?? current, current)
    return { period: "month", value, from: value, to: value }
  }
  if (params.period === "quarter") {
    const value = params.value ?? quarterOf(current)
    return {
      period: "quarter",
      value: value > quarterOf(current) ? quarterOf(current) : value,
      ...base
    }
  }
  const value = params.value ?? current.slice(0, 4)
  return {
    period: "year",
    value: value > current.slice(0, 4) ? current.slice(0, 4) : value,
    ...base
  }
}

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
  const isMobile = useIsMobile()

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Backdrop>
        <Modal.Container
          scroll="outside"
          placement={isMobile ? "bottom" : "center"}
        >
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Exportar</Modal.Heading>
              <p className="text-sm text-muted">
                Descarga tus datos mes a mes para trabajarlos en Excel o Google
                Sheets.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* Se desmonta al cerrar: cada apertura toma el periodo actual */}
              <ExportForm
                workspaceId={workspaceId}
                historyStart={historyStart}
                onDone={() => onOpenChange(false)}
                onCancel={() => onOpenChange(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

/** Nombre del archivo desde Content-Disposition */
function fileNameFrom(response: Response, fallback: string) {
  const header = response.headers.get("Content-Disposition") ?? ""
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback
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
  const searchParams = useSearchParams()
  const { hidden } = useHideAmounts()
  const today = todayISO()
  const current = today.slice(0, 7)

  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>(DEFAULT_PDF_OPTIONS)
  const [selection, setSelection] = useState(() =>
    initialSelection(new URLSearchParams(searchParams.toString()), current)
  )
  const [pending, setPending] = useState(false)

  const start = historyStart ?? current
  const historyMonths = monthsSpanned(start, current)
  const isPdf = format === "pdf"
  // Con PDF el tope es de 12 meses; con Excel y CSV, de 36
  const maxMonths = isPdf ? MAX_PDF_MONTHS : MAX_EXPORT_MONTHS
  const allDisabled = historyStart === null || historyMonths > maxMonths

  // Opciones desde el primer mes con historial (o el prellenado, si es
  // anterior) hasta el actual, de la más reciente a la más antigua
  const firstOption = minMonth(
    start,
    minMonth(selection.from, `${selection.value.slice(0, 4)}-01`)
  )
  const optionMonths = listMonths(firstOption, current).reverse()
  const options = {
    months: optionMonths,
    quarters: [...new Set(optionMonths.map(quarterOf))],
    years: [...new Set(optionMonths.map((month) => month.slice(0, 4)))]
  }

  const { from, to } = selectionMonths(selection, current, start)
  const parsed = parseExportRange(from, to, today, format)
  const monthCount = parsed.success ? parsed.range.months.length : 0

  function changePeriod(period: Period) {
    setSelection((prev) => {
      const range = selectionMonths(prev, current, start)
      switch (period) {
        case "month":
          return { ...prev, period, value: range.to }
        case "quarter":
          return { ...prev, period, value: quarterOf(range.to) }
        case "year":
          return { ...prev, period, value: range.to.slice(0, 4) }
        case "range":
          return { ...prev, period, from: range.from, to: range.to }
        case "all":
          return { ...prev, period }
      }
    })
  }

  async function download() {
    if (!parsed.success) return
    setPending(true)

    try {
      const query = new URLSearchParams({
        format,
        from,
        to,
        ...(isPdf ? pdfOptions : {})
      })
      const response = await fetch(
        `/api/export/${workspaceId}?${query.toString()}`
      )

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        toast.danger(body?.error ?? "No se pudo generar el archivo.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileNameFrom(response, `tesoro.${format}`)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success("Archivo descargado")
      onDone()
    } catch {
      toast.danger("No se pudo descargar el archivo. Revisa tu conexión.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        selectedKey={format}
        onSelectionChange={(key) => setFormat(key as ExportFormat)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Formato">
            <Tabs.Tab id="xlsx">
              Excel (.xlsx)
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="csv">
              CSV (.csv)
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="pdf">
              PDF (.pdf)
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <PeriodSelect
        label="Periodo"
        value={selection.period}
        onChange={(value) => changePeriod(value as Period)}
        options={PERIODS.map((period) => ({
          id: period,
          label: PERIOD_LABELS[period],
          isDisabled: period === "all" && allDisabled
        }))}
      />
      {historyMonths > maxMonths && (
        <p className="-mt-2 text-sm text-muted">
          {isPdf
            ? `Tu historial tiene ${historyMonths} meses. El PDF admite hasta ${MAX_PDF_MONTHS}.`
            : `Tu historial tiene ${historyMonths} meses. Exporta por rangos de hasta ${MAX_EXPORT_MONTHS}.`}
        </p>
      )}

      {selection.period === "month" && (
        <PeriodSelect
          label="Mes"
          value={selection.value}
          onChange={(value) => setSelection({ ...selection, value })}
          options={options.months.map((month) => ({
            id: month,
            label: monthLabel(month)
          }))}
        />
      )}
      {selection.period === "quarter" && (
        <PeriodSelect
          label="Trimestre"
          value={selection.value}
          onChange={(value) => setSelection({ ...selection, value })}
          options={options.quarters.map((quarter) => ({
            id: quarter,
            label: `T${quarter.slice(-1)} ${quarter.slice(0, 4)}`
          }))}
        />
      )}
      {selection.period === "year" && (
        <PeriodSelect
          label="Año"
          value={selection.value}
          onChange={(value) => setSelection({ ...selection, value })}
          options={options.years.map((year) => ({ id: year, label: year }))}
        />
      )}
      {selection.period === "range" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PeriodSelect
            label="Desde"
            value={selection.from}
            onChange={(value) =>
              setSelection({
                ...selection,
                from: value,
                to: maxMonth(value, selection.to)
              })
            }
            options={options.months.map((month) => ({
              id: month,
              label: monthLabel(month)
            }))}
          />
          <PeriodSelect
            label="Hasta"
            value={selection.to}
            onChange={(value) =>
              setSelection({
                ...selection,
                to: value,
                from: minMonth(value, selection.from)
              })
            }
            options={options.months.map((month) => ({
              id: month,
              label: monthLabel(month)
            }))}
          />
        </div>
      )}

      {isPdf && (
        <>
          <PeriodSelect
            label="Tamaño"
            value={pdfOptions.size}
            onChange={(value) =>
              setPdfOptions({
                ...pdfOptions,
                size: value as PdfOptions["size"]
              })
            }
            options={Object.entries(PDF_SIZE_LABELS).map(([id, label]) => ({
              id,
              label
            }))}
          />
          <OptionTabs
            label="Orientación"
            value={pdfOptions.orientation}
            onChange={(value) =>
              setPdfOptions({
                ...pdfOptions,
                orientation: value as PdfOptions["orientation"]
              })
            }
            options={[
              { id: "portrait", label: "Vertical" },
              { id: "landscape", label: "Horizontal" }
            ]}
          />
          <OptionTabs
            label="Tema"
            value={pdfOptions.theme}
            onChange={(value) =>
              setPdfOptions({
                ...pdfOptions,
                theme: value as PdfOptions["theme"]
              })
            }
            options={[
              { id: "color", label: "Color" },
              { id: "ink", label: "Ahorro de tinta" }
            ]}
            hint={PDF_THEME_HINTS[pdfOptions.theme]}
          />
        </>
      )}

      <div
        className="flex flex-col gap-2 text-sm"
        aria-live="polite"
      >
        {parsed.success ? (
          <>
            {format === "xlsx" && (
              <p className="text-muted">
                Se crearán {monthCount} {monthCount === 1 ? "hoja" : "hojas"} de
                mes
              </p>
            )}
            {isPdf && (
              <p className="text-muted">
                Incluye {monthCount} {monthCount === 1 ? "mes" : "meses"} de
                detalle
              </p>
            )}
          </>
        ) : (
          <p
            role="alert"
            className="text-danger"
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
          variant="ghost"
          onPress={onCancel}
          className="max-md:min-h-11"
        >
          Cancelar
        </Button>
        <Button
          onPress={download}
          isDisabled={pending || !parsed.success}
          className="max-md:min-h-11"
        >
          {pending ? "Generando…" : "Descargar"}
        </Button>
      </div>
    </div>
  )
}

function PeriodSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string; isDisabled?: boolean }[]
}) {
  return (
    <Select
      fullWidth
      value={value}
      onChange={(key) => key !== null && onChange(String(key))}
      className="flex flex-col gap-2"
    >
      <Label>{label}</Label>
      <Select.Trigger className="min-h-11">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
              isDisabled={option.isDisabled}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

/** Tabs con etiqueta visible, para opciones de pocas alternativas */
function OptionTabs({
  label,
  value,
  onChange,
  options,
  hint
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
  hint?: string
}) {
  const labelId = useId()

  return (
    <div className="flex flex-col gap-2">
      <span
        id={labelId}
        className="text-sm font-medium"
      >
        {label}
      </span>
      <Tabs
        selectedKey={value}
        onSelectionChange={(key) => onChange(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-labelledby={labelId}>
            {options.map((option) => (
              <Tabs.Tab
                key={option.id}
                id={option.id}
              >
                {option.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}
