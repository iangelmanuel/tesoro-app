"use client"

import { useTransition } from "react"
import Link from "next/link"
import { CARD_ROW } from "@/components/dashboard/data/surface"
import type { Tone } from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/libs/cn"
import { dismissRecommendation } from "../actions"
import { SEVERITY_LABELS } from "../constants"
import type { Recommendation, Severity } from "../types"

const SEVERITY_TONES: Record<Severity, Tone> = {
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
        toast.success("Oculta hasta el próximo mes")
      }
    })
  }

  return (
    <li className={cn("flex flex-col gap-2", CARD_ROW)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={recommendation.severity} />
        <p className="font-medium">{recommendation.title}</p>
      </div>
      <p className="text-sm text-muted-foreground">{recommendation.evidence}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={recommendation.href}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-tour="recommendations-go"
        >
          {recommendation.linkLabel}
        </Link>
        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            data-tour="recommendations-dismiss"
            onClick={dismiss}
          >
            Ocultar este mes
          </Button>
        )}
      </div>
    </li>
  )
}
