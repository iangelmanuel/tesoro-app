"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, cn } from "@heroui/react"
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

  function changeTab(value: React.Key) {
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
      selectedKey={tab}
      onSelectionChange={changeTab}
      className="gap-6"
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Presupuestos y gastos fijos">
          <Tabs.Tab id="budgets">
            Presupuestos
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="recurring">
            Gastos fijos
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      {/* Solo se pinta la tab activa: su contenido llega del servidor */}
      <Tabs.Panel
        id={tab}
        className={cn(
          "flex flex-col gap-6 transition-opacity",
          pending && "opacity-60"
        )}
      >
        {children}
      </Tabs.Panel>
    </Tabs>
  )
}
