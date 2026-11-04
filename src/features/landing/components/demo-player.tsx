"use client"

import { useRef, useState } from "react"
import { cn } from "@heroui/react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { SITE } from "@/config/site"

const { demo } = SITE.landing

// Reproductor del video principal (SPEC 24). Muestra el póster hasta que el
// usuario pulsa play: nunca hay autoplay y `preload="none"` evita descargar el
// video antes. El video ya trae su escritorio claro, así que el contenedor es
// claro en los dos temas (colores fijos, no tokens del tema).
export function DemoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)

  function toggle() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  return (
    <figure className="flex flex-col gap-3">
      <div className="group relative aspect-video overflow-hidden rounded-3xl bg-[#dff5ea] shadow-[0_40px_80px_-40px_rgba(2,44,34,0.55),0_12px_24px_-12px_rgba(2,44,34,0.25)]">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          poster={demo.sources.poster}
          width={demo.width}
          height={demo.height}
          preload="none"
          playsInline
          aria-label={demo.title}
          aria-describedby="demo-description"
          onClick={toggle}
          onPlay={() => {
            setStarted(true)
            setPlaying(true)
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        >
          <source
            src={demo.sources.webm}
            type="video/webm"
          />
          <source
            src={demo.sources.mp4}
            type="video/mp4"
          />
        </video>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar el video" : "Reproducir el video"}
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-white/90 text-[#0b1220] shadow-[0_10px_30px_-8px_rgba(2,20,15,0.45)] backdrop-blur transition-[opacity,transform] duration-200 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-2 focus-visible:ring-offset-[#dff5ea] motion-reduce:transition-none",
            !started &&
              "top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 hover:scale-105 sm:size-24",
            started && "bottom-4 left-4 size-12",
            // En reproducción el botón se oculta hasta pasar el mouse o enfocar
            started &&
              playing &&
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          )}
        >
          {playing ? (
            <PauseIcon
              aria-hidden="true"
              className="size-5 fill-current"
            />
          ) : (
            <PlayIcon
              aria-hidden="true"
              className={cn(
                "translate-x-0.5 fill-current",
                started ? "size-5" : "size-8 sm:size-9"
              )}
            />
          )}
        </button>
      </div>
      <figcaption
        id="demo-description"
        className="sr-only"
      >
        {demo.description} Recorrido sin audio, con datos de ejemplo: el cursor
        abre Tesoro y pasa por el resumen del mes, los presupuestos, las metas,
        las deudas, el score con sus recomendaciones y el flujo de caja del
        espacio Empresa.
      </figcaption>
    </figure>
  )
}
