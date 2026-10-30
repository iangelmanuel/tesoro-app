"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BudgetMonth } from "../month"
import { BUDGETS_PATH } from "../tabs"

interface BudgetMonthNavProps {
  month: BudgetMonth
}

// Escribe `?month`. La tab Presupuestos es la de por defecto: no hace falta
// `?tab`.
export function BudgetMonthNav({ month }: BudgetMonthNavProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function goTo(value: string) {
    startTransition(() => {
      router.replace(`${BUDGETS_PATH}?month=${value}` as Route, {
        scroll: false
      })
    })
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 transition-opacity",
        pending && "opacity-60"
      )}
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Mes anterior"
        onClick={() => goTo(month.prev)}
      >
        <ChevronLeft />
      </Button>
      <p
        className="min-w-36 text-center font-medium capitalize"
        aria-live="polite"
      >
        {month.label}
      </p>
      <Button
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        onClick={() => goTo(month.next)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
