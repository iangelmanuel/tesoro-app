"use client"

import { useTransition } from "react"
import { ChevronRight } from "lucide-react"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/data/surface"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/libs/cn"
import { restoreRecommendation } from "../actions"
import type { Recommendation } from "../types"
import { SeverityBadge } from "./recommendation-item"

/** Sección plegable "Ocultas este mes", cerrada por defecto */
export function HiddenRecommendations({
  workspaceId,
  recommendations
}: {
  workspaceId: string
  recommendations: Recommendation<string>[]
}) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <h2>
        <CollapsibleTrigger
          className="group flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-4xl px-3 text-sm font-medium transition-colors duration-150 outline-none hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-tour="recommendations-hidden"
        >
          <ChevronRight
            aria-hidden="true"
            className="size-4 transition-transform duration-150 group-data-panel-open:rotate-90 motion-reduce:transition-none"
          />
          Ocultas este mes ({recommendations.length})
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <ul className={SURFACE_LIST}>
          {recommendations.map((item) => (
            <HiddenRecommendationRow
              key={`${item.rule}:${item.entityKey}`}
              workspaceId={workspaceId}
              recommendation={item}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function HiddenRecommendationRow({
  workspaceId,
  recommendation
}: {
  workspaceId: string
  recommendation: Recommendation<string>
}) {
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const result = await restoreRecommendation(
        workspaceId,
        recommendation.rule,
        recommendation.entityKey
      )
      if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3", SURFACE_ROW)}>
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
