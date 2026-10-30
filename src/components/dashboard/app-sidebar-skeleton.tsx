import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-3">
        <Skeleton className="mx-2 mt-1 h-7 w-24" />
        <Skeleton className="h-9 w-full" />
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {SITE.navigation.personal.map((item) => (
            // No se usa SidebarMenuSkeleton: su ancho sale de Math.random(),
            // que cacheComponents no permite al prerenderizar
            <SidebarMenuItem
              key={item.href}
              className="flex h-8 items-center gap-2 px-2"
            >
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Skeleton className="h-12 w-full" />
      </SidebarFooter>
    </Sidebar>
  )
}
