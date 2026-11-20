"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon
} from "lucide-react"
import { useTheme } from "next-themes"
import {
  type ExternalToast,
  Toaster as Sonner,
  type ToasterProps,
  toast as sonnerToast
} from "sonner"
import { useIsMobile } from "@/hooks/use-is-mobile"

/**
 * Toasts del dashboard (sonner). Abajo a la derecha en escritorio y arriba
 * en el teléfono, donde abajo están la barra inferior y el pulgar. Sin
 * borde, con la superficie y la sombra de los overlays
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={(resolvedTheme ?? "system") as ToasterProps["theme"]}
      position={isMobile ? "top-center" : "bottom-right"}
      containerAriaLabel="Notificaciones"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 motion-safe:animate-spin" />
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "20px",
          "--width": "min(22rem, calc(100vw - 2rem))"
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast font-sans shadow-(--overlay-shadow)! text-sm! gap-3!",
          description: "text-muted-foreground!",
          error: "[&_[data-icon]]:text-destructive",
          success: "[&_[data-icon]]:text-success",
          warning: "[&_[data-icon]]:text-warning"
        }
      }}
      {...props}
    />
  )
}

type Message = Parameters<typeof sonnerToast>[0]

/**
 * `toast` de sonner con los errores en `role="alert"`: la región de sonner
 * es `aria-live="polite"`, y un error tiene que oírse en el momento
 * (SPEC 51 §7). El resto queda igual
 */
const toast = Object.assign(
  (message: Message, data?: ExternalToast) => sonnerToast(message, data),
  sonnerToast,
  {
    error: (message: Message, data?: ExternalToast) =>
      sonnerToast.error(
        typeof message === "string" ? (
          <span role="alert">{message}</span>
        ) : (
          message
        ),
        data
      )
  }
)

export { Toaster, toast }
