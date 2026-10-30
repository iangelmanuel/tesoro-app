import { InactiveDebts, type InactiveDebtsProps } from "./inactive-debts"

/** Sección plegable "Cobradas y archivadas", cerrada por defecto */
export function InactiveReceivables(props: Omit<InactiveDebtsProps, "title">) {
  return (
    <InactiveDebts
      {...props}
      title="Cobradas y archivadas"
    />
  )
}
