import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarStations
} from "@/components/dashboard/sidebar/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"

// Mismo contenedor y mismas filas que AppSidebar: logo, selector de espacio,
// cada grupo de Personal con su línea de estaciones y el menú de cuenta.
// Anchos fijos: Math.random() no se permite al prerenderizar
export function AppSidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex h-11 items-center px-2">
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-11 w-full rounded-4xl" />
      </SidebarHeader>
      <SidebarContent>
        <div className="flex flex-col gap-4">
          {SITE.navigation.personal.map((group) => (
            <div key={group.label}>
              <div className="flex h-8 items-center px-3">
                <Skeleton className="h-3 w-20" />
              </div>
              <SidebarStations aria-hidden="true">
                {group.items.map((item) => (
                  <li
                    key={item.href}
                    className="flex h-11 items-center gap-3 px-2"
                  >
                    <span className="relative z-10 size-7 shrink-0 rounded-full bg-sidebar ring-[3px] ring-highlight ring-inset" />
                    <Skeleton className="h-4 flex-1" />
                  </li>
                ))}
              </SidebarStations>
            </div>
          ))}
        </div>
      </SidebarContent>
      {/* Solo el menú de cuenta (Ayuda y tema viven dentro, SPEC 40) */}
      <SidebarFooter>
        <Skeleton className="h-14 w-full rounded-2xl" />
      </SidebarFooter>
    </Sidebar>
  )
}
