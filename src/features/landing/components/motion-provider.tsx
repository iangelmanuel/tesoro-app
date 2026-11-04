"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"

// Motion de la landing (SPEC 24). LazyMotion + domAnimation carga solo las
// funciones de animación del DOM, y `strict` obliga a usar componentes `m`
// (no `motion`) para no inflar el bundle. `reducedMotion="user"` respeta la
// preferencia del sistema en todo lo que cuelga de aquí.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion
      features={domAnimation}
      strict
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
