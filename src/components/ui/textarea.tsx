import * as React from "react"
import { cn } from "@/libs/cn"

// Área de texto con el mismo relleno y foco que Input; radio de 20 px
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full resize-none rounded-[20px] border border-transparent bg-field px-4 py-3 text-base transition-colors outline-none placeholder:text-muted-foreground hover:bg-field-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
