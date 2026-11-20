"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Building2, ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
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

  function selectBusiness(id: unknown) {
    if (typeof id !== "string" || id === activeId) return
    router.push(workspaceBasePath({ id, type: "business" }) as Route)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Empresa: ${active.name}. Cambiar de empresa`}
        className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-2xl bg-subtle px-3 text-left text-sm transition-colors duration-150 outline-none hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-sidebar-accent"
      >
        <Building2
          aria-hidden
          className="size-4 shrink-0"
        />
        <span className="truncate font-medium">{active.name}</span>
        <ChevronsUpDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--anchor-width) min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Empresas</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeId}
            onValueChange={selectBusiness}
          >
            {businesses.map((business) => (
              <DropdownMenuRadioItem
                key={business.id}
                value={business.id}
                closeOnClick
              >
                <span className="truncate">{business.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
