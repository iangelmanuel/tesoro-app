import { describe, expect, it } from "vitest"
import {
  FREQUENCY_OPTIONS,
  MONTH_OPTIONS,
  type ScheduleDraft,
  WEEKDAY_OPTIONS,
  initialScheduleDraft,
  scheduleSummary,
  withFrequency
} from "./income-schedule"

const DRAFT: ScheduleDraft = {
  frequency: "monthly",
  dayOfMonth: "",
  secondDay: "",
  monthOfYear: "",
  dayOfWeek: "",
  intervalDays: "",
  startsOn: "2026-11-03",
  endsOn: ""
}

const summary = (fields: Partial<ScheduleDraft>) =>
  scheduleSummary({ ...DRAFT, ...fields })

describe("opciones", () => {
  it("meses, días y frecuencias con mayúscula inicial", () => {
    expect(MONTH_OPTIONS[0]).toEqual({ value: "1", label: "Enero" })
    expect(WEEKDAY_OPTIONS[6]).toEqual({ value: "7", label: "Domingo" })
    expect(FREQUENCY_OPTIONS.map((option) => option.label))
      .toMatchInlineSnapshot(`
      [
        "Semanal",
        "Quincenal",
        "Mensual",
        "Anual",
        "Diaria",
        "Cada N días",
        "Sin fecha fija",
      ]
    `)
  })
})

describe("scheduleSummary", () => {
  it("describe cada frecuencia con datos completos", () => {
    expect([
      summary({ frequency: "weekly", dayOfWeek: "6" }),
      summary({ frequency: "daily" }),
      summary({ frequency: "every_n_days", intervalDays: "14" }),
      summary({ frequency: "monthly", dayOfMonth: "5" }),
      summary({ frequency: "biweekly", dayOfMonth: "15", secondDay: "30" }),
      summary({ frequency: "yearly", dayOfMonth: "15", monthOfYear: "3" }),
      summary({ frequency: "monthly", dayOfMonth: "5", endsOn: "2027-06-30" })
    ]).toMatchInlineSnapshot(`
      [
        "Cada sábado",
        "Todos los días desde el 3 de nov",
        "Cada 14 días desde el 3 de nov",
        "Cada mes, el día 5",
        "Los días 15 y 30 de cada mes",
        "Cada 15 de marzo",
        "Cada mes, el día 5 hasta el 30 de jun",
      ]
    `)
  })

  it("da null si faltan datos o es sin fecha fija", () => {
    expect(summary({ frequency: "weekly" })).toBeNull()
    expect(summary({ frequency: "daily", startsOn: "" })).toBeNull()
    expect(
      summary({ frequency: "every_n_days", intervalDays: "1.5" })
    ).toBeNull()
    expect(summary({ frequency: "every_n_days", intervalDays: "0" })).toBeNull()
    expect(summary({ frequency: "biweekly", dayOfMonth: "15" })).toBeNull()
    expect(summary({ frequency: "yearly", dayOfMonth: "15" })).toBeNull()
    expect(summary({ frequency: "none", endsOn: "2027-01-01" })).toBeNull()
  })
})

describe("initialScheduleDraft", () => {
  it("un ingreso nuevo es mensual, desde hoy y sin fin", () => {
    expect(initialScheduleDraft(undefined, "2026-06-15")).toEqual({
      ...DRAFT,
      startsOn: "2026-06-15"
    })
  })

  it("uno guardado pasa sus días a texto", () => {
    expect(
      initialScheduleDraft(
        {
          frequency: "biweekly",
          day_of_month: 15,
          second_day_of_month: 30,
          month_of_year: null,
          day_of_week: null,
          interval_days: null,
          starts_on: "2026-01-01",
          ends_on: "2026-12-31"
        },
        "2026-06-15"
      )
    ).toEqual({
      ...DRAFT,
      frequency: "biweekly",
      dayOfMonth: "15",
      secondDay: "30",
      startsOn: "2026-01-01",
      endsOn: "2026-12-31"
    })
  })
})

describe("withFrequency", () => {
  it("la misma frecuencia no cambia nada", () => {
    expect(withFrequency(DRAFT, "monthly")).toBe(DRAFT)
  })

  it("quincenal propone 15 y 30 solo en los días vacíos", () => {
    expect(withFrequency(DRAFT, "biweekly")).toMatchObject({
      frequency: "biweekly",
      dayOfMonth: "15",
      secondDay: "30"
    })
    expect(
      withFrequency({ ...DRAFT, dayOfMonth: "5" }, "biweekly")
    ).toMatchObject({ dayOfMonth: "5", secondDay: "30" })
  })

  it("semanal propone el día de la fecha de inicio si no hay", () => {
    // 3 de noviembre de 2026: martes
    expect(withFrequency(DRAFT, "weekly").dayOfWeek).toBe("2")
    expect(
      withFrequency({ ...DRAFT, dayOfWeek: "6" }, "weekly").dayOfWeek
    ).toBe("6")
    expect(withFrequency({ ...DRAFT, startsOn: "" }, "weekly").dayOfWeek).toBe(
      ""
    )
  })
})
