import { describe, expect, it } from "vitest"
import { usesPaymentAccount } from "./entry-types"
import {
  type PaymentInitialValues,
  type PaymentMode,
  cardEffect,
  initialPaymentMode,
  keepsPrefill,
  notePlaceholder,
  paymentAction,
  paymentModes,
  paymentToast,
  prefilledAccount,
  prefilledAmount,
  prefilledDescription,
  prefilledNote
} from "./payment-form-values"

const MODES: PaymentMode[] = [
  "payment",
  "extra",
  "purchase",
  "advance",
  "fee",
  "adjustment"
]

const DESCRIPTIONS = {
  payment: "Pago Visa · junio",
  extra: "Pago Visa",
  amount: 150_000
}

const DUPLICATE: PaymentInitialValues = {
  mode: "advance",
  amount: 300_000,
  account_id: "bank",
  description: "Avance Visa",
  note: "Cajero"
}

describe("tipos y acción", () => {
  it("una cuenta por cobrar solo abona; tarjeta y préstamo, los del editor", () => {
    expect(paymentModes("receivable")).toEqual(["payment"])
    expect(paymentModes("loan")).toEqual(["payment", "extra", "adjustment"])
    expect(paymentModes("credit_card")).toEqual(MODES)
  })

  it("arranca con el tipo del duplicado si la deuda lo admite", () => {
    expect(initialPaymentMode(MODES, DUPLICATE)).toBe("advance")
    expect(initialPaymentMode(paymentModes("loan"), DUPLICATE)).toBe("payment")
    expect(initialPaymentMode(MODES)).toBe("payment")
  })

  it("toast: una cuenta por cobrar siempre registra un abono", () => {
    expect(paymentToast("purchase", "credit_card")).toBe("Compra registrada")
    expect(paymentToast("payment", "receivable")).toBe("Abono registrado")
  })

  it("cada tipo va a su server action", () => {
    expect(MODES.map(paymentAction)).toEqual([
      "payment",
      "payment",
      "advance",
      "advance",
      "charge",
      "charge"
    ])
  })
})

describe("prellenado por tipo", () => {
  it("monto, descripción y nota", () => {
    expect(
      MODES.map((mode) => [
        prefilledAmount(mode, DESCRIPTIONS),
        prefilledDescription(mode, DESCRIPTIONS),
        prefilledNote(mode, DESCRIPTIONS)
      ])
    ).toMatchInlineSnapshot(`
      [
        [
          "150.000",
          "Pago Visa · junio",
          "Pago Visa · junio",
        ],
        [
          "",
          "Pago Visa",
          "Pago Visa",
        ],
        [
          "",
          "Pago Visa · junio",
          "",
        ],
        [
          "",
          "Pago Visa · junio",
          "",
        ],
        [
          "",
          "Pago Visa · junio",
          "",
        ],
        [
          "",
          "Pago Visa · junio",
          "",
        ],
      ]
    `)
    expect(prefilledAmount("payment")).toBe("")
    expect(prefilledDescription("payment")).toBeUndefined()
    expect(prefilledNote("payment")).toBe("")
  })

  it("cuenta: la del duplicado, ninguna en un avance o la de siempre", () => {
    const base = { initialMode: "payment" as const, defaultAccountId: "card" }
    expect([
      prefilledAccount("payment", base),
      prefilledAccount("advance", base),
      prefilledAccount("advance", {
        ...base,
        initialValues: DUPLICATE,
        initialMode: "advance"
      }),
      prefilledAccount("payment", {
        ...base,
        initialValues: DUPLICATE,
        initialMode: "advance"
      }),
      prefilledAccount("payment", {
        ...base,
        initialValues: { ...DUPLICATE, mode: "payment", account_id: null }
      })
    ]).toEqual(["card", "", "bank", "card", ""])
  })

  it("un texto se reemplaza solo si está vacío o sin tocar", () => {
    expect(keepsPrefill("", "Pago Visa")).toBe(true)
    expect(keepsPrefill("Pago Visa", "Pago Visa")).toBe(true)
    expect(keepsPrefill("Otra cosa", "Pago Visa")).toBe(false)
  })
})

describe("cuenta y textos", () => {
  it("la cuenta aparece en pagos con tarjeta o movimiento y en avances", () => {
    expect(MODES.map((mode) => usesPaymentAccount(mode, false, true))).toEqual([
      true,
      true,
      false,
      true,
      false,
      false
    ])
    expect(usesPaymentAccount("payment", false, false)).toBe(false)
    expect(usesPaymentAccount("extra", true, false)).toBe(true)
  })

  it("efecto en la tarjeta según tipo y cuenta", () => {
    expect([
      ...MODES.map((mode) => cardEffect(mode, "Banco")),
      cardEffect("payment", null),
      cardEffect("extra", null),
      cardEffect("advance", null)
    ]).toMatchInlineSnapshot(`
      [
        "Mueve dinero de Banco a la tarjeta. No cuenta como salida.",
        "Mueve dinero de Banco a la tarjeta. No cuenta como salida. No cubre el pago del mes: el próximo pago sigue pendiente.",
        "Es una compra: no toca tus cuentas, solo sube el saldo de la tarjeta. Si es a cuotas, cada cuota suma al pago del mes.",
        "Es un avance: entra dinero a Banco como entrada (Avance de tarjeta) y sube la deuda de la tarjeta.",
        "Sube el saldo de la tarjeta. No toca tus cuentas.",
        "Corrige el saldo de la tarjeta. No toca tus cuentas ni crea movimiento.",
        "Este pago no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son salidas.",
        "Este abono no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son salidas. No cubre el pago del mes: el próximo pago sigue pendiente.",
        "Elige la cuenta a la que entró el avance.",
      ]
    `)
  })

  it("placeholder de la nota", () => {
    expect([
      ...MODES.map((mode) => notePlaceholder(mode, false)),
      notePlaceholder("payment", true)
    ]).toMatchInlineSnapshot(`
      [
        "Cuota de noviembre",
        "Abono a capital",
        "Compra en el supermercado",
        "Avance en cajero",
        "Cuota de manejo de noviembre",
        "Intereses del extracto",
        "Primer abono",
      ]
    `)
  })
})
