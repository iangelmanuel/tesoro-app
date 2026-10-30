"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BUDGETS_PATH, type BudgetsTab } from "../tabs"

interface BudgetsTabsProps {
  tab: BudgetsTab
  /** Contenido de la tab activa, renderizado en el servidor */
  children: React.ReactNode
}

// Escribe `?tab` en la URL. `month` solo aplica a Presupuestos: se conserva
// al volver a esa tab y se quita en Gastos fijos.
export function BudgetsTabs({ tab, children }: BudgetsTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function changeTab(value: string) {
    if (value === tab) return

    const query = new URLSearchParams()
    if (value === "recurring") {
      query.set("tab", "recurring")
    } else {
      const month = searchParams.get("month")
      if (month) query.set("month", month)
    }
    const search = query.toString()

    startTransition(() => {
      router.replace(
        (search ? `${BUDGETS_PATH}?${search}` : BUDGETS_PATH) as Route,
        { scroll: false }
      )
    })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={changeTab}
      className="gap-6"
    >
      <TabsList>
        <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
        <TabsTrigger value="recurring">Gastos fijos</TabsTrigger>
      </TabsList>
      <TabsContent
        value={tab}
        className={cn(
          "flex flex-col gap-6 transition-opacity",
          pending && "opacity-60"
        )}
      >
        {children}
      </TabsContent>
    </Tabs>
  )
}
