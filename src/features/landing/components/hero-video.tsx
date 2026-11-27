"use client"

import { useEffect, useRef, useState } from "react"

type NetworkInformation = { saveData?: boolean }

// Video de fondo del hero (SPEC 40). El primer pintado y el LCP son los
// pósters del <picture> de debajo; el video llega después (SPEC 56c): las
// <source> se montan tras el evento `load` y en idle, así el video no le
// quita ancho de banda al póster. Sin JS solo se ve el póster. Además:
// - con reduced motion o ahorro de datos no monta las fuentes (CSS lo oculta
//   con reduced motion; con Save-Data lo oculta data-paused);
// - lo pausa fuera de pantalla para no gastar CPU;
// - asegura muted antes de play(), porque React no siempre escribe el
//   atributo en el HTML.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const visibleRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const saveData =
      (navigator as Navigator & { connection?: NetworkInformation }).connection
        ?.saveData === true

    function stop() {
      if (!video) return
      video.pause()
      setReady(false)
      setPaused(true)
    }

    if (motion.matches || saveData) {
      stop()
      return
    }

    video.muted = true
    let cancelMount = () => {}
    function mount() {
      // Safari no tiene requestIdleCallback
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => setReady(true), {
          timeout: 2000
        })
        cancelMount = () => window.cancelIdleCallback(id)
      } else {
        const id = window.setTimeout(() => setReady(true), 200)
        cancelMount = () => window.clearTimeout(id)
      }
    }
    if (document.readyState === "complete") {
      mount()
    } else {
      window.addEventListener("load", mount, { once: true })
    }

    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting === true
      // Sin fuentes todavía no hay qué reproducir: lo arranca el efecto de
      // abajo al montarlas
      if (!video.querySelector("source")) return
      if (visibleRef.current) {
        void video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
    observer.observe(video)
    motion.addEventListener("change", stop, { once: true })

    return () => {
      window.removeEventListener("load", mount)
      cancelMount()
      observer.disconnect()
      motion.removeEventListener("change", stop)
    }
  }, [])

  // Al montar o quitar las fuentes, el video recarga: arranca si está en
  // pantalla, o suelta la descarga si se detuvo
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (ready) {
      if (visibleRef.current) void video.play().catch(() => {})
    } else if (paused) {
      video.load()
    }
  }, [ready, paused])

  return (
    <video
      ref={ref}
      aria-hidden="true"
      tabIndex={-1}
      className="hero-video absolute inset-0 size-full object-cover"
      data-paused={paused || undefined}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="metadata"
    >
      {ready && (
        <>
          <source
            media="(max-width: 767px)"
            src="/videos/hero-mobile.webm"
            type="video/webm"
          />
          <source
            media="(max-width: 767px)"
            src="/videos/hero-mobile.mp4"
            type="video/mp4"
          />
          <source
            src="/videos/hero.webm"
            type="video/webm"
          />
          <source
            src="/videos/hero.mp4"
            type="video/mp4"
          />
        </>
      )}
    </video>
  )
}
