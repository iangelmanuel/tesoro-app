"use client"

import { useState } from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  type CategoryColorKey,
  type CategoryIconKey
} from "../constants"

interface IconColorPickerProps {
  defaultIcon?: string
  defaultColor?: string
  iconErrors?: string[]
  colorErrors?: string[]
}

// Selector de icono y color con las paletas de categorías. Envía la
// elección en los campos ocultos "icon" y "color" del formulario.
export function IconColorPicker({
  defaultIcon = CATEGORY_ICON_KEYS[0],
  defaultColor = CATEGORY_COLOR_KEYS[0],
  iconErrors,
  colorErrors
}: IconColorPickerProps) {
  const [icon, setIcon] = useState<string>(defaultIcon)
  const [color, setColor] = useState<string>(defaultColor)

  return (
    <>
      <input
        type="hidden"
        name="icon"
        value={icon}
      />
      <input
        type="hidden"
        name="color"
        value={color}
      />

      <div className="flex flex-col gap-2">
        <Label>Icono</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={icon}
          onValueChange={(value) => value && setIcon(value)}
          className="w-full flex-wrap"
        >
          {CATEGORY_ICON_KEYS.map((key: CategoryIconKey) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <ToggleGroupItem
                key={key}
                value={key}
                aria-label={key}
              >
                <Icon />
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        {iconErrors && (
          <p className="text-sm text-destructive">{iconErrors[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Color</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={color}
          onValueChange={(value) => value && setColor(value)}
          className="w-full flex-wrap"
        >
          {CATEGORY_COLOR_KEYS.map((key: CategoryColorKey) => (
            <ToggleGroupItem
              key={key}
              value={key}
              aria-label={key}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  CATEGORY_COLORS[key]
                )}
              >
                <span className="size-2 rounded-full bg-current" />
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {colorErrors && (
          <p className="text-sm text-destructive">{colorErrors[0]}</p>
        )}
      </div>
    </>
  )
}
