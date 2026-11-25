import { z } from "zod"
import { RECEIVABLE_NOT_FOUND } from "@/features/debts/errors"
import { NEEDS_INPUT_HINT, defineTool, workspaceIdSchema } from "../shared"
import { updateDebtEntity } from "./debt-entity"
import { accountFields, receivableFields, valuesOf } from "./debt-fields"
import { personalWorkspace } from "./entities"

// update_receivable (SPEC 44): Me deben

const updateReceivableInput = z.object({
  workspace_id: workspaceIdSchema,
  receivable_id: z
    .uuid({ error: RECEIVABLE_NOT_FOUND })
    .optional()
    .describe("Id de la cuenta por cobrar (de list_receivables)."),
  receivable: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Nombre de la cuenta por cobrar, si no tienes el id."),
  ...z.object(receivableFields).partial().shape,
  ...accountFields
})

/** Edita una cuenta por cobrar de Me deben */
export const updateReceivableTool = defineTool({
  name: "update_receivable",
  group: "manage",
  title: "Editar cuenta por cobrar",
  description: `Cambia los datos de una cuenta por cobrar de Me deben. Solo cambia los campos que envíes. No cambia el tipo de cobro (único o mes a mes): envía solo los campos de su tipo. En una mensual indefinida, un monto nuevo deja los meses ya corridos con el anterior, como la app. Para registrar cobros usa collect_receivable. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: updateReceivableInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return updateDebtEntity(ctx, {
      workspace: resolved.workspace,
      id: args.receivable_id,
      name: args.receivable,
      receivable: true,
      values: valuesOf(args, receivableFields),
      account: args,
      tool: "update_receivable"
    })
  }
})
