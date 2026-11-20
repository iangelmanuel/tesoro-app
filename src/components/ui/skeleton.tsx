import { cn } from "@/libs/cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-xl bg-subtle motion-safe:animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
