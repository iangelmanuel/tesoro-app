import { cn } from "cn"
import { Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../constants"

interface CategoryBadgeProps {
  name: string
  icon: string
  color: string
  className?: string
}

// Las claves vienen de la BD como texto: si alguna no existe se usa un
// icono y color neutros en vez de romper la UI
export function CategoryBadge({
  name,
  icon,
  color,
  className
}: CategoryBadgeProps) {
  const Icon = CATEGORY_ICONS[icon as keyof typeof CATEGORY_ICONS] ?? Tag
  const colorClass =
    CATEGORY_COLORS[color as keyof typeof CATEGORY_COLORS] ??
    CATEGORY_COLORS.slate

  return (
    <Badge className={cn(colorClass, className)}>
      <Icon data-icon="inline-start" />
      {name}
    </Badge>
  )
}
