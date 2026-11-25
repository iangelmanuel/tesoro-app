"use client"

import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import {
  MONTH_OPTIONS,
  type ScheduleDraft,
  WEEKDAY_OPTIONS
} from "../income-schedule"
import {
  INTERVAL_DAYS_MAX,
  INTERVAL_DAYS_MIN,
  usesDayOfMonth
} from "../schemas"
import type { RecurringIncomeFormState } from "../types"

/** Datos del calendario que pide cada frecuencia, y solo esos */
export function RecurringIncomeDialogSchedule({
  draft,
  onChange,
  errors
}: {
  draft: ScheduleDraft
  onChange: (key: keyof ScheduleDraft, value: string) => void
  errors: RecurringIncomeFormState["fieldErrors"]
}) {
  const { frequency } = draft
  const hasMonthDay = usesDayOfMonth(frequency)

  return (
    <>
      {frequency === "weekly" && (
        <SelectField
          name="day_of_week"
          label="Día de la semana"
          help="recurringIncome.weekday"
          placeholder="Elige un día"
          value={draft.dayOfWeek}
          onChange={(value) => onChange("dayOfWeek", value)}
          options={WEEKDAY_OPTIONS}
          error={errors?.day_of_week?.[0]}
        />
      )}

      {frequency === "every_n_days" && (
        <TextInputField
          name="interval_days"
          label="Cada cuántos días"
          help="recurringIncome.everyDays"
          type="number"
          inputMode="numeric"
          min={INTERVAL_DAYS_MIN}
          max={INTERVAL_DAYS_MAX}
          placeholder="14"
          value={draft.intervalDays}
          onChange={(event) => onChange("intervalDays", event.target.value)}
          isRequired
          error={errors?.interval_days?.[0]}
        />
      )}

      {hasMonthDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInputField
            name="day_of_month"
            label={
              frequency === "biweekly" ? "Primer día de pago" : "Día de pago"
            }
            help="recurringIncome.day"
            helpLabel="Día de pago"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="30"
            value={draft.dayOfMonth}
            onChange={(event) => onChange("dayOfMonth", event.target.value)}
            isRequired
            error={errors?.day_of_month?.[0]}
          />

          {frequency === "biweekly" && (
            <TextInputField
              name="second_day_of_month"
              label="Segundo día de pago"
              help="recurringIncome.secondDay"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              placeholder="30"
              value={draft.secondDay}
              onChange={(event) => onChange("secondDay", event.target.value)}
              isRequired
              error={errors?.second_day_of_month?.[0]}
            />
          )}

          {frequency === "yearly" && (
            <SelectField
              name="month_of_year"
              label="Mes de pago"
              help="recurringIncome.month"
              placeholder="Elige un mes"
              value={draft.monthOfYear}
              onChange={(value) => onChange("monthOfYear", value)}
              options={MONTH_OPTIONS}
              error={errors?.month_of_year?.[0]}
            />
          )}
        </div>
      )}
      {hasMonthDay && (
        <p className="-mt-2 text-sm text-muted-foreground">
          Si el mes no tiene ese día, cuenta el último día del mes.
        </p>
      )}
    </>
  )
}
