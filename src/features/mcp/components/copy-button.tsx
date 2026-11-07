"use client"

import { useEffect, useState } from "react"
import { Button, cn, toast } from "@heroui/react"
import { Check, Copy } from "lucide-react"

interface CopyButtonProps {
  value: string
  /** Toast al copiar (solo se ve donde hay ToastProvider: el dashboard) */
  toastMessage?: string
  /** Nombre accesible cuando el botón es solo ícono */
  label?: string
  iconOnly?: boolean
  variant?: "secondary" | "ghost"
  className?: string
}

// Copia un texto al portapapeles. El botón confirma por sí mismo ("Copiado"
// con un check durante 2 s): en las páginas públicas no hay ToastProvider.
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
      toast.danger("No se pudo copiar. Selecciónalo y cópialo a mano.")
    }
  }

  const Icon = copied ? Check : Copy

  return (
    <Button
      variant={variant}
      isIconOnly={iconOnly}
      aria-label={iconOnly ? (copied ? "Copiado" : label) : undefined}
      className={cn("min-h-11 shrink-0 md:min-h-10", className)}
      onPress={copy}
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
