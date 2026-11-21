import type { AccountWithBalance } from "./types"

/** Suma de los saldos de las cuentas no archivadas */
export function activeAccountsBalance(
  accounts: Pick<AccountWithBalance, "balance" | "archived_at">[]
) {
  return accounts
    .filter((account) => account.archived_at === null)
    .reduce((sum, account) => sum + account.balance, 0)
}
