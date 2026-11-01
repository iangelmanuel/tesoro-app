import { FieldError, Input, Label, TextField } from "@heroui/react"

interface FormFieldProps {
  name: string
  label: string
  /** Errores de Zod del campo; se muestra el primero */
  errors?: string[]
  type?: "text" | "email" | "password"
  autoComplete?: string
  placeholder?: string
  defaultValue?: string
  maxLength?: number
  required?: boolean
}

// Campo de texto de HeroUI para formularios con useActionState. La
// validación es del servidor (Zod): `aria` evita la validación nativa del
// navegador y el error llega por `errors`
export function FormField({
  name,
  label,
  errors,
  type = "text",
  autoComplete,
  placeholder,
  defaultValue,
  maxLength,
  required
}: FormFieldProps) {
  const error = errors?.[0]

  return (
    <TextField
      name={name}
      type={type}
      autoComplete={autoComplete}
      defaultValue={defaultValue}
      maxLength={maxLength}
      isRequired={required}
      isInvalid={Boolean(error)}
      validationBehavior="aria"
      className="flex flex-col gap-2"
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
      <FieldError>{error}</FieldError>
    </TextField>
  )
}
