import { monthLabel } from "../range"
import { PeriodSelect } from "./export-option-fields"
import { type ExportSelection, maxMonth, minMonth } from "./export-selection"

interface ExportPeriodFieldsProps {
  selection: ExportSelection
  onChange: (selection: ExportSelection) => void
  options: { months: string[]; quarters: string[]; years: string[] }
}

/** Mes, trimestre, año o rango según el periodo elegido */
export function ExportPeriodFields({
  selection,
  onChange,
  options
}: ExportPeriodFieldsProps) {
  const monthOptions = options.months.map((month) => ({
    id: month,
    label: monthLabel(month)
  }))

  return (
    <>
      {selection.period === "month" && (
        <PeriodSelect
          label="Mes"
          help="export.periodValue"
          value={selection.value}
          onChange={(value) => onChange({ ...selection, value })}
          options={monthOptions}
        />
      )}
      {selection.period === "quarter" && (
        <PeriodSelect
          label="Trimestre"
          help="export.periodValue"
          value={selection.value}
          onChange={(value) => onChange({ ...selection, value })}
          options={options.quarters.map((quarter) => ({
            id: quarter,
            label: `T${quarter.slice(-1)} ${quarter.slice(0, 4)}`
          }))}
        />
      )}
      {selection.period === "year" && (
        <PeriodSelect
          label="Año"
          help="export.periodValue"
          value={selection.value}
          onChange={(value) => onChange({ ...selection, value })}
          options={options.years.map((year) => ({ id: year, label: year }))}
        />
      )}
      {selection.period === "range" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PeriodSelect
            label="Desde"
            help="common.from"
            value={selection.from}
            onChange={(value) =>
              onChange({
                ...selection,
                from: value,
                to: maxMonth(value, selection.to)
              })
            }
            options={monthOptions}
          />
          <PeriodSelect
            label="Hasta"
            help="common.until"
            value={selection.to}
            onChange={(value) =>
              onChange({
                ...selection,
                to: value,
                from: minMonth(value, selection.from)
              })
            }
            options={monthOptions}
          />
        </div>
      )}
    </>
  )
}
