"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/cn"

// sonner se pide al copiar, no al cargar: en las páginas públicas no hay
// Toaster y no tiene por qué viajar en su JS inicial (SPEC 56c)
const loadToast = () =>
  import("@/components/ui/sonner").then((module) => module.toast)

interface CopyButtonProps {
  value: string
  /** Toast al copiar (solo se ve donde hay Toaster: el dashboard) */
  toastMessage?: string
  /** Nombre accesible cuando el botón es solo ícono */
  label?: string
  iconOnly?: boolean
  variant?: "secondary" | "ghost"
  className?: string
}

// Copia un texto al portapapeles. El botón confirma por sí mismo ("Copiado"
// con un check durante 2 s): en las páginas públicas no hay Toaster.
export function CopyButton({
  value,
  toastMessage,
  label = "Copiar",
  iconOnly = false,
  variant = "secondary",
  className
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (toastMessage) void loadToast().then((t) => t.success(toastMessage))
    } catch {
      void loadToast().then((t) =>
        t.error("No se pudo copiar. Selecciónalo y cópialo a mano")
      )
    }
  }

  const Icon = copied ? Check : Copy

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : "default"}
      aria-label={iconOnly ? (copied ? "Copiado" : label) : undefined}
      className={cn("shrink-0", className)}
      onClick={copy}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-4", copied && "text-(--income)")}
      />
      {iconOnly ? (
        <span
          className="sr-only"
          aria-live="polite"
        >
          {copied ? "Copiado" : ""}
        </span>
      ) : (
        <span aria-live="polite">{copied ? "Copiado" : label}</span>
      )}
    </Button>
  )
}
