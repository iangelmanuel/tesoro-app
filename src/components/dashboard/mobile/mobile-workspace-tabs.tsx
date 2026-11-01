"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs } from "@heroui/react"
import { WORKSPACE_TABS, getActiveWorkspaceTab } from "../workspace-tabs"

// Selector Personal / Empresa del teléfono (< 768 px): fila sticky bajo el
// header, a todo el ancho. Usa el destino y la pestaña activa de
// WorkspaceTabs; /dashboard/business lleva a la primera empresa o al estado
// vacío. El primario cambia solo por la ruta (WorkspaceThemeRoot)
export function MobileWorkspaceTabs() {
  const pathname = usePathname()

  return (
    <div className="sticky top-16 z-10 bg-background px-4 pb-2 md:hidden">
      <Tabs
        selectedKey={getActiveWorkspaceTab(pathname)}
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
                className="min-h-11 flex-1"
              >
                {tab.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </div>
  )
}
