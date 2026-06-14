import * as React from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  collapsed?: boolean
  size?: "sm" | "md" | "lg" | "xl"
}

export function Logo({ className, collapsed = false, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  }

  return (
    <div className={cn("font-bold tracking-tight select-none leading-none", className)}>
      {collapsed ? (
        <span className={cn(
          "bg-clip-text text-transparent bg-gradient-to-tr from-primary to-indigo-600 dark:from-indigo-400 dark:to-cyan-400 font-extrabold",
          sizeClasses[size]
        )}>
          O
        </span>
      ) : (
        <span className={cn(
          "bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 dark:from-foreground dark:to-foreground/70",
          sizeClasses[size]
        )}>
          Orbiter
        </span>
      )}
    </div>
  )
}
