import { CircleCheck } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import type { Recommendation } from "../types"
import { RecommendationItem } from "./recommendation-item"

interface RecommendationListProps {
  workspaceId: string
  /** Ya ordenadas por severidad y monto */
  recommendations: Recommendation<string>[]
  compact?: boolean
}

export function RecommendationList({
  workspaceId,
  recommendations,
  compact
}: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <CardEmpty
        icon={CircleCheck}
        message="Todo en orden por ahora"
      />
    )
  }

  return (
    <ul className={CARD_LIST}>
      {recommendations.map((item) => (
        <RecommendationItem
          key={`${item.rule}:${item.entityKey}`}
          workspaceId={workspaceId}
          recommendation={item}
          compact={compact}
        />
      ))}
    </ul>
  )
}

/** Hueco de la lista: severidad y título, dato y acciones */
export function RecommendationListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul
      aria-hidden="true"
      className={CARD_LIST}
    >
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className={cn("flex flex-col gap-2", CARD_ROW)}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-4xl" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-4xl" />
            <Skeleton className="h-9 w-36 rounded-4xl" />
          </div>
        </li>
      ))}
    </ul>
  )
}
