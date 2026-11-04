"use client"

import { useEffect, useRef, useState } from "react"
import { m } from "motion/react"

type FeatureClipProps = {
  sources: { mp4: string; webm: string; poster: string }
}

type NetworkInformation = { saveData?: boolean }

// Clip corto de una función (SPEC 24): loop silenciado que solo se reproduce
// mientras la tarjeta está en pantalla. Con `prefers-reduced-motion` o ahorro
// de datos se queda en el póster y no descarga el video. Al arrancar, una
// capa con el póster se desvanece para que el paso a video no salte.
export function FeatureClip({ sources }: FeatureClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-[#dff5ea] shadow-[0_30px_60px_-30px_rgba(2,44,34,0.5),0_10px_20px_-10px_rgba(2,44,34,0.2)]">
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        poster={sources.poster}
        width={1920}
        height={1080}
        preload="none"
        muted
        loop
        playsInline
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => setLive(true)}
      >
        <source
          src={sources.webm}
          type="video/webm"
        />
        <source
          src={sources.mp4}
          type="video/mp4"
        />
      </video>
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${sources.poster})` }}
        initial={false}
        animate={{ opacity: live ? 0 : 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}
