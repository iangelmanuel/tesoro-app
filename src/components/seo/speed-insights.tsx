"use client"

import { SpeedInsights as VercelSpeedInsights } from "@vercel/speed-insights/next"
import { normalizeVitalsUrl } from "@/libs/vitals-url"

// Web Vitals de usuarios reales con Vercel Speed Insights (SPEC 56c). Va en
// un componente cliente porque `beforeSend` es una función y no cruza del
// layout de servidor. Sin cookies; la URL sale sin query string ni ids
export function SpeedInsights() {
  return (
    <VercelSpeedInsights
      beforeSend={(event) => ({ ...event, url: normalizeVitalsUrl(event.url) })}
    />
  )
}
