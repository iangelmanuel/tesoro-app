import { cn } from "@heroui/react"
import {
  AI_CLIENT_NAMES,
  type AiClient,
  AiLogo
} from "@/components/brand/ai-logos"

interface AgentClientsProps {
  clients: readonly AiClient[]
  className?: string
}

// Fila de clientes MCP compatibles: logo en un color y nombre, más "y otros"
// para dejar claro que la lista no es cerrada
export function AgentClients({ clients, className }: AgentClientsProps) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-7 gap-y-4 text-base font-medium",
        className
      )}
    >
      {clients.map((client) => (
        <li
          key={client}
          className="flex items-center gap-2.5"
        >
          <AiLogo client={client} />
          {AI_CLIENT_NAMES[client]}
        </li>
      ))}
      <li className="text-sm font-normal text-muted">y otros clientes MCP</li>
    </ul>
  )
}
