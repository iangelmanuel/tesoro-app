"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Tabs, cn } from "@heroui/react"
import { BUDGETS_PATH, type BudgetsTab, RECURRING_PATH } from "../tabs"

interface BudgetsAndRecurringTabsProps {
  tab: BudgetsTab
  /** Contenido de la pantalla activa, renderizado en el servidor */
  children: React.ReactNode
}

const TAB_PATHS: Record<BudgetsTab, Route> = {
  recurring: RECURRING_PATH as Route,
  budgets: BUDGETS_PATH as Route
}

// Selector Gastos fijos | Presupuestos del teléfono (< 768 px). Cada tab es
// su propia ruta: la barra inferior abre Gastos fijos y desde aquí se llega
// a Presupuestos. Desde 768 px el selector se oculta: el aside ya separa las
// dos pantallas.
export function BudgetsAndRecurringTabs({
  tab,
  children
}: BudgetsAndRecurringTabsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function changeTab(value: React.Key) {
    if (value === tab) return

    startTransition(() => {
      router.replace(TAB_PATHS[value as BudgetsTab], { scroll: false })
    })
  }

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={changeTab}
      className="gap-6"
    >
      <Tabs.ListContainer className="md:hidden">
        <Tabs.List aria-label="Gastos fijos y presupuestos">
          <Tabs.Tab
            id="recurring"
            className="max-md:min-h-11"
          >
            Gastos fijos
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab
            id="budgets"
            className="max-md:min-h-11"
          >
            Presupuestos
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      {/* Solo se pinta la pantalla activa: su contenido llega del servidor */}
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
