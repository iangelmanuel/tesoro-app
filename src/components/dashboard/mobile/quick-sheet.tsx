"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useCommandPalette } from "../command/command-palette-context"
import { preloadCommandPalette } from "../command/command-palette-lazy"
import {
  type QuickAction,
  preloadQuickAction,
  useQuickActions
} from "../quick-actions/quick-actions-context"

interface QuickSheetProps {
  /** Hoja abierta */
  open: boolean
  /** Avisa al abrir o cerrar la hoja */
  onOpenChange: (open: boolean) => void
  /** Apertura automática al entrar (preferencia de este dispositivo) */
  autoOpen: boolean
  /** Guarda la preferencia de apertura automática */
  onAutoOpenChange: (autoOpen: boolean) => void
}

// Hoja inferior de acciones rápidas del teléfono, igual en Personal y
// Empresa. Muestra la misma lista que el botón del header y la paleta de
// comandos (quick-actions-context): primero lo que registra, luego las
// herramientas. Cada acción cierra la hoja y abre su diálogo sin cambiar de
// página. Se cierra deslizando hacia abajo, tocando el fondo, con "Cerrar" o
// con Escape. Solo existe en rutas de un espacio.
export function QuickSheet({
  open,
  onOpenChange,
  autoOpen,
  onAutoOpenChange
}: QuickSheetProps) {
  const { workspace, actions, run } = useQuickActions()
  const palette = useCommandPalette()

  if (!workspace) {
    return null
  }

  const isPersonal = workspace.type === "personal"
  const register = actions.filter((action) => action.group === "register")
  const tools = actions.filter((action) => action.group === "tool")

  function renderAction({ key, label, icon: Icon }: QuickAction) {
    return (
      <Button
        key={key}
        variant={key === "movement" ? "default" : "secondary"}
        className="min-h-14 w-full justify-start gap-3 rounded-2xl text-base"
        onClick={() => {
          onOpenChange(false)
          run(key)
        }}
        onPointerEnter={() => preloadQuickAction(key)}
        onFocus={() => preloadQuickAction(key)}
      >
        <Icon className="size-5" />
        {label}
      </Button>
    )
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      showSwipeHandle
    >
      <DrawerContent className="pb-[env(safe-area-inset-bottom)] md:hidden">
        <DrawerHeader>
          <DrawerTitle>
            {isPersonal ? "Registrar" : "Registrar movimiento"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Acciones rápidas del espacio
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4">
          <Button
            variant="secondary"
            className="min-h-12 w-full justify-start gap-3 rounded-2xl text-muted-foreground"
            onClick={() => {
              onOpenChange(false)
              palette.setOpen(true)
            }}
            onPointerEnter={preloadCommandPalette}
            onFocus={preloadCommandPalette}
          >
            <Search className="size-5" />
            Buscar o ejecutar
          </Button>
          {register.map(renderAction)}
          <Separator className="my-1" />
          {tools.map(renderAction)}
        </div>
        <DrawerFooter className="flex-row items-center justify-between gap-3">
          <Label className="min-h-11 cursor-pointer gap-3">
            <Switch
              checked={autoOpen}
              onCheckedChange={onAutoOpenChange}
            />
            Abrir al entrar
          </Label>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                className="min-w-11"
              />
            }
          >
            Cerrar
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
