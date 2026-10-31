"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Tabs, cn } from "@heroui/react"
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

  function changeTab(value: React.Key) {
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
      selectedKey={tab}
      onSelectionChange={changeTab}
      className="gap-6"
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Deudas y cuentas por cobrar">
          <Tabs.Tab id="debts">
            Debo
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="receivables">
            Me deben
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
