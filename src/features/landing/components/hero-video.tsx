"use client"

import { useEffect, useRef, useState } from "react"

type NetworkInformation = { saveData?: boolean }

// Video de fondo del hero (SPEC 40). Lo pinta el servidor con autoplay, así
// que sin JS ya se reproduce (o queda el póster). Esta isla solo hace tres
// cosas, sin cambiar ningún tamaño:
// - con reduced motion o ahorro de datos lo detiene y corta la descarga
//   (CSS ya lo oculta con reduced motion; con Save-Data lo oculta
//   data-paused);
// - lo pausa fuera de pantalla para no gastar CPU;
// - asegura muted antes de play(), porque React no siempre escribe el
//   atributo en el HTML del servidor.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
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
      video.removeAttribute("autoplay")
      for (const source of video.querySelectorAll("source")) source.remove()
      video.load()
      setPaused(true)
    }

    if (motion.matches || saveData) {
      stop()
      return
    }

    video.muted = true
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        void video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
    observer.observe(video)
    motion.addEventListener("change", stop, { once: true })

    return () => {
      observer.disconnect()
      motion.removeEventListener("change", stop)
    }
  }, [])

  return (
    <video
      ref={ref}
      aria-hidden="true"
      tabIndex={-1}
      className="hero-video absolute inset-0 size-full object-cover"
      data-paused={paused || undefined}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="metadata"
    >
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
    </video>
  )
}
