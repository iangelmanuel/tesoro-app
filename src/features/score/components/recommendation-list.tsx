import { CircleCheck } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import type { Recommendation } from "../types"
import { RecommendationItem } from "./recommendation-item"

interface RecommendationListProps {
  /** Ya ordenadas por severidad y monto */
  recommendations: Recommendation[]
  compact?: boolean
}

export function RecommendationList({
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
          recommendation={item}
          compact={compact}
        />
      ))}
    </ul>
  )
}
