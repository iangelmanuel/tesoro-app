"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger
} from "@/components/ui/combobox"
import { FieldError } from "@/components/ui/field"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"
import { CREATE_OPTION, CreateOption } from "./create-option"

export interface CreatableSelectOption {
  /** Clave que viaja en el formulario */
  id: string
  /** Texto para buscar y para el lector de pantalla */
  text: string
  /** Cómo se pinta en la lista y en el botón */
  node: React.ReactNode
}

interface CreatableSelectProps {
  /** Etiqueta visible del campo */
  label: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
  /** Clave elegida, o null sin elegir */
  value: string | null
  /** Recibe la clave elegida. "+ Crear" llama a onCreate en su lugar */
  onChange: (key: string) => void
  /** Abre el alta de un elemento nuevo ("+ Crear …") */
  onCreate: () => void
  /** Opciones de la lista: clave, texto de búsqueda y cómo se pintan */
  options: CreatableSelectOption[]
  /** Texto de la opción final ("Crear cuenta") */
  createLabel: string
  /** Etiqueta accesible del buscador ("Buscar cuenta") */
  searchLabel: string
  /** Texto del trigger sin opción elegida */
  placeholder: string
  /** Error de Zod del campo */
  error?: string
  /** Bloquea el campo */
  disabled?: boolean
  /** Ayuda o aviso debajo del campo */
  children?: React.ReactNode
}

// Sin tildes ni mayúsculas: "credito" encuentra "Crédito"
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
}

/**
 * Select con búsqueda (Combobox de Base UI) y "+ Crear …" al final. El
 * botón muestra la opción elegida; el buscador vive dentro de la lista. La
 * opción de crear nunca queda como valor: llama a onCreate y siempre se
 * muestra, aunque la búsqueda no encuentre nada. Valida el servidor: el
 * error llega por `error` y se anuncia con aria-invalid + aria-describedby
 */
export function CreatableSelect({
  label,
  help,
  value,
  onChange,
  onCreate,
  options,
  createLabel,
  searchLabel,
  placeholder,
  error,
  disabled,
  children
}: CreatableSelectProps) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const errorId = `${id}-error`

  const byId = new Map(options.map((option) => [option.id, option]))
  const items = [...options.map((option) => option.id), CREATE_OPTION]
  const selected = value ? byId.get(value) : undefined

  function filter(key: string, query: string) {
    if (key === CREATE_OPTION || !query) {
      return true
    }
    const text = byId.get(key)?.text ?? ""
    return normalize(text).includes(normalize(query))
  }

  function handleValueChange(key: string | null) {
    if (key === CREATE_OPTION) {
      onCreate()
      return
    }
    if (key != null) {
      onChange(key)
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={error ? true : undefined}
    >
      <FieldLabel
        id={labelId}
        htmlFor={id}
        help={help}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <Combobox
        items={items}
        value={value}
        onValueChange={handleValueChange}
        filter={filter}
        itemToStringLabel={(key: string) =>
          key === CREATE_OPTION ? createLabel : (byId.get(key)?.text ?? "")
        }
        disabled={disabled}
      >
        <ComboboxTrigger
          render={
            <Button
              id={id}
              variant="ghost"
              aria-labelledby={`${labelId} ${valueId}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "w-full justify-between rounded-4xl border border-transparent bg-field px-4 font-normal hover:bg-field-hover aria-expanded:bg-field-hover aria-invalid:border-destructive",
                !selected && "text-muted-foreground"
              )}
            />
          }
        >
          <span
            id={valueId}
            className="flex min-w-0 items-center truncate"
          >
            {selected ? selected.node : placeholder}
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-64">
          <ComboboxInput
            showTrigger={false}
            placeholder="Buscar…"
            aria-label={searchLabel}
          />
          <ComboboxList>
            {(key: string) =>
              key === CREATE_OPTION ? (
                <CreateOption
                  key={key}
                  label={createLabel}
                />
              ) : (
                <ComboboxItem
                  key={key}
                  value={key}
                >
                  {byId.get(key)?.node}
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {children}
    </div>
  )
}
