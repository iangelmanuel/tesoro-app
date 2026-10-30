import { Hourglass } from "lucide-react"

/** "Sin datos suficientes" con cada motivo que falta */
export function ScoreInsufficient({ reasons }: { reasons: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <div className="flex items-center gap-2">
        <Hourglass className="size-4 text-muted-foreground" />
        <p className="font-medium">Sin datos suficientes</p>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-6 text-sm text-muted-foreground">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}
