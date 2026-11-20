"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/libs/cn"

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
      if (toastMessage) toast.success(toastMessage)
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano")
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
