import { describe, expect, it } from "vitest"
import {
  compareByTargetDate,
  expectedSaved,
  goalPercent,
  goalRemaining,
  goalStartDate,
  goalStatus,
  isOverdue,
  isReached,
  monthsRemaining,
  suggestedMonthly
} from "./progress"

// Tests de caracterización (SPEC 55b): fijan el progreso de las metas antes
// del refactor de la feature

const GOAL = {
  target_amount: 3_640_000,
  target_date: "2026-12-31",
  status: "active" as const,
  // 1 de enero en America/Bogota (5:00 UTC)
  created_at: "2026-01-01T15:00:00Z",
  saved: 1_000_000
}

describe("goalPercent y goalRemaining", () => {
  it("trunca el porcentaje y puede pasar de 100", () => {
    expect(goalPercent(1, 3)).toBe(33)
    expect(goalPercent(150, 100)).toBe(150)
    expect(goalPercent(-10, 100)).toBe(0)
  })

  it("lo que falta nunca es negativo", () => {
    expect(goalRemaining(400, 1_000)).toBe(600)
    expect(goalRemaining(1_200, 1_000)).toBe(0)
  })
})

describe("monthsRemaining", () => {
  it("cuenta desde el mes siguiente hasta el objetivo, mínimo 1", () => {
    expect(monthsRemaining("2026-12-15", "2026-10-30")).toBe(2)
    expect(monthsRemaining("2027-03-01", "2026-10-30")).toBe(5)
    expect(monthsRemaining("2026-10-31", "2026-10-30")).toBe(1)
    expect(monthsRemaining("2026-01-01", "2026-10-30")).toBe(1)
  })
})

describe("goalStartDate", () => {
  it("usa la fecha de America/Bogota", () => {
    expect(goalStartDate("2026-03-01T03:00:00Z")).toBe("2026-02-28")
    expect(goalStartDate("2026-03-01T15:00:00Z")).toBe("2026-03-01")
  })
})

describe("expectedSaved", () => {
  it("avanza lineal desde la creación con tope en el objetivo", () => {
    expect(expectedSaved(GOAL, GOAL.target_date, "2026-01-01")).toBe(0)
    expect(expectedSaved(GOAL, GOAL.target_date, "2026-04-11")).toBe(1_000_000)
    expect(expectedSaved(GOAL, GOAL.target_date, "2027-02-01")).toBe(3_640_000)
    expect(expectedSaved(GOAL, GOAL.target_date, "2025-12-01")).toBe(0)
  })

  it("con objetivo no posterior al inicio espera el total", () => {
    expect(expectedSaved(GOAL, "2026-01-01", "2026-01-01")).toBe(3_640_000)
  })
})

describe("suggestedMonthly", () => {
  it("reparte lo que falta entre los meses restantes", () => {
    expect(suggestedMonthly(GOAL, "2026-10-30")).toBe(2_640_000 / 2)
  })

  it("da null sin fecha o sin faltante", () => {
    expect(suggestedMonthly({ ...GOAL, target_date: null })).toBeNull()
    expect(suggestedMonthly({ ...GOAL, saved: 4_000_000 })).toBeNull()
  })
})

describe("goalStatus", () => {
  it("compara lo ahorrado con lo esperado", () => {
    expect(goalStatus(GOAL, "2026-04-11")).toBe("on_track")
    expect(goalStatus(GOAL, "2026-04-12")).toBe("at_risk")
  })

  it("respeta cumplidas, archivadas y metas sin fecha", () => {
    expect(goalStatus({ ...GOAL, status: "completed" })).toBe("completed")
    expect(goalStatus({ ...GOAL, status: "archived" })).toBe("archived")
    expect(goalStatus({ ...GOAL, target_date: null })).toBeNull()
  })
})

describe("isOverdue e isReached", () => {
  it("vencida: activa, fecha pasada y con faltante", () => {
    expect(isOverdue(GOAL, "2027-01-01")).toBe(true)
    expect(isOverdue(GOAL, "2026-12-31")).toBe(false)
    expect(isOverdue({ ...GOAL, saved: 3_640_000 }, "2027-01-01")).toBe(false)
    expect(isOverdue({ ...GOAL, status: "archived" }, "2027-01-01")).toBe(false)
  })

  it("alcanzada: activa y con lo ahorrado ≥ objetivo", () => {
    expect(isReached({ ...GOAL, saved: 3_640_000 })).toBe(true)
    expect(isReached(GOAL)).toBe(false)
    expect(isReached({ ...GOAL, saved: 4_000_000, status: "completed" })).toBe(
      false
    )
  })
})

describe("compareByTargetDate", () => {
  it("ordena por fecha objetivo, sin fecha al final y empates por creación", () => {
    const goals = [
      { id: "sin-fecha", target_date: null, created_at: "2026-01-01" },
      { id: "dic", target_date: "2026-12-31", created_at: "2026-01-05" },
      { id: "jun-b", target_date: "2026-06-30", created_at: "2026-02-01" },
      { id: "jun-a", target_date: "2026-06-30", created_at: "2026-01-15" }
    ]
    expect(goals.sort(compareByTargetDate).map((goal) => goal.id)).toEqual([
      "jun-a",
      "jun-b",
      "dic",
      "sin-fecha"
    ])
  })
})
