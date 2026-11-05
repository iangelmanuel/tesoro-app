"use client"

import { LazyMotion, MotionConfig } from "motion/react"

// Las funciones de animación llegan en un chunk aparte, después de la carga
// inicial (rendimiento de la landing)
const loadFeatures = () =>
  import("./motion-features").then((module) => module.default)

// Motion de la landing (SPEC 24). LazyMotion carga solo las funciones de
// animación del DOM, y `strict` obliga a usar componentes `m` (no `motion`)
// para no inflar el bundle. `reducedMotion="user"` respeta la preferencia del
// sistema en todo lo que cuelga de aquí.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion
      features={loadFeatures}
      strict
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
