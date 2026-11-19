"use client"

import type { ComponentProps, ReactNode } from "react"
import { Label, Tooltip, cn } from "@heroui/react"
import { MessageCircleQuestionMark } from "lucide-react"
import { FIELD_HELP, type FieldHelpKey } from "@/config/help"

type FieldLabelProps = ComponentProps<typeof Label> & {
  children: ReactNode
  /** Clave de FIELD_HELP. Sin ella, se comporta como un Label normal */
  help?: FieldHelpKey
  /** Texto de la ayuda accesible cuando la etiqueta no es texto plano */
  helpLabel?: string
}

/**
 * Ícono (?) con la ayuda de un campo. Es un Tooltip: se abre al pasar el
 * mouse o al llegar con Tab. El disparador es Tooltip.Trigger (un div con
 * role="button" enfocable) y no un Button: dentro de Select, DatePicker o
 * NumberField un Button tomaría el ButtonContext del campo y abriría el
 * campo en vez del tooltip. El ícono usa text-muted/80 (≥ 3.6:1 sobre
 * --surface y --overlay en claro y oscuro, ver docs/ui.md) y text-muted al
 * pasar el mouse o con foco. Se usa suelto solo donde la etiqueta no es un
 * Label (p. ej. el texto de un Switch); en el resto, FieldLabel
 */
export function FieldHelp({
  help,
  label,
  className
}: {
  help: FieldHelpKey
  /** Nombre del campo para la etiqueta accesible ("Ayuda: …") */
  label?: string
  className?: string
}) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={label ? `Ayuda: ${label}` : "Ayuda"}
        className={cn(
          "-my-1 inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full text-muted/80 outline-none",
          "hover:text-muted focus-visible:text-muted focus-visible:ring-2 focus-visible:ring-focus",
          className
        )}
      >
        <MessageCircleQuestionMark
          aria-hidden
          className="size-3.5"
        />
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-72 text-sm leading-relaxed">
        {FIELD_HELP[help]}
      </Tooltip.Content>
    </Tooltip>
  )
}

/** Etiqueta de un campo con el (?) de FieldHelp a la derecha */
export function FieldLabel({
  children,
  help,
  helpLabel,
  className,
  ...props
}: FieldLabelProps) {
  if (!help) {
    return (
      <Label
        className={className}
        {...props}
      >
        {children}
      </Label>
    )
  }

  return (
    <span className="inline-flex w-fit items-center gap-0.5">
      <Label
        className={className}
        {...props}
      >
        {children}
      </Label>
      <FieldHelp
        help={help}
        label={helpLabel ?? (typeof children === "string" ? children : "")}
      />
    </span>
  )
}
