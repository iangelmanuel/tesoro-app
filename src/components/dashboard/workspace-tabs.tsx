"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs } from "@heroui/react"
import { SITE } from "@/config/site"

const WORKSPACE_TABS = [
  { id: "personal", label: "Personal", href: SITE.routes.dashboardPersonal },
  { id: "business", label: "Empresa", href: SITE.routes.dashboardBusiness }
] as const

// Selector Personal / Empresa. Son enlaces (Next Link vía `render`); la
// pestaña activa sale de la ruta. Variante por defecto de HeroUI: pill con
// el indicador sobre --segment
export function WorkspaceTabs() {
  const pathname = usePathname()
  const active = pathname.startsWith(SITE.routes.dashboardBusiness)
    ? "business"
    : "personal"

  return (
    <Tabs
      selectedKey={active}
      className="w-full"
    >
      <Tabs.ListContainer>
        <Tabs.List
          aria-label="Espacio"
          className="w-full"
        >
          {WORKSPACE_TABS.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              id={tab.id}
              href={tab.href}
              render={(domProps) => (
                <Link
                  {...(domProps as React.ComponentProps<"a">)}
                  href={tab.href}
                />
              )}
              className="flex-1"
            >
              {tab.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
