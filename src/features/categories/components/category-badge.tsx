import { Chip, cn } from "@heroui/react"
import { Tag } from "lucide-react"
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
    <Chip
      size="sm"
      className={cn("gap-1", colorClass, className)}
    >
      <Icon className="size-3 shrink-0" />
      <Chip.Label>{name}</Chip.Label>
    </Chip>
  )
}
