"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"

interface TransactionsFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Selects de tipo, categoría y cuenta a todo el ancho */
  children: React.ReactNode
  isAllMonths: boolean
  onToggleAllMonths: () => void
  /** Filtros activos de la hoja; con 0 no se ofrece limpiar */
  activeCount: number
  onClear: () => void
}

/** < 768 px: hoja inferior con los filtros. Aplica al elegir, sin "Aplicar" */
export function TransactionsFiltersSheet({
  open,
  onOpenChange,
  children,
  isAllMonths,
  onToggleAllMonths,
  activeCount,
  onClear
}: TransactionsFiltersSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] rounded-t-4xl pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <SheetHeader className="pb-2">
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-6 py-1">
          {children}
          <Button
            variant="secondary"
            className="w-full"
            aria-pressed={isAllMonths}
            onClick={onToggleAllMonths}
          >
            {isAllMonths ? "Ver por mes" : "Todos los meses"}
          </Button>
        </div>
        <SheetFooter className="flex-row items-center justify-between gap-3">
          {activeCount > 0 ? (
            <Button
              variant="ghost"
              onClick={onClear}
            >
              <X />
              Limpiar filtros
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
