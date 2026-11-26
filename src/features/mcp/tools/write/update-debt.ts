import { z } from "zod"
import { DEBT_NOT_FOUND } from "@/features/debts/errors"
import { NEEDS_INPUT_HINT, defineTool, workspaceIdSchema } from "../shared"
import { updateDebtEntity } from "./debt-entity"
import { accountFields, debtFields, valuesOf } from "./debt-fields"
import { personalWorkspace } from "./entities"

// update_debt (SPEC 44): tarjetas y préstamos

const updateDebtInput = z.object({
  workspace_id: workspaceIdSchema,
  debt_id: z
    .uuid({ error: DEBT_NOT_FOUND })
    .optional()
    .describe("Id de la deuda (de list_debts)."),
  debt: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre de la deuda, si no tienes el id."),
  ...z.object(debtFields).partial().shape,
  ...accountFields
})

/** Edita una tarjeta o un préstamo */
export const updateDebtTool = defineTool({
  name: "update_debt",
  group: "manage",
  title: "Editar deuda",
  description: `Cambia los datos de una tarjeta o un préstamo: nombre, cupo, corte, pago, tasa, cuota, plazo, cuota de manejo o cuenta por defecto. Solo cambia los campos que envíes; el tipo no cambia. Para registrar pagos usa record_debt_payment. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateDebtInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return updateDebtEntity(ctx, {
      workspace: resolved.workspace,
      id: args.debt_id,
      name: args.debt,
      receivable: false,
      values: valuesOf(args, debtFields),
      account: args,
      tool: "update_debt"
    })
  }
})
