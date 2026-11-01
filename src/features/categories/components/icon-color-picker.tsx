"use client"

import { useState } from "react"
import { Label, ToggleButton, ToggleButtonGroup, cn } from "@heroui/react"
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
        <Label id="category-icon-label">Icono</Label>
        <ToggleButtonGroup
          aria-labelledby="category-icon-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[icon]}
          onSelectionChange={(keys) => {
            const [value] = [...keys]
            if (value) setIcon(String(value))
          }}
          size="sm"
          isDetached
          className="flex-wrap"
        >
          {CATEGORY_ICON_KEYS.map((key: CategoryIconKey) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <ToggleButton
                key={key}
                id={key}
                isIconOnly
                aria-label={key}
              >
                <Icon />
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>
        {iconErrors && <p className="text-sm text-danger">{iconErrors[0]}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label id="category-color-label">Color</Label>
        <ToggleButtonGroup
          aria-labelledby="category-color-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[color]}
          onSelectionChange={(keys) => {
            const [value] = [...keys]
            if (value) setColor(String(value))
          }}
          size="sm"
          isDetached
          className="flex-wrap"
        >
          {CATEGORY_COLOR_KEYS.map((key: CategoryColorKey) => (
            <ToggleButton
              key={key}
              id={key}
              isIconOnly
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
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {colorErrors && <p className="text-sm text-danger">{colorErrors[0]}</p>}
      </div>
    </>
  )
}
