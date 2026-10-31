"use client"

import { useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ToneBadge } from "@/features/debts/components/debt-indicators"
import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import { dismissRecommendation } from "../actions"
import { SEVERITY_LABELS } from "../constants"
import type { Recommendation, Severity } from "../types"

const SEVERITY_TONES: Record<Severity, OccurrenceTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral"
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <ToneBadge tone={SEVERITY_TONES[severity]}>
      {SEVERITY_LABELS[severity]}
    </ToneBadge>
  )
}

interface RecommendationItemProps {
  /** Espacio de la recomendación, para "Ocultar este mes" */
  workspaceId: string
  recommendation: Recommendation<string>
  /** Versión compacta para la tarjeta del Resumen, sin "Ocultar este mes" */
  compact?: boolean
}

/** Badge de severidad, título, dato, "Ir a …" y "Ocultar este mes" */
export function RecommendationItem({
  workspaceId,
  recommendation,
  compact = false
}: RecommendationItemProps) {
  const [pending, startTransition] = useTransition()

  function dismiss() {
    startTransition(async () => {
      const result = await dismissRecommendation(
        workspaceId,
        recommendation.rule,
        recommendation.entityKey
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Recomendación oculta este mes")
      }
    })
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={recommendation.severity} />
        <p className="font-medium">{recommendation.title}</p>
      </div>
      <p className="text-sm text-muted-foreground">{recommendation.evidence}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <Link href={recommendation.href}>{recommendation.linkLabel}</Link>
        </Button>
        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={dismiss}
          >
            Ocultar este mes
          </Button>
        )}
      </div>
    </li>
  )
}
