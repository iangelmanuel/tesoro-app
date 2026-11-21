"use client"

import { useId } from "react"
import type { Route } from "next"
import Link from "next/link"
import { FieldLabel } from "@/components/forms/field-label"
import { Input } from "@/components/ui/input"
import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"
import { CopyButton } from "./copy-button"

interface McpUrlFieldProps {
  /** URL completa del endpoint MCP (SITE_URL + SITE.mcp.path) */
  url: string
  /** Enlace "Cómo conectarla" a /mcp */
  showGuideLink?: boolean
  label?: string
  className?: string
}

// URL del servidor MCP de solo lectura con botón Copiar (SPEC 34). La usan
// Cuenta → Agentes IA, la landing y la página /mcp.
export function McpUrlField({
  url,
  showGuideLink = false,
  label = "Tu URL de MCP",
  className
}: McpUrlFieldProps) {
  const id = useId()

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            value={url}
            readOnly
            className="font-mono text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <CopyButton
          value={url}
          toastMessage="URL copiada"
        />
      </div>
      {showGuideLink && (
        <Link
          href={SITE.mcp.docsPath as Route}
          className="self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          Cómo conectarla
        </Link>
      )}
    </div>
  )
}
