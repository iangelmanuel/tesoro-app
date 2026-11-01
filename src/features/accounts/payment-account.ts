// Cálculos de la sección de cuenta de los pagos (SPEC 16). Puros: los usa
// PaymentAccountSection y se pueden probar sin React.

interface BalanceAccount {
  id: string
  balance: number
  archived_at: string | null
}

/** Lo que falta para cubrir `amount` con `balance`, o 0 si alcanza */
export function paymentShortfall(balance: number, amount: number | null) {
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return 0
  }
  return Math.max(Math.round((amount - balance) * 100) / 100, 0)
}

/** Cuentas activas distintas a la que paga, de mayor a menor saldo */
export function transferSources<T extends BalanceAccount>(
  accounts: T[],
  payingAccountId: string
) {
  return accounts
    .filter((account) => !account.archived_at && account.id !== payingAccountId)
    .sort((a, b) => b.balance - a.balance)
}

/**
 * Cuenta de origen del traspaso: la elegida por el usuario si sigue siendo
 * válida; si no, la de mayor saldo. "" sin cuentas posibles.
 */
export function resolveTransferSource<T extends BalanceAccount>(
  accounts: T[],
  payingAccountId: string,
  chosenId: string
) {
  const sources = transferSources(accounts, payingAccountId)
  return sources.some((account) => account.id === chosenId)
    ? chosenId
    : (sources[0]?.id ?? "")
}
