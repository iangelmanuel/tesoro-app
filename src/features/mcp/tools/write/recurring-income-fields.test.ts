import { describe, expect, it } from "vitest"
import {
  type Schedule,
  scheduleMissing,
  withBiweeklyDefaults
} from "./recurring-income-fields"

const schedule = (fields: Partial<Schedule>): Schedule => ({
  frequency: "monthly",
  day_of_month: null,
  second_day_of_month: null,
  day_of_week: null,
  interval_days: null,
  month_of_year: null,
  ...fields
})

describe("scheduleMissing", () => {
  it("cada frecuencia pide sus días", () => {
    expect(
      scheduleMissing(schedule({ frequency: "weekly" })).map((m) => m.field)
    ).toEqual(["day_of_week"])
    expect(
      scheduleMissing(schedule({ frequency: "yearly" })).map((m) => m.field)
    ).toEqual(["day_of_month", "month_of_year"])
    expect(
      scheduleMissing(schedule({ frequency: "every_n_days" }))[0].question
    ).toBe("¿Cada cuántos días llega? (2–90)")
    expect(scheduleMissing(schedule({ frequency: "none" }))).toEqual([])
    expect(
      scheduleMissing(schedule({ frequency: "monthly", day_of_month: 5 }))
    ).toEqual([])
  })

  it("el día de la semana trae sus opciones", () => {
    expect(
      scheduleMissing(schedule({ frequency: "weekly" }))[0].options?.[0]
    ).toEqual({ id: "1", label: "Lunes" })
  })
})

describe("withBiweeklyDefaults", () => {
  it("quincenal sin días: 15 y 30; otras no cambian", () => {
    expect(
      withBiweeklyDefaults(schedule({ frequency: "biweekly" }))
    ).toMatchObject({ day_of_month: 15, second_day_of_month: 30 })
    expect(
      withBiweeklyDefaults(schedule({ frequency: "biweekly", day_of_month: 1 }))
    ).toMatchObject({ day_of_month: 1, second_day_of_month: 30 })
    const monthly = schedule({})
    expect(withBiweeklyDefaults(monthly)).toBe(monthly)
  })
})
