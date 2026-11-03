import { cn } from "@heroui/react"
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import type { VerifyEntry } from "../queries"

type Tone = "income" | "expense" | "neutral"

const TONE_CLASS: Record<Tone, string> = {
  income: "text-(--income)",
  expense: "text-(--expense)",
  neutral: "text-muted"
}

const TONE_ICON = {
  income: ArrowUp,
  expense: ArrowDown,
  neutral: ArrowLeftRight
} as const

interface VerifyView {
  /** Texto accesible: la flecha no es el único portador del significado */
  label: string
  tone: Tone
  /** "+", "−" o "" cuando el monto no tiene signo */
  sign: string
  title: string
}

// Efecto de la fila sobre la cuenta, como lo ve el usuario en el extracto: el
// pago de tarjeta y el aporte a meta bajan (rojo), el avance sube (verde) y
// un retiro de meta entra a la cuenta (verde)
function describe(
  entry: VerifyEntry,
  selectedAccountId: string | null,
  accountName: (id: string | null) => string
): VerifyView {
  switch (entry.kind) {
    case "income":
      return {
        label: "Ingreso",
        tone: "income",
        sign: "+",
        title: entry.title
      }
    case "expense":
      return { label: "Gasto", tone: "expense", sign: "−", title: entry.title }
    case "transfer":
      return {
        label: "Traspaso",
        tone: "neutral",
        // Con una cuenta elegida, el signo es respecto de esa cuenta
        sign: selectedAccountId
          ? entry.account_id === selectedAccountId
            ? "−"
            : "+"
          : "",
        title: `${accountName(entry.account_id)} → ${accountName(entry.to_account_id)}`
      }
    case "adjustment":
      return {
        label: "Ajuste",
        tone: "neutral",
        sign: entry.amount > 0 ? "+" : "−",
        title: "Ajuste de saldo"
      }
    case "debt_payment":
      return {
        label: "Pago de tarjeta",
        tone: "expense",
        sign: "−",
        title: `Pago · ${entry.title}`
      }
    case "debt_advance":
      return {
        label: "Avance de tarjeta",
        tone: "income",
        sign: "+",
        title: `Avance · ${entry.title}`
      }
    default:
      return entry.amount < 0
        ? {
            label: "Retiro de meta",
            tone: "income",
            sign: "+",
            title: `Retiro · ${entry.title}`
          }
        : {
            label: "Aporte a meta",
            tone: "expense",
            sign: "−",
            title: `Aporte · ${entry.title}`
          }
  }
}

/** Fila compacta de solo lectura de Verificar movimientos: máximo dos líneas */
export function VerifyRow({
  entry,
  selectedAccountId,
  accountNames,
  currency
}: {
  entry: VerifyEntry
  /** Cuenta elegida en el selector, o null con "Todas" */
  selectedAccountId: string | null
  accountNames: Map<string, string>
  currency: string
}) {
  const accountName = (id: string | null) =>
    (id ? accountNames.get(id) : undefined) ?? "Sin cuenta"
  const view = describe(entry, selectedAccountId, accountName)
  const Icon = TONE_ICON[view.tone]
  const details = [
    formatDate(entry.occurred_on) +
      (entry.occurred_time ? ` · ${formatTime(entry.occurred_time)}` : ""),
    // El traspaso ya lleva Origen → Destino en el título
    entry.kind === "transfer" ? null : accountName(entry.account_id),
    entry.note
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-default",
          TONE_CLASS[view.tone]
        )}
      >
        <Icon
          aria-hidden="true"
          className="size-4"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium">
            <span className="sr-only">{view.label}: </span>
            {view.title}
          </span>
          <span
            className={cn(
              "shrink-0 text-sm font-medium tabular-nums",
              TONE_CLASS[view.tone]
            )}
          >
            {view.sign}
            {formatCurrency(Math.abs(entry.amount), currency)}
          </span>
        </p>
        <p className="truncate text-xs text-muted">{details}</p>
      </div>
    </li>
  )
}
