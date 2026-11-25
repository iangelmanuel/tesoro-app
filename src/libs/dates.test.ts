import { describe, expect, it } from "vitest"
import {
  TIME_ZONE,
  addDays,
  countMonths,
  currentMonth,
  fromLocalDate,
  greeting,
  listMonths,
  monthRange,
  shiftMonth,
  toLocalDate,
  todayISO,
  trimSeconds
} from "./dates"

// America/Bogota es UTC-5 todo el año (sin horario de verano)
describe("TIME_ZONE", () => {
  it("es la zona del producto", () => {
    expect(TIME_ZONE).toBe("America/Bogota")
  })
})

describe("todayISO", () => {
  it("da la fecha en Bogotá, no en UTC", () => {
    // 03:00 UTC del 2 de enero = 22:00 del 1 de enero en Bogotá
    expect(todayISO(new Date("2026-01-02T03:00:00Z"))).toBe("2026-01-01")
    expect(todayISO(new Date("2026-01-02T05:00:00Z"))).toBe("2026-01-02")
  })
})

describe("currentMonth", () => {
  it("da el mes YYYY-MM en Bogotá", () => {
    expect(currentMonth(new Date("2026-03-01T04:59:00Z"))).toBe("2026-02")
    expect(currentMonth(new Date("2026-03-01T05:00:00Z"))).toBe("2026-03")
  })
})

describe("greeting", () => {
  const at = (hourBogota: number) =>
    new Date(Date.UTC(2026, 5, 10, hourBogota + 5, 30))

  it("saluda según la hora de Bogotá", () => {
    expect(greeting(at(4))).toBe("Buenas noches")
    expect(greeting(at(5))).toBe("Buenos días")
    expect(greeting(at(11))).toBe("Buenos días")
    expect(greeting(at(12))).toBe("Buenas tardes")
    expect(greeting(at(18))).toBe("Buenas tardes")
    expect(greeting(at(19))).toBe("Buenas noches")
  })
})

describe("monthRange", () => {
  it("da el primer y el último día del mes", () => {
    expect(monthRange("2026-01")).toEqual({
      from: "2026-01-01",
      to: "2026-01-31"
    })
    expect(monthRange("2026-04")).toEqual({
      from: "2026-04-01",
      to: "2026-04-30"
    })
  })

  it("respeta los años bisiestos", () => {
    expect(monthRange("2024-02").to).toBe("2024-02-29")
    expect(monthRange("2026-02").to).toBe("2026-02-28")
  })
})

describe("shiftMonth", () => {
  it("avanza y retrocede cruzando el año", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-05", 0)).toBe("2026-05")
    expect(shiftMonth("2026-05", -17)).toBe("2024-12")
  })
})

describe("toLocalDate / fromLocalDate", () => {
  it("convierte sin correr el día", () => {
    const date = toLocalDate("2026-03-09")
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(9)
    expect(fromLocalDate(date)).toBe("2026-03-09")
  })

  it("rellena mes y día con cero", () => {
    expect(fromLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

// Antes `monthsBetween` de score/curves.ts (SPEC 54)
describe("listMonths", () => {
  it("lista los meses de `from` a `to`, inclusive", () => {
    expect(listMonths("2026-10", "2027-02")).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02"
    ])
  })

  it("da un solo mes si coinciden", () => {
    expect(listMonths("2026-05", "2026-05")).toEqual(["2026-05"])
  })

  it("da vacío si `from` va después de `to`", () => {
    expect(listMonths("2026-06", "2026-05")).toEqual([])
  })
})

// Antes `monthsBetween` de mcp/tools/read/report-helpers.ts (SPEC 54)
describe("countMonths", () => {
  it("cuenta los meses de `from` a `to`, ambos incluidos", () => {
    expect(countMonths("2026-10", "2027-02")).toBe(5)
    expect(countMonths("2026-01", "2026-12")).toBe(12)
  })

  it("da 1 si coinciden", () => {
    expect(countMonths("2026-05", "2026-05")).toBe(1)
  })

  it("da cero o negativo si `from` va después de `to`", () => {
    expect(countMonths("2026-06", "2026-05")).toBe(0)
    expect(countMonths("2026-08", "2026-05")).toBe(-2)
  })
})

// Antes `formatTime` de mcp/tools/shared.ts (SPEC 54)
describe("trimSeconds", () => {
  it("recorta los segundos de Postgres", () => {
    expect(trimSeconds("14:30:00")).toBe("14:30")
    expect(trimSeconds("08:05")).toBe("08:05")
  })

  it("da null sin hora", () => {
    expect(trimSeconds(null)).toBeNull()
    expect(trimSeconds("")).toBeNull()
  })
})

describe("addDays", () => {
  it("suma y resta días cruzando meses y años", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
  })
})
