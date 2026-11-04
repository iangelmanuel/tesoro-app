"use client"

import { useEffect, useRef } from "react"

type FeatureClipProps = {
  sources: { mp4: string; webm: string; poster: string }
}

type NetworkInformation = { saveData?: boolean }

// Clip corto de una función (SPEC 24): loop silenciado que solo se reproduce
// mientras la tarjeta está en pantalla. Con `prefers-reduced-motion` o ahorro
// de datos se queda en el póster y no descarga el video.
export function FeatureClip({ sources }: FeatureClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

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
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-2xl bg-[#dff5ea] object-cover"
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
  )
}
