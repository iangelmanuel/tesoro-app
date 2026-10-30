import { Suspense } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GoalCard } from "@/features/goals/components/goal-card"
import { GoalDialog } from "@/features/goals/components/goal-dialog"
import { InactiveGoals } from "@/features/goals/components/inactive-goals"
import { GOALS_PATH, compareByTargetDate } from "@/features/goals/progress"
import { getGoals } from "@/features/goals/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Metas",
  path: GOALS_PATH,
  noindex: true
})

export default function GoalsPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Metas de ahorro
        </h1>
        <p className="text-sm text-muted-foreground">
          Aparta dinero para lo que viene y sigue tu avance.
        </p>
      </header>
      {/* La sesión es dinámica: va dentro de Suspense */}
      <Suspense fallback={<GoalsSkeleton />}>
        <GoalsContent />
      </Suspense>
    </section>
  )
}

async function GoalsContent() {
  const workspace = await getPersonalWorkspace()
  const goals = await getGoals(workspace.id)
  // Tras leer la sesión: todayISO usa new Date()
  const today = todayISO()

  const active = goals
    .filter((goal) => goal.status === "active")
    .sort(compareByTargetDate)
  const inactive = goals.filter((goal) => goal.status !== "active")

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <GoalDialog
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Nueva meta
            </Button>
          }
        />
      </div>

      {active.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {active.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              today={today}
              currency={workspace.currency}
            />
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <InactiveGoals
          goals={inactive}
          currency={workspace.currency}
        />
      )}
    </>
  )
}

function GoalsSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-32" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </>
  )
}
