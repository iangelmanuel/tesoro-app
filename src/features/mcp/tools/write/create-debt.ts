import { z } from "zod"
import {
  NEEDS_INPUT_HINT,
  defineTool,
  needsInput,
  workspaceIdSchema
} from "../shared"
import { createDebtEntity } from "./debt-entity"
import { accountFields, debtFields, valuesOf } from "./debt-fields"
import {
  confirmDuplicateSchema,
  enumOptions,
  missingField,
  personalWorkspace
} from "./entities"

// create_debt (SPEC 44): tarjetas y préstamos

const DEBT_KIND_OPTIONS = enumOptions({
  credit_card: "Tarjeta de crédito",
  loan: "Préstamo"
})

const createDebtInput = z.object({
  workspace_id: workspaceIdSchema,
  kind: z
    .enum(["credit_card", "loan"])
    .optional()
    .describe("credit_card (tarjeta de crédito) o loan (préstamo)."),
  ...z.object(debtFields).partial().shape,
  ...accountFields,
  confirm_duplicate: confirmDuplicateSchema
})

/** Crea una tarjeta de crédito o un préstamo */
export const createDebtTool = defineTool({
  name: "create_debt",
  group: "manage",
  title: "Crear deuda",
  description: `Crea una tarjeta de crédito o un préstamo en Deudas, con los campos del formulario de la app. Tarjeta: nombre, saldo de hoy, cupo, día de corte y día de pago (tasa, pago mínimo y cuota de manejo opcionales). Préstamo: nombre, saldo, cuota, tasa (0 si no tiene) y día de pago (monto original y plazo opcionales). Para lo que le deben al usuario usa create_receivable. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createDebtInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }
    if (!args.kind) {
      return needsInput([
        missingField(
          "kind",
          "¿Es una tarjeta de crédito o un préstamo?",
          DEBT_KIND_OPTIONS
        )
      ])
    }

    return createDebtEntity(ctx, {
      workspace: resolved.workspace,
      kind: args.kind,
      schedule: null,
      values: valuesOf(args, debtFields),
      account: args,
      tool: "create_debt",
      confirmDuplicate: args.confirm_duplicate
    })
  }
})
