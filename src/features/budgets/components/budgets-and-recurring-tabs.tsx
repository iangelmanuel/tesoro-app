"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/libs/cn"
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

const TABS: { value: BudgetsTab; label: string }[] = [
  { value: "recurring", label: "Gastos fijos" },
  { value: "budgets", label: "Presupuestos" }
]

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

  function changeTab(value: unknown) {
    if (value === tab) return

    startTransition(() => {
      router.replace(TAB_PATHS[value as BudgetsTab], { scroll: false })
    })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={changeTab}
      className="gap-6"
    >
      <TabsList
        aria-label="Gastos fijos y presupuestos"
        data-tour="budgets-recurring-tabs"
        className="w-full md:hidden"
      >
        {TABS.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Solo se pinta la pantalla activa: su contenido llega del servidor */}
      <TabsContent
        value={tab}
        className={cn(
          "flex flex-col gap-6 motion-safe:transition-opacity",
          pending && "opacity-60"
        )}
      >
        {children}
      </TabsContent>
    </Tabs>
  )
}

/** El selector del teléfono mientras carga: misma pill de 44 px */
export function BudgetsAndRecurringTabsSkeleton() {
  return <Skeleton className="h-11 w-full rounded-4xl md:hidden" />
}
