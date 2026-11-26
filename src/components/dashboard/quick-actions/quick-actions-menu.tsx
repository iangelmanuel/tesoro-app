"use client"

import { ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { ExportButton } from "@/features/exports/components/export-button"
import { preloadQuickAction, useQuickActions } from "./quick-actions-context"

// Accesos rápidos del header. "Registrar movimiento" es el primario del
// espacio; "Más" despliega el resto de acciones de la misma lista que la
// hoja móvil y la paleta. En /dashboard/personal/* registra en Personal y en
// /dashboard/business/[id]/* en esa empresa; en otras rutas (cuenta, estado
// vacío de Empresa) no hay accesos
export function QuickActionsMenu() {
  const { workspace, actions, run } = useQuickActions()

  if (!workspace) {
    return null
  }

  const label = "Registrar movimiento"
  const more = actions.filter((action) => action.key !== "movement")
  const register = more.filter((action) => action.group === "register")
  const tools = more.filter((action) => action.group === "tool")

  return (
    <>
      {/* Solo en Reportes (SPEC 32) */}
      <ExportButton
        key={`export-${workspace.id}`}
        workspaceId={workspace.id}
        historyStart={workspace.historyStart}
      />
      <Button
        data-tour="header-quick-add"
        onClick={() => run("movement")}
        onPointerEnter={() => preloadQuickAction("movement")}
        onFocus={() => preloadQuickAction("movement")}
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              aria-label="Más acciones"
              className="max-sm:px-3"
              data-tour="header-more"
            />
          }
        >
          <span className="hidden sm:inline">Más</span>
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-60"
        >
          <DropdownMenuGroup>
            {register.map(({ key, label: itemLabel, icon: Icon }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => run(key)}
                onPointerEnter={() => preloadQuickAction(key)}
                onFocus={() => preloadQuickAction(key)}
              >
                <Icon />
                {itemLabel}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {tools.map(({ key, label: itemLabel, icon: Icon }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => run(key)}
                onPointerEnter={() => preloadQuickAction(key)}
                onFocus={() => preloadQuickAction(key)}
              >
                <Icon />
                {itemLabel}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
