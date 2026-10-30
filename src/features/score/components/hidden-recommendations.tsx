"use client"

import { useTransition } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { restoreRecommendation } from "../actions"
import type { Recommendation } from "../types"
import { SeverityBadge } from "./recommendation-item"

/** Sección plegable "Ocultas este mes", cerrada por defecto */
export function HiddenRecommendations({
  recommendations
}: {
  recommendations: Recommendation[]
}) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-fit"
        >
          <ChevronDown
            data-icon="inline-start"
            className="transition-transform group-data-[state=closed]:-rotate-90"
          />
          Ocultas este mes ({recommendations.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-xl border">
          {recommendations.map((item) => (
            <HiddenRecommendationRow
              key={`${item.rule}:${item.entityKey}`}
              recommendation={item}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function HiddenRecommendationRow({
  recommendation
}: {
  recommendation: Recommendation
}) {
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const result = await restoreRecommendation(
        recommendation.rule,
        recommendation.entityKey
      )
      if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={recommendation.severity} />
          <p className="font-medium">{recommendation.title}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {recommendation.evidence}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={restore}
      >
        Mostrar de nuevo
      </Button>
    </li>
  )
}
