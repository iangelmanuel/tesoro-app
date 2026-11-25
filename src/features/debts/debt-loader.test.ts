import { describe, expect, it } from "vitest"
import { loadedEntry } from "@/testing/debt-service-fixtures"
import { entryRecord } from "./debt-loader"

describe("entryRecord", () => {
  it("quita la deuda y deja la fila del abono", () => {
    const entry = loadedEntry({ id: "e1" })
    const record = entryRecord(entry)
    expect("debt" in record).toBe(false)
    expect(record.id).toBe("e1")
  })
})
