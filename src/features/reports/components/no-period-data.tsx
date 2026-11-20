import { ChartNoAxesColumn } from "lucide-react"
import { cn } from "@/libs/cn"

interface NoPeriodDataProps {
  message: string
  className?: string
}

// Reemplaza una gráfica o tabla cuando el periodo no tiene datos que dibujar
export function NoPeriodData({ message, className }: NoPeriodDataProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl bg-subtle p-8 text-center",
        className
      )}
    >
      <ChartNoAxesColumn
        aria-hidden
        className="size-6 text-muted-foreground"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
