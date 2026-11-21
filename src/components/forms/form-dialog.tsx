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
import { cn } from "@/libs/cn"

interface FormDialogProps {
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** El formulario. Se desmonta al cerrar: cada apertura empieza limpia */
  children: (close: () => void) => React.ReactNode
  /** En el teléfono se pega abajo, como hoja */
  bottomOnMobile?: boolean
  className?: string
}

/**
 * Diálogo de un formulario (shadcn): título, descripción y el formulario,
 * con scroll interno si no cabe. Controlado o con `trigger`. Siempre es
 * modal: atrapa el foco y Escape lo cierra
 */
export function FormDialog({
  trigger,
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
      {trigger ? <DialogTrigger render={trigger} /> : null}
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
