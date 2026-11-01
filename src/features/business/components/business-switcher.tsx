"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Dropdown, Label } from "@heroui/react"
import { Building2, ChevronsUpDown } from "lucide-react"
import { workspaceBasePath } from "@/features/workspaces/paths"

export interface BusinessOption {
  id: string
  name: string
}

interface BusinessSwitcherProps {
  businesses: BusinessOption[]
  /** Empresa de la ruta actual */
  activeId: string
}

/** Cambia entre empresas. Solo se pinta si el usuario tiene más de una */
export function BusinessSwitcher({
  businesses,
  activeId
}: BusinessSwitcherProps) {
  const router = useRouter()
  const active = businesses.find((business) => business.id === activeId)

  if (businesses.length < 2 || !active) {
    return null
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`Empresa: ${active.name}. Cambiar de empresa`}
        className="flex h-12 w-full items-center gap-2 rounded-lg border border-border px-2 text-left text-sm transition-colors outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus [&>svg]:size-4 [&>svg]:shrink-0"
      >
        <Building2 />
        <span className="truncate font-medium">{active.name}</span>
        <ChevronsUpDown className="ml-auto text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement="bottom start"
        className="min-w-(--trigger-width)"
      >
        <Dropdown.Menu
          aria-label="Empresas"
          selectionMode="single"
          selectedKeys={[activeId]}
          onAction={(key) =>
            router.push(
              workspaceBasePath({ id: String(key), type: "business" }) as Route
            )
          }
        >
          {businesses.map((business) => (
            <Dropdown.Item
              key={business.id}
              id={business.id}
              textValue={business.name}
            >
              <Label className="truncate">{business.name}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
