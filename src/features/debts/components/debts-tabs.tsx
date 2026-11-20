"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/libs/cn"
import { DEBTS_PATH } from "../calculations"
import type { DebtsTab } from "../tabs"

interface DebtsTabsProps {
  tab: DebtsTab
  /** Contenido de la tab activa, renderizado en el servidor */
  children: React.ReactNode
}

const TABS: { value: DebtsTab; label: string }[] = [
  { value: "debts", label: "Debo" },
  { value: "receivables", label: "Me deben" }
]

// Escribe `?tab` en la URL. Debo es la tab por defecto y va sin parámetro.
export function DebtsTabs({ tab, children }: DebtsTabsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function changeTab(value: unknown) {
    if (value === tab) return

    startTransition(() => {
      router.replace(
        (value === "receivables"
          ? `${DEBTS_PATH}?tab=receivables`
          : DEBTS_PATH) as Route,
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
      <TabsList
        aria-label="Deudas y cuentas por cobrar"
        data-tour="debts-tabs"
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
      {/* Solo se pinta la tab activa: su contenido llega del servidor */}
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

/** Las tabs mientras carga: misma pill de 44 px */
export function DebtsTabsSkeleton() {
  return <Skeleton className="h-11 w-48 rounded-4xl" />
}
