"use client"

import { useRef } from "react"
import {
  type MotionValue,
  type Variants,
  m,
  useReducedMotion,
  useScroll,
  useTransform
} from "motion/react"

// Única fuente del movimiento de la landing (SPEC 24): nadie duplica estas
// curvas ni duraciones. Con `prefers-reduced-motion` todo aparece ya en su
// estado final: globals.css anula el estado oculto de `[data-reveal]` (el HTML
// del servidor no conoce la preferencia, así que no basta con el cliente).

const EASE_OUT = [0.16, 1, 0.3, 1] as const // expo.out: llega lento, sin rebote

const ITEM: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  // `custom` es el retraso en segundos (Reveal); en listas lo pone el padre
  // (sin `delay` propio en listas, para no pisar el escalonado del padre)
  shown: (delay?: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: delay
      ? { duration: 0.7, ease: EASE_OUT, delay }
      : { duration: 0.7, ease: EASE_OUT }
  })
}

const GROUP: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08 } }
}

// Revela una vez al entrar en pantalla (o al montar, con `immediate`)
const viewport = { once: true, amount: 0.25 } as const

type RevealProps = {
  children: React.ReactNode
  className?: string
  delay?: number
  immediate?: boolean
}

export function Reveal({
  children,
  className,
  delay = 0,
  immediate = false
}: RevealProps) {
  const reduce = useReducedMotion()

  return (
    <m.div
      className={className}
      variants={ITEM}
      data-reveal=""
      initial={reduce ? false : "hidden"}
      {...(immediate
        ? { animate: "shown" }
        : { whileInView: "shown", viewport })}
      custom={delay}
    >
      {children}
    </m.div>
  )
}

type RevealListProps = {
  children: React.ReactNode
  className?: string
  as?: "ul" | "ol"
}

// Lista cuyos `RevealItem` entran escalonados
export function RevealList({
  children,
  className,
  as = "ul"
}: RevealListProps) {
  const reduce = useReducedMotion()
  const Tag = as === "ol" ? m.ol : m.ul

  return (
    <Tag
      className={className}
      variants={GROUP}
      data-reveal=""
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={viewport}
    >
      {children}
    </Tag>
  )
}

export function RevealItem({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <m.li
      className={className}
      variants={ITEM}
      data-reveal=""
    >
      {children}
    </m.li>
  )
}

// Hover y press de los CTA: un leve levante y una presión corta
export function Pressable({ children }: { children: React.ReactNode }) {
  return (
    <m.span
      className="inline-flex"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
    >
      {children}
    </m.span>
  )
}

// Progreso de scroll (0–1) de un elemento: de que asoma por abajo a que llega
// al centro. Con reduced motion queda fijo en 1 (estado final).
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"]
  })
  const progress = useTransform(scrollYProgress, (v) =>
    reduce ? 1 : Math.min(1, Math.max(0, v))
  )
  return { ref, progress }
}

// Barra que se llena con el scroll hasta `fraction` (0–1)
export function ScrollBar({
  progress,
  fraction,
  className
}: {
  progress: MotionValue<number>
  fraction: number
  className?: string
}) {
  const scaleX = useTransform(progress, (v) => v * fraction)

  return (
    <m.div
      className={className}
      style={{ scaleX, transformOrigin: "0% 50%" }}
    />
  )
}

// Barra de factor que se llena con el scroll (mide su propio progreso)
export function ScrollFillBar({
  fraction,
  className
}: {
  fraction: number
  className?: string
}) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className="h-full"
    >
      <ScrollBar
        progress={progress}
        fraction={fraction}
        className={className}
      />
    </div>
  )
}

// Arco del medidor de score que se dibuja con el scroll hasta `value` (0–100)
export function ScrollGaugeArc({
  value,
  stroke
}: {
  value: number
  stroke: string
}) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()
  const dash = useTransform(progress, (v) => `${v * value} 100`)

  return (
    <div
      ref={ref}
      className="absolute inset-0"
    >
      <svg
        viewBox="0 0 120 68"
        className="size-full"
      >
        <m.path
          d="M10 60a50 50 0 0 1 100 0"
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          style={{ strokeDasharray: dash }}
        />
      </svg>
    </div>
  )
}

// Contenedor que se acomoda con el scroll: de un poco más chico a su tamaño
export function ScrollSettle({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()
  const scale = useTransform(progress, [0, 1], [0.94, 1])
  const opacity = useTransform(progress, [0, 0.6], [0.6, 1])

  return (
    <m.div
      ref={ref}
      className={className}
      style={{ scale, opacity }}
    >
      {children}
    </m.div>
  )
}
