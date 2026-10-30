import { cn } from "cn"
import { Tag } from "lucide-react"
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS
} from "@/features/categories/constants"

interface GoalIconProps {
  icon: string
  color: string
  className?: string
}

// Icono de la meta en un círculo con su color. Como en CategoryBadge, una
// clave desconocida cae en un icono y color neutros.
export function GoalIcon({ icon, color, className }: GoalIconProps) {
  const Icon = CATEGORY_ICONS[icon as keyof typeof CATEGORY_ICONS] ?? Tag
  const colorClass =
    CATEGORY_COLORS[color as keyof typeof CATEGORY_COLORS] ??
    CATEGORY_COLORS.slate

  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        colorClass,
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}
