import { Skeleton } from "@/components/ui/skeleton"
import { GoalCardSkeleton } from "./goal-card"

/** Metas mientras carga: botones de arriba y la grilla de tarjetas */
export function GoalsScreenSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-36 rounded-4xl" />
        <Skeleton className="h-11 w-32 rounded-4xl" />
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        <GoalCardSkeleton />
        <GoalCardSkeleton />
      </ul>
    </>
  )
}
