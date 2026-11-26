"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"

interface FormDialogProps {
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  /**
   * Al pasar el puntero o enfocar el `trigger`: precarga el formulario
   * diferido (SPEC 56b)
   */
  onTriggerIntent?: () => void
  /** Abierto, si el diálogo se controla desde afuera */
  open?: boolean
  /** Avisa al abrir o cerrar, si se controla desde afuera */
  onOpenChange?: (open: boolean) => void
  /** Título del diálogo */
  title: React.ReactNode
  /** Texto bajo el título: qué hace el formulario */
  description?: React.ReactNode
  /** El formulario. Se desmonta al cerrar: cada apertura empieza limpia */
  children: (close: () => void) => React.ReactNode
  /** En el teléfono se pega abajo, como hoja */
  bottomOnMobile?: boolean
  /** Clases del contenido del diálogo */
  className?: string
}

/**
 * Diálogo de un formulario (shadcn): título, descripción y el formulario,
 * con scroll interno si no cabe. Controlado o con `trigger`. Siempre es
 * modal: atrapa el foco y Escape lo cierra
 */
export function FormDialog({
  trigger,
  onTriggerIntent,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  children,
  bottomOnMobile = false,
  className
}: FormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger ? (
        <DialogTrigger
          render={trigger}
          onPointerEnter={onTriggerIntent}
          onFocus={onTriggerIntent}
        />
      ) : null}
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          bottomOnMobile &&
            "max-md:top-auto max-md:bottom-0 max-md:max-h-[calc(100dvh-1rem)] max-md:max-w-full max-md:translate-y-0 max-md:rounded-b-none max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <DialogHeader className="pr-10">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hueco del formulario de un FormDialog mientras llega su chunk (SPEC 56b):
 * campos con etiqueta y la fila de botones, con las alturas de
 * TextInputField y Button. El título y la descripción ya son los reales
 */
export function FormDialogBodySkeleton({
  fields = 4,
  tabs = false
}: {
  /** Cuántos campos lleva el formulario al abrir */
  fields?: number
  /** El formulario abre con tabs arriba (SegmentedField) */
  tabs?: boolean
}) {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
    >
      <span className="sr-only">Cargando formulario</span>
      {tabs && <Skeleton className="h-11 w-full rounded-4xl" />}
      {Array.from({ length: fields }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-4xl" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-11 w-24 rounded-4xl" />
        <Skeleton className="h-11 w-32 rounded-4xl" />
      </div>
    </div>
  )
}
