"use client"

import { HeroUIPortalBridge } from "@/components/dashboard/heroui-portal-bridge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"

// TEMPORAL (SPEC 52a, paso 1): prueba del puente de portales dentro de un
// Modal de HeroUI. Se borra en el paso 2, cuando DatePickerField lo reemplaza
export function PortalBridgeProbe() {
  return (
    <HeroUIPortalBridge>
      <Popover>
        <PopoverTrigger render={<Button variant="secondary" />}>
          Probar puente (temporal)
        </PopoverTrigger>
        <PopoverContent>
          <p>Si puedes escribir aquí, el puente funciona.</p>
          <Input
            aria-label="Prueba"
            placeholder="Escribe algo"
          />
        </PopoverContent>
      </Popover>
    </HeroUIPortalBridge>
  )
}
