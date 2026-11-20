"use client"

import { useId, useState } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { FieldError } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/libs/cn"
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

// Elegido: relleno suave y contorno en el primario del espacio
const ITEM_CLASS =
  "size-9 min-w-9 p-0 data-pressed:bg-highlight data-pressed:outline-2 data-pressed:outline-primary"

// Selector de icono y color con las paletas de categorías. Envía la
// elección en los campos ocultos "icon" y "color" del formulario.
export function IconColorPicker({
  defaultIcon = CATEGORY_ICON_KEYS[0],
  defaultColor = CATEGORY_COLOR_KEYS[0],
  iconErrors,
  colorErrors
}: IconColorPickerProps) {
  const id = useId()
  const [icon, setIcon] = useState<string>(defaultIcon)
  const [color, setColor] = useState<string>(defaultColor)
  const iconError = iconErrors?.[0]
  const colorError = colorErrors?.[0]

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
        <FieldLabel
          id={`${id}-icon`}
          help="common.icon"
          isInvalid={Boolean(iconError)}
        >
          Icono
        </FieldLabel>
        <ToggleGroup
          aria-labelledby={`${id}-icon`}
          aria-describedby={iconError ? `${id}-icon-error` : undefined}
          value={[icon]}
          onValueChange={(values) => {
            const [value] = values
            if (value) setIcon(String(value))
          }}
          size="sm"
          spacing={1}
          className="w-full flex-wrap"
        >
          {CATEGORY_ICON_KEYS.map((key: CategoryIconKey) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <ToggleGroupItem
                key={key}
                value={key}
                aria-label={key}
                className={ITEM_CLASS}
              >
                <Icon aria-hidden />
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        {iconError ? (
          <FieldError id={`${id}-icon-error`}>{iconError}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel
          id={`${id}-color`}
          help="common.color"
          isInvalid={Boolean(colorError)}
        >
          Color
        </FieldLabel>
        <ToggleGroup
          aria-labelledby={`${id}-color`}
          aria-describedby={colorError ? `${id}-color-error` : undefined}
          value={[color]}
          onValueChange={(values) => {
            const [value] = values
            if (value) setColor(String(value))
          }}
          size="sm"
          spacing={1}
          className="w-full flex-wrap"
        >
          {CATEGORY_COLOR_KEYS.map((key: CategoryColorKey) => (
            <ToggleGroupItem
              key={key}
              value={key}
              aria-label={key}
              className={ITEM_CLASS}
            >
              <span
                aria-hidden
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
        {colorError ? (
          <FieldError id={`${id}-color-error`}>{colorError}</FieldError>
        ) : null}
      </div>
    </>
  )
}
