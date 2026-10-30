import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton
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
            <SidebarMenuItem key={item.href}>
              <SidebarMenuSkeleton showIcon />
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
