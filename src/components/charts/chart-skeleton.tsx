import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"

/**
 * Hueco del área de una gráfica: la proporción de ChartContainer (16:9) o
 * las clases y el estilo de tamaño que le pase la gráfica real. Lo usan
 * ChartCardSkeleton y los `…-lazy.tsx` mientras llega el chunk de Recharts
 */
export function ChartSkeleton({
  className,
  style
}: {
  /** Las mismas clases de tamaño que el ChartContainer real */
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <Skeleton
      aria-hidden="true"
      className={cn("aspect-video w-full rounded-2xl", className)}
      style={style}
    />
  )
}
