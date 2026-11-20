import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Une clases condicionales y resuelve los choques de Tailwind (la última
// gana). Es el `cn` de los componentes de shadcn en `src/components/ui/`
// (SPEC 51).
// Si las clases nunca se pisan y el peso importa (landing), usa `cx`.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
