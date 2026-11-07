"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@heroui/react"
import { SITE } from "@/config/site"

type NetworkInformation = { saveData?: boolean }

const VIDEO = SITE.landing.agents.video

// Fondo del video (night-surface de DESIGN.md): mientras carga, el marco ya
// tiene su color y el paso a video no salta. Es el color propio del video, no
// un color de interfaz, así que no cambia con el tema.
const VIDEO_BACKGROUND = "oklch(0.215 0.005 264)"

/**
 * Conversación con un agente conectado a Tesoro (SPEC 34), renderizada con
 * HyperFrames (video/clips/agentes.html). Loop silenciado y sin controles que
 * solo se reproduce en pantalla. Con reduced motion o ahorro de datos se queda
 * en el póster y no descarga el video. La descripción va para lectores de
 * pantalla.
 */
export function AgentDemoVideo({ className }: { className?: string }) {
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
      { threshold: 0.35 }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [])

  return (
    <figure
      className={cn(
        "relative w-full overflow-hidden rounded-3xl shadow-(--surface-shadow)",
        className
      )}
      style={{
        aspectRatio: `${VIDEO.width} / ${VIDEO.height}`,
        backgroundColor: VIDEO_BACKGROUND
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        width={VIDEO.width}
        height={VIDEO.height}
        preload="none"
        muted
        loop
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => setLive(true)}
      >
        <source
          src={VIDEO.webm}
          type="video/webm"
        />
        <source
          src={VIDEO.mp4}
          type="video/mp4"
        />
      </video>
      {/* Póster como imagen diferida que se desvanece al arrancar el video:
          el atributo poster se descarga aunque esté fuera de pantalla */}
      {/* eslint-disable-next-line @next/next/no-img-element -- póster estático de public/videos, sin optimizar a propósito */}
      <img
        src={VIDEO.poster}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={VIDEO.width}
        height={VIDEO.height}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          live && "opacity-0"
        )}
      />
      <figcaption className="sr-only">{VIDEO.description}</figcaption>
    </figure>
  )
}
