import { describe, expect, it } from "vitest"
import {
  getIncomeOccurrenceStatus,
  incomeDueDates,
  incomeFrequencyLabel,
  isoWeekday,
  occurrenceLabel,
  occurrenceRemaining,
  shortOccurrenceDate,
  weekdayName
} from "./occurrences"
import type { IncomeFrequency } from "./schemas"

// Tests de caracterización (SPEC 55b): fijan las ocurrencias de los ingresos
// fijos antes del refactor de la feature

const SCHEDULE = {
  frequency: "monthly" as IncomeFrequency,
  day_of_month: 31 as number | null,
  second_day_of_month: null as number | null,
  month_of_year: null as number | null,
  day_of_week: null as number | null,
  interval_days: null as number | null,
  starts_on: "2026-01-01",
  ends_on: null as string | null
}

type Schedule = typeof SCHEDULE

function dates(
  fields: Partial<Schedule>,
  from = "2026-01-01",
  to = "2026-04-30"
) {
  return incomeDueDates({ ...SCHEDULE, ...fields }, from, to)
}

describe("occurrenceRemaining y getIncomeOccurrenceStatus", () => {
  it("lo que falta en centavos, nunca negativo", () => {
    expect(occurrenceRemaining({ amount: 100.1, received_amount: 0.3 })).toBe(
      99.8
    )
    expect(occurrenceRemaining({ amount: 100, received_amount: 150 })).toBe(0)
  })

  it("recibido, abonado o según la fecha", () => {
    const status = (due_on: string, received_amount: number) =>
      getIncomeOccurrenceStatus(
        { due_on, amount: 100, received_amount },
        "2026-06-15"
      )
    expect(status("2026-06-01", 100)).toBe("received")
    expect(status("2026-06-01", 40)).toBe("partial")
    expect(status("2026-06-14", 0)).toBe("overdue")
    expect(status("2026-06-15", 0)).toBe("today")
    expect(status("2026-06-16", 0)).toBe("pending")
  })
})

describe("incomeDueDates", () => {
  it("mensual: el día que no existe cae en el último del mes", () => {
    expect(dates({})).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30"
    ])
  })

  it("quincenal y anual", () => {
    expect(
      dates({
        frequency: "biweekly",
        day_of_month: 15,
        second_day_of_month: 30
      })
    ).toMatchInlineSnapshot(`
      [
        "2026-01-15",
        "2026-01-30",
        "2026-02-15",
        "2026-02-28",
        "2026-03-15",
        "2026-03-30",
        "2026-04-15",
        "2026-04-30",
      ]
    `)
    expect(
      dates({ frequency: "yearly", day_of_month: 10, month_of_year: 3 })
    ).toEqual(["2026-03-10"])
  })

  it("semanal, diaria y cada N días", () => {
    expect(
      dates({ frequency: "weekly", day_of_week: 6 }, "2026-01-01", "2026-01-31")
    ).toMatchInlineSnapshot(`
      [
        "2026-01-03",
        "2026-01-10",
        "2026-01-17",
        "2026-01-24",
        "2026-01-31",
      ]
    `)
    expect(dates({ frequency: "daily" }, "2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02"
    ])
    expect(
      dates(
        {
          frequency: "every_n_days",
          interval_days: 10,
          starts_on: "2026-01-05"
        },
        "2026-01-20",
        "2026-02-20"
      )
    ).toEqual(["2026-01-25", "2026-02-04", "2026-02-14"])
  })

  it("respeta inicio y fin, y sin fecha fija no tiene", () => {
    expect(dates({ starts_on: "2026-02-15", ends_on: "2026-03-31" })).toEqual([
      "2026-02-28",
      "2026-03-31"
    ])
    expect(dates({ frequency: "none" })).toEqual([])
    expect(dates({ starts_on: "2026-05-01" })).toEqual([])
  })
})

describe("textos", () => {
  it("día de la semana y fecha corta", () => {
    expect(isoWeekday("2026-06-14")).toBe(7)
    expect(weekdayName(1)).toBe("lunes")
    expect(weekdayName(8)).toBe("")
    expect(shortOccurrenceDate("2026-11-07")).toMatchInlineSnapshot(
      `"sáb 7 nov"`
    )
  })

  it("etiqueta de la ocurrencia según la frecuencia", () => {
    const frequencies: IncomeFrequency[] = [
      "biweekly",
      "yearly",
      "weekly",
      "monthly"
    ]
    expect(
      frequencies.map((frequency) => occurrenceLabel(frequency, "2026-11-15"))
    ).toMatchInlineSnapshot(`
      [
        "Quincena del 15 nov",
        "Año 2026",
        "dom 15 nov",
        "Mes de noviembre",
      ]
    `)
  })

  it("etiqueta de la frecuencia", () => {
    const label = (fields: Partial<Schedule>) =>
      incomeFrequencyLabel({ ...SCHEDULE, ...fields })
    expect([
      label({ day_of_month: 5 }),
      label({
        frequency: "biweekly",
        day_of_month: 15,
        second_day_of_month: 30
      }),
      label({ frequency: "yearly", day_of_month: 15, month_of_year: 3 }),
      label({ frequency: "yearly", day_of_month: 15 }),
      label({ frequency: "weekly", day_of_week: 6 }),
      label({ frequency: "weekly" }),
      label({ frequency: "daily" }),
      label({ frequency: "every_n_days", interval_days: 14 }),
      label({ frequency: "none" })
    ]).toMatchInlineSnapshot(`
      [
        "Mensual, día 5",
        "Quincenal, días 15 y 30",
        "Anual, 15 de marzo",
        "Anual, día 15",
        "Semanal, cada sábado",
        "Semanal",
        "Diario",
        "Cada 14 días",
        "Sin fecha fija",
      ]
    `)
  })
})
