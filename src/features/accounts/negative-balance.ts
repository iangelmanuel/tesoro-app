import type { AccountWithBalance } from "./types"

/**
 * Regla `negative_account` (SPEC 21): una billetera o un banco activo con
 * saldo a hoy < 0. Efectivo y "otra" quedan fuera. La comparten el aviso de la
 * tarjeta de la cuenta y las recomendaciones de Personal y Empresa.
 */
export function isNegativeAccount(
  account: Pick<AccountWithBalance, "kind" | "balance" | "archived_at">
) {
  return (
    account.archived_at === null &&
    (account.kind === "wallet" || account.kind === "bank") &&
    account.balance < 0
  )
}
