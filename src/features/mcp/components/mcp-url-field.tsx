"use client"

import type { Route } from "next"
import Link from "next/link"
import { Button, Input, Label, TextField, cn, toast } from "@heroui/react"
import { Copy } from "lucide-react"
import { SITE } from "@/config/site"

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
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("URL copiada")
    } catch {
      toast.danger("No se pudo copiar. Selecciónala y cópiala a mano.")
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          value={url}
          isReadOnly
          className="flex min-w-0 flex-1 flex-col gap-2"
        >
          <Label>{label}</Label>
          <Input
            className="font-mono text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
        </TextField>
        <Button
          variant="secondary"
          className="min-h-11 sm:min-h-10"
          onPress={copy}
        >
          <Copy className="size-4" />
          Copiar
        </Button>
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
