import { z } from "zod"
import { amountSchema } from "@/features/transactions/schemas"

export const budgetSchema = z.object({
  category_id: z.uuid({ error: "Elige una categoría" }),
  // Primer día del mes (YYYY-MM-01), como lo guarda la tabla
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, { error: "Elige un mes válido" }),
  amount: amountSchema
})

export type BudgetInput = z.infer<typeof budgetSchema>
