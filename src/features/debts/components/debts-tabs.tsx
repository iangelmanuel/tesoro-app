"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DEBTS_PATH } from "../calculations"
import type { DebtsTab } from "../tabs"

interface DebtsTabsProps {
  tab: DebtsTab
  /** Contenido de la tab activa, renderizado en el servidor */
  children: React.ReactNode
}

// Escribe `?tab` en la URL. Debo es la tab por defecto y va sin parámetro.
export function DebtsTabs({ tab, children }: DebtsTabsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function changeTab(value: string) {
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
      <TabsList>
        <TabsTrigger value="debts">Debo</TabsTrigger>
        <TabsTrigger value="receivables">Me deben</TabsTrigger>
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
