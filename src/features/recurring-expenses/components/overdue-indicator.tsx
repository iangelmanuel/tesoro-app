import type { Route } from "next"
import Link from "next/link"
import { cn } from "@heroui/react"
import { CircleAlert } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import type { OverdueSummary } from "../queries"

interface OverdueIndicatorProps {
  summary: OverdueSummary
  currency: string
}

/**
 * "N atrasados · $ Z": ocurrencias impagas de meses anteriores. Lleva al mes
 * del atraso más antiguo. Sin atrasos no se muestra.
 */
export function OverdueIndicator({ summary, currency }: OverdueIndicatorProps) {
  if (summary.count === 0 || summary.oldestMonth === null) {
    return null
  }

  return (
    <Link
      href={`${RECURRING_PATH}?month=${summary.oldestMonth}` as Route}
      scroll={false}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-opacity outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none max-md:min-h-11",
        TONE_BADGE_CLASSES.danger
      )}
    >
      <CircleAlert
        aria-hidden="true"
        className="size-4 shrink-0"
      />
      <span>
        {summary.count} {summary.count === 1 ? "atrasado" : "atrasados"} ·{" "}
        <Amount
          value={summary.amount}
          currency={currency}
        />
      </span>
      <span className="sr-only">: ver el mes del atraso más antiguo</span>
    </Link>
  )
}
