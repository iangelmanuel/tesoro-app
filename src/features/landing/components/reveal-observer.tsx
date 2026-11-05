"use client"

import { useEffect } from "react"

const TARGETS = "[data-reveal], [data-reveal-list]"

// Un solo IntersectionObserver para toda la landing (SPEC 24). Su primer aviso
// dice qué bloques están fuera de pantalla: esos pasan a `data-pending`
// (ocultos en CSS) y, al entrar, pierden la marca y la transición los muestra,
// una vez. No mide nada a mano (sin layouts forzados durante la hidratación) y
// lo que ya se ve no se toca. Sin JS o con reduced motion no se oculta nada.
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const seen = new WeakSet<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const first = !seen.has(entry.target)
          seen.add(entry.target)
          if (entry.isIntersecting) {
            entry.target.removeAttribute("data-pending")
            observer.unobserve(entry.target)
          } else if (first) {
            entry.target.setAttribute("data-pending", "")
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    )
    for (const element of document.querySelectorAll(TARGETS)) {
      observer.observe(element)
    }

    return () => observer.disconnect()
  }, [])

  return null
}
