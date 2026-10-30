export const DEBTS_TABS = ["debts", "receivables"] as const

export type DebtsTab = (typeof DEBTS_TABS)[number]

/** `?tab` de /dashboard/personal/debts; un valor inválido cae a debts */
export function parseDebtsTab(value: string | string[] | undefined) {
  return DEBTS_TABS.find((tab) => tab === value) ?? "debts"
}
