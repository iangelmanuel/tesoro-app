import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FormFieldProps extends React.ComponentProps<typeof Input> {
  name: string
  label: string
  errors?: string[]
}

export function FormField({ name, label, errors, ...props }: FormFieldProps) {
  const errorId = `${name}-error`
  const hasError = Boolean(errors?.length)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...props}
      />
      {hasError && (
        <p
          id={errorId}
          className="text-sm text-destructive"
        >
          {errors?.[0]}
        </p>
      )}
    </div>
  )
}
