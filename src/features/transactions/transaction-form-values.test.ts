import { describe, expect, it } from "vitest"
import {
  applyPrefill,
  initialTransactionFields,
  isFormPanel,
  savedToastTitle,
  transactionCategoryOptions,
  transactionDialogText
} from "./transaction-form-values"
import type { EditableTransaction } from "./types"

const TODAY = "2026-11-24"
const ARCHIVED = "2026-01-01T00:00:00Z"

const CATEGORIES = [
  { id: "c1", type: "expense" as const, archived_at: null },
  { id: "c2", type: "expense" as const, archived_at: ARCHIVED },
  { id: "c3", type: "income" as const, archived_at: null }
]

const TRANSACTION: EditableTransaction = {
  id: "t1",
  type: "income",
  amount: 1500000.5,
  occurred_on: "2026-11-10",
  occurred_time: "08:30:00",
  category_id: "c3",
  description: "Salario",
  note: null,
  account_id: "a1",
  counterparty: null,
  invoice_ref: null,
  recurring_expense_id: null,
  recurring_income_id: "r1",
  recurring_income_allocations: []
}

describe("isFormPanel", () => {
  it("reconoce los paneles y descarta los tipos", () => {
    expect(isFormPanel("transfer")).toBe(true)
    expect(isFormPanel("goal")).toBe(true)
    expect(isFormPanel("expense")).toBe(false)
    expect(isFormPanel(undefined)).toBe(false)
  })
})

describe("transactionDialogText", () => {
  it("edita, registra un pago o crea según el modo", () => {
    expect(
      transactionDialogText({ isEditing: true, isPayment: false }, "personal")
        .title
    ).toBe("Editar movimiento")
    expect(
      transactionDialogText({ isEditing: false, isPayment: true }, "personal")
    ).toEqual({
      title: "Registrar pago",
      description: "Confirma los datos del pago. Puedes ajustar el monto."
    })
    expect(
      transactionDialogText({ isEditing: false, isPayment: false }, "business")
    ).toEqual({
      title: "Nuevo movimiento",
      description: "Registra una entrada o una salida de tu empresa."
    })
  })
})

describe("savedToastTitle", () => {
  it("nombra lo que se guardó", () => {
    expect(savedToastTitle({ isEditing: true, isPayment: true })).toBe(
      "Movimiento actualizado"
    )
    expect(savedToastTitle({ isEditing: false, isPayment: true })).toBe(
      "Pago registrado"
    )
    expect(savedToastTitle({ isEditing: false, isPayment: false })).toBe(
      "Movimiento registrado"
    )
  })
})

describe("initialTransactionFields", () => {
  it("sin datos: salida de hoy, vacía y sin ingreso fijo", () => {
    expect(initialTransactionFields({ categories: CATEGORIES }, TODAY)).toEqual(
      {
        type: "expense",
        amount: "",
        category: "",
        account: "",
        description: "",
        date: TODAY,
        time: "",
        incomeSourceId: "other",
        initialCategoryUnavailable: false,
        prefilled: { amount: "", category: "", account: "", description: "" }
      }
    )
  })

  it("al editar toma los valores del movimiento", () => {
    expect(
      initialTransactionFields(
        { transaction: TRANSACTION, categories: CATEGORIES },
        TODAY
      )
    ).toMatchObject({
      type: "income",
      amount: "1.500.000,5",
      category: "c3",
      account: "a1",
      description: "Salario",
      date: "2026-11-10",
      time: "08:30",
      incomeSourceId: "r1"
    })
  })

  it("deja vacía la categoría prellenada archivada o inexistente", () => {
    for (const category_id of ["c2", "zz"]) {
      expect(
        initialTransactionFields(
          { initialValues: { category_id }, categories: CATEGORIES },
          TODAY
        )
      ).toMatchObject({ category: "", initialCategoryUnavailable: true })
    }
  })

  it("con ingreso fijo elegido, lo prellenado son los valores iniciales", () => {
    const fields = initialTransactionFields(
      {
        initialValues: {
          type: "income",
          amount: 2000,
          category_id: "c3",
          account_id: "a1",
          description: "Ingreso Salario · noviembre",
          recurring_income_id: "r1"
        },
        categories: CATEGORIES
      },
      TODAY
    )
    expect(fields.prefilled).toEqual({
      amount: "2.000",
      category: "c3",
      account: "a1",
      description: "Ingreso Salario · noviembre"
    })
  })
})

describe("applyPrefill", () => {
  const prefilled = {
    amount: "1.000",
    category: "c3",
    account: "a1",
    description: "Ingreso A"
  }
  const next = {
    amount: "2.000",
    category: "c4",
    account: "a2",
    description: "Ingreso B"
  }

  it("reemplaza lo vacío y lo que sigue prellenado", () => {
    expect(
      applyPrefill(
        { amount: "", category: "c3", account: "", description: "Ingreso A" },
        prefilled,
        next
      )
    ).toEqual(next)
  })

  it("respeta lo que el usuario cambió", () => {
    expect(
      applyPrefill(
        {
          amount: "5.000",
          category: "c9",
          account: "a1",
          description: "Mío"
        },
        prefilled,
        next
      )
    ).toEqual({
      amount: "5.000",
      category: "c9",
      account: "a2",
      description: "Mío"
    })
  })
})

describe("transactionCategoryOptions", () => {
  it("ofrece las activas del tipo", () => {
    expect(
      transactionCategoryOptions(CATEGORIES, "expense").map(
        (category) => category.id
      )
    ).toEqual(["c1"])
  })

  it("mantiene la archivada actual del movimiento editado", () => {
    expect(
      transactionCategoryOptions(CATEGORIES, "expense", "c2").map(
        (category) => category.id
      )
    ).toEqual(["c1", "c2"])
  })
})
