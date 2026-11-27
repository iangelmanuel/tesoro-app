"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { m } from "motion/react"

type FeatureClipProps = {
  sources: { mp4: string; webm: string; poster: string }
}

type NetworkInformation = { saveData?: boolean }

// Clip corto de una función (SPEC 24): loop silenciado que solo se reproduce
// mientras la tarjeta está en pantalla. Con `prefers-reduced-motion` o ahorro
// de datos se queda en el póster y no descarga el video. Al arrancar, una
// capa con el póster se desvanece para que el paso a video no salte.
//
// Las <source> se montan cuando la tarjeta está a menos de un viewport
// (SPEC 56c): con `preload="none"` algunos navegadores igual piden los
// metadatos, así que sin fuentes el clip no descarga nada hasta acercarse.
export function FeatureClip({ sources }: FeatureClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const visibleRef = useRef(false)
  const [near, setNear] = useState(false)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const saveData =
      (navigator as Navigator & { connection?: NetworkInformation }).connection
        ?.saveData === true
    if (reducedMotion || saveData) return

    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setNear(true)
        nearObserver.disconnect()
      },
      { rootMargin: "100% 0px" }
    )
    const playObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting === true
        // Sin fuentes todavía no hay qué reproducir: lo arranca el efecto
        // de abajo al montarlas
        if (!video.querySelector("source")) return
        if (visibleRef.current) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 }
    )
    nearObserver.observe(video)
    playObserver.observe(video)

    return () => {
      nearObserver.disconnect()
      playObserver.disconnect()
      video.pause()
    }
  }, [])

  // Al montar las fuentes con la tarjeta ya en pantalla (otra pestaña del
  // tour, o la página abierta a esa altura), arranca sin esperar otro cruce
  useEffect(() => {
    if (near && visibleRef.current) {
      void videoRef.current?.play().catch(() => {})
    }
  }, [near])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-[#dff5ea] shadow-[0_30px_60px_-30px_rgba(2,44,34,0.5),0_10px_20px_-10px_rgba(2,44,34,0.2)]">
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        width={1280}
        height={720}
        preload="none"
        muted
        loop
        playsInline
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => setLive(true)}
      >
        {near && (
          <>
            <source
              src={sources.webm}
              type="video/webm"
            />
            <source
              src={sources.mp4}
              type="video/mp4"
            />
          </>
        )}
      </video>
      {/* Póster como imagen diferida (el atributo poster del video se
          descarga enseguida aunque esté fuera de pantalla) */}
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ opacity: live ? 0 : 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Image
          src={sources.poster}
          alt=""
          fill
          sizes="(min-width: 1024px) 760px, 100vw"
          unoptimized
          className="object-cover"
        />
      </m.div>
    </div>
  )
}
