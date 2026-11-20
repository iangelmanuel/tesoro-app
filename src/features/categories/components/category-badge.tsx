import { Tag } from "lucide-react"
import { cn } from "@/libs/cn"
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
    <span
      data-slot="category-badge"
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-4xl px-2.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      <Icon
        aria-hidden
        className="size-3 shrink-0"
      />
      <span className="truncate">{name}</span>
    </span>
  )
}
