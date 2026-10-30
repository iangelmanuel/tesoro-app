import { cn } from "cn"
import { ChartNoAxesColumn } from "lucide-react"

interface NoPeriodDataProps {
  message: string
  className?: string
}

// Reemplaza una gráfica o tabla cuando el periodo no tiene datos que dibujar
export function NoPeriodData({ message, className }: NoPeriodDataProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center",
        className
      )}
    >
      <ChartNoAxesColumn className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
