"use client"

import { useRef, useState } from "react"
import { cn } from "@heroui/react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { AnimatePresence, m } from "motion/react"
import { SITE } from "@/config/site"

const { demo } = SITE.landing

const EASE_OUT = [0.16, 1, 0.3, 1] as const

// Clases compartidas de los botones del reproductor. Colores fijos: el video
// trae su escritorio claro y el contenedor es claro en los dos temas.
const BUTTON =
  "flex items-center justify-center rounded-full bg-white/90 text-[#0b1220] shadow-[0_10px_30px_-8px_rgba(2,20,15,0.45)] backdrop-blur outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-2 focus-visible:ring-offset-[#dff5ea]"

// Reproductor del video principal (SPEC 24). Muestra el póster hasta que el
// usuario pulsa play: nunca hay autoplay y `preload="none"` evita descargar el
// video antes. Al empezar, la capa del póster se desvanece hacia el video.
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

        <AnimatePresence initial={false}>
          {!started ? (
            // Capa del póster: un velo suave y el play grande al centro
            <m.div
              key="cover"
              className="absolute inset-0 flex items-center justify-center bg-[rgba(2,44,34,0.1)]"
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              <m.button
                type="button"
                onClick={toggle}
                aria-label="Reproducir el video"
                className={cn(BUTTON, "size-20 sm:size-24")}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
              >
                <PlayIcon
                  aria-hidden="true"
                  className="size-8 translate-x-0.5 fill-current sm:size-9"
                />
              </m.button>
            </m.div>
          ) : (
            <m.button
              key="control"
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pausar el video" : "Reproducir el video"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className={cn(
                BUTTON,
                "absolute bottom-4 left-4 size-12 transition-opacity duration-200 motion-reduce:transition-none",
                // En reproducción se oculta hasta pasar el mouse o enfocarlo
                playing &&
                  "opacity-0! group-hover:opacity-100! focus-visible:opacity-100!"
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
                  className="size-5 translate-x-0.5 fill-current"
                />
              )}
            </m.button>
          )}
        </AnimatePresence>
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
