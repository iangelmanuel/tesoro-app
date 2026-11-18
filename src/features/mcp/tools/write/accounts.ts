import { z } from "zod"
import { ACCOUNT_KINDS, ACCOUNT_KIND_META } from "@/features/accounts/constants"
import { accountSchema } from "@/features/accounts/schemas"
import {
  ACCOUNT_NOT_FOUND,
  createAccountRecord,
  loadAccount,
  updateAccountRecord
} from "@/features/accounts/service"
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICON_KEYS
} from "@/features/categories/constants"
import { toolError } from "../result"
import {
  type MissingField,
  NEEDS_INPUT_HINT,
  dateSchema,
  defineTool,
  needsInput,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"
import {
  NO_CHANGES,
  commitEntity,
  confirmDuplicateSchema,
  definedKeys,
  duplicateName,
  enumOptions,
  missingField,
  parsePatch,
  resolveEntity,
  schemaError,
  serviceError
} from "./entities"
import { accountNameSchema, activeAccounts } from "./references"

// Crear y editar cuentas desde el MCP (SPEC 44), con el servicio de las
// actions (accounts/service.ts). Existen en Personal y en Empresa. La moneda
// es la del perfil: las cuentas no tienen moneda propia.

const KIND_LABELS = Object.fromEntries(
  ACCOUNT_KINDS.map((kind) => [kind, ACCOUNT_KIND_META[kind].label])
)

const fields = {
  name: z.string().describe("Nombre de la cuenta (1–40 caracteres)."),
  kind: z
    .enum(ACCOUNT_KINDS)
    .describe("cash (efectivo), bank (banco), wallet (billetera) u other."),
  opening_balance: z
    .number()
    .describe(
      "Saldo inicial. Puede ser negativo si la cuenta está sobregirada."
    ),
  opening_balance_on: dateSchema
    .nullable()
    .describe(
      "Fecha YYYY-MM-DD, no futura, desde la que cuenta el saldo inicial. null = antes de cualquier movimiento."
    ),
  icon: z.enum(CATEGORY_ICON_KEYS).describe("Icono del set de Tesoro."),
  color: z.enum(CATEGORY_COLOR_KEYS).describe("Color de la paleta de Tesoro.")
}

const createInput = z.object({
  workspace_id: workspaceIdSchema,
  name: fields.name.optional(),
  kind: fields.kind.optional(),
  opening_balance: fields.opening_balance
    .optional()
    .describe("Saldo inicial; por defecto 0. Puede ser negativo."),
  opening_balance_on: fields.opening_balance_on.optional(),
  icon: fields.icon.optional().describe("Opcional; por defecto el del tipo."),
  color: fields.color.optional().describe("Opcional; por defecto el del tipo."),
  confirm_duplicate: confirmDuplicateSchema
})

export const createAccountTool = defineTool({
  name: "create_account",
  group: "write",
  title: "Crear cuenta",
  description: `Crea una cuenta (efectivo, banco, billetera u otra) con su saldo inicial y la fecha desde la que cuenta. Úsala cuando el usuario mencione una cuenta que no está en list_accounts; el nombre no puede repetirse. Personal y Empresa. Devuelve el id y un operation_id para revertir. ${NEEDS_INPUT_HINT}`,
  input: createInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const missing: MissingField[] = []
    if (!args.name?.trim()) {
      missing.push(missingField("name", "¿Cómo se llama la cuenta?"))
    }
    if (!args.kind) {
      missing.push(
        missingField(
          "kind",
          "¿Qué tipo de cuenta es?",
          enumOptions(KIND_LABELS)
        )
      )
    }
    // Dos cuentas no pueden llamarse igual (sin mayúsculas): esa regla de
    // la tabla no se salta con confirm_duplicate
    const duplicate = duplicateName(
      await activeAccounts(ctx, workspace.id),
      args.name,
      { label: "una cuenta activa", confirmed: args.confirm_duplicate }
    )
    if (duplicate) {
      missing.push(duplicate)
    }
    if (missing.length > 0 || !args.kind) {
      return needsInput(missing)
    }

    const parsed = accountSchema.safeParse({
      name: args.name,
      kind: args.kind,
      icon: args.icon ?? ACCOUNT_KIND_META[args.kind].icon,
      color: args.color ?? ACCOUNT_KIND_META[args.kind].color,
      opening_balance: args.opening_balance ?? 0,
      opening_balance_on: args.opening_balance_on ?? null
    })
    if (!parsed.success) {
      return schemaError(parsed.error)
    }

    const result = await createAccountRecord(
      ctx.supabase,
      workspace,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "create_account",
      table: "accounts",
      summary: `Cuenta "${result.after.name}" creada en ${workspace.name}`,
      before: null,
      after: result.after
    })
  }
})

const updateInput = z.object({
  workspace_id: workspaceIdSchema,
  account_id: z
    .uuid({ error: ACCOUNT_NOT_FOUND })
    .optional()
    .describe("Id de la cuenta (de list_accounts)."),
  account: accountNameSchema.optional(),
  name: fields.name.optional(),
  kind: fields.kind.optional(),
  opening_balance: fields.opening_balance.optional(),
  opening_balance_on: fields.opening_balance_on.optional(),
  icon: fields.icon.optional(),
  color: fields.color.optional()
})

export const updateAccountTool = defineTool({
  name: "update_account",
  group: "write",
  title: "Editar cuenta",
  description: `Cambia nombre, tipo, saldo inicial, su fecha, icono o color de una cuenta. Solo cambia los campos que envíes; los demás quedan igual. Para el saldo real de hoy usa los movimientos, no el saldo inicial. Devuelve un operation_id para revertir. ${NEEDS_INPUT_HINT}`,
  input: updateInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id, {
      writable: true
    })
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const patch = {
      name: args.name,
      kind: args.kind,
      opening_balance: args.opening_balance,
      opening_balance_on: args.opening_balance_on,
      icon: args.icon,
      color: args.color
    }
    if (definedKeys(patch).length === 0) {
      return toolError(NO_CHANGES)
    }

    let id = args.account_id
    if (!id) {
      const { data } = await ctx.supabase
        .from("accounts")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
      const resolved = resolveEntity(data ?? [], {
        id: undefined,
        name: args.account,
        field: "account_id",
        label: "la cuenta"
      })
      if ("missing" in resolved) {
        return needsInput([resolved.missing])
      }
      id = resolved.value
    }

    const current = await loadAccount(ctx.supabase, workspace.id, id)
    if (!current) {
      return toolError(ACCOUNT_NOT_FOUND)
    }

    const parsed = parsePatch(accountSchema, current, patch)
    if (!parsed.ok) {
      return schemaError(parsed.error)
    }

    const result = await updateAccountRecord(
      ctx.supabase,
      workspace,
      id,
      parsed.data
    )
    if (!result.ok) {
      return serviceError(result)
    }

    return commitEntity(ctx, {
      workspace,
      tool: "update_account",
      table: "accounts",
      summary: `Cuenta "${result.after.name}" editada en ${workspace.name}`,
      before: result.before,
      after: result.after
    })
  }
})
