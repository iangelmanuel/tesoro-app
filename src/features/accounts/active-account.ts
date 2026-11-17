import type { AccountOption } from "./components/account-select"

/**
 * Cuenta habitual de un origen (gasto fijo, deuda) para prellenar un pago
 * (SPEC 41): su id si sigue activa en el espacio; si está archivada, borrada
 * o no hay, null y la elige el usuario
 */
export function activeAccountId(
  accounts: Pick<AccountOption, "id" | "archived_at">[],
  accountId: string | null | undefined
) {
  if (!accountId) return null
  return accounts.some(
    (account) => account.id === accountId && !account.archived_at
  )
    ? accountId
    : null
}
