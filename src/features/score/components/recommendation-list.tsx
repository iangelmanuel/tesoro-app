import { CircleCheck } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
    <ul className="flex flex-col divide-y">
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
