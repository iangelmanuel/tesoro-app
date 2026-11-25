import { z } from "zod"
import { NEEDS_INPUT_HINT, defineTool, workspaceIdSchema } from "../shared"
import { createDebtEntity } from "./debt-entity"
import { accountFields, receivableFields, valuesOf } from "./debt-fields"
import { confirmDuplicateSchema, personalWorkspace } from "./entities"

// create_receivable (SPEC 44): Me deben, de cobro único o mes a mes (SPEC 28)

const createReceivableInput = z.object({
  workspace_id: workspaceIdSchema,
  schedule: z
    .enum(["once", "monthly"])
    .optional()
    .describe(
      "once: te pagan una vez (o por abonos). monthly: te pagan una cuota cada mes. Por defecto once."
    ),
  ...z.object(receivableFields).partial().shape,
  ...accountFields,
  confirm_duplicate: confirmDuplicateSchema
})

/** Crea una cuenta por cobrar en Me deben */
export const createReceivableTool = defineTool({
  name: "create_receivable",
  group: "manage",
  title: "Crear cuenta por cobrar",
  description: `Crea una cuenta por cobrar en Me deben: dinero que le deben al usuario. Cobro único (schedule once): nombre y monto, fecha esperada opcional. Mes a mes (monthly): nombre, monto mensual, día de pago y fecha de inicio; número de cuotas opcional (sin él es indefinida). El tipo de cobro no se puede cambiar después. Solo Personal. ${NEEDS_INPUT_HINT}`,
  input: createReceivableInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const resolved = await personalWorkspace(ctx, args.workspace_id)
    if ("error" in resolved) {
      return resolved.error
    }

    return createDebtEntity(ctx, {
      workspace: resolved.workspace,
      kind: "receivable",
      schedule: args.schedule ?? "once",
      values: valuesOf(args, receivableFields),
      account: args,
      tool: "create_receivable",
      confirmDuplicate: args.confirm_duplicate
    })
  }
})
