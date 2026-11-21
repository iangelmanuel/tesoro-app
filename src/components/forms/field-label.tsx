"use client"

import type { ComponentProps, ReactNode } from "react"
import { MessageCircleQuestionMark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { FIELD_HELP, type FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"

type LabelStateProps = {
  /** Marca el campo como requerido (asterisco) */
  isRequired?: boolean
  /** Pinta la etiqueta en rojo */
  isInvalid?: boolean
  disabled?: boolean
}

type FieldLabelProps = ComponentProps<typeof Label> &
  LabelStateProps & {
    children: ReactNode
    /** Clave de FIELD_HELP. Sin ella, se comporta como un Label normal */
    help?: FieldHelpKey
    /** Texto de la ayuda accesible cuando la etiqueta no es texto plano */
    helpLabel?: string
  }

/**
 * Ícono (?) con la ayuda de un campo. Es un Popover, como HelpHint: se abre
 * con clic, toque o teclado, no solo al pasar el mouse. Se dibuja de 24 px y
 * su área táctil llega a 44 px (touch-hitbox). El ícono usa
 * text-muted-foreground (AA sobre --card y --popover en claro y oscuro, ver
 * docs/ui.md). Se usa suelto solo donde la etiqueta no es un Label (p. ej.
 * el texto de un Switch); en el resto, FieldLabel
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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label ? `Ayuda: ${label}` : "Ayuda"}
            className={cn(
              "-my-1 size-6 shrink-0 cursor-help text-muted-foreground hover:text-foreground",
              className
            )}
          />
        }
      >
        <MessageCircleQuestionMark
          aria-hidden
          className="size-3.5"
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-auto max-w-72 gap-0 p-3 text-sm leading-relaxed"
      >
        {FIELD_HELP[help]}
      </PopoverContent>
    </Popover>
  )
}

/** Label de `ui/` con el estado del campo: asterisco si es requerido, rojo
 *  si es inválido y atenuado si está deshabilitado */
function StateLabel({
  className,
  children,
  isRequired,
  isInvalid,
  disabled,
  ...props
}: ComponentProps<typeof Label> & LabelStateProps) {
  return (
    <Label
      data-disabled={disabled || undefined}
      className={cn(
        isInvalid && "text-destructive",
        disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {isRequired ? (
        <span
          aria-hidden
          className="-ml-1.5 text-destructive"
        >
          *
        </span>
      ) : null}
    </Label>
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
      <StateLabel
        className={className}
        {...props}
      >
        {children}
      </StateLabel>
    )
  }

  return (
    <span className="inline-flex w-fit items-center gap-0.5">
      <StateLabel
        className={className}
        {...props}
      >
        {children}
      </StateLabel>
      <FieldHelp
        help={help}
        label={helpLabel ?? (typeof children === "string" ? children : "")}
      />
    </span>
  )
}
