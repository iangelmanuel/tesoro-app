"use client"

import { useTransition } from "react"
import { Button, Disclosure, toast } from "@heroui/react"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
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
    <Disclosure className="flex flex-col gap-3">
      <Disclosure.Heading>
        <Disclosure.Trigger
          className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default"
          data-tour="recommendations-hidden"
        >
          <Disclosure.Indicator />
          Ocultas este mes ({recommendations.length})
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <ul className={SURFACE_LIST}>
          {recommendations.map((item) => (
            <HiddenRecommendationRow
              key={`${item.rule}:${item.entityKey}`}
              workspaceId={workspaceId}
              recommendation={item}
            />
          ))}
        </ul>
      </Disclosure.Content>
    </Disclosure>
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
        toast.danger(result.error)
      }
    })
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 ${SURFACE_ROW}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={recommendation.severity} />
          <p className="font-medium">{recommendation.title}</p>
        </div>
        <p className="text-sm text-muted">{recommendation.evidence}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        isDisabled={pending}
        onPress={restore}
      >
        Mostrar de nuevo
      </Button>
    </li>
  )
}
