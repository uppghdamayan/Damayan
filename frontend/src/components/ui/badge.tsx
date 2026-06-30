import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border bg-input/30 text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        draft: "bg-[var(--amber-bg)] text-[var(--amber)] border-[var(--amber-border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        active: "bg-accent-light/40 text-[var(--accent-hover)] border-[var(--accent)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        resolved: "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        critical: "bg-[var(--red-bg)] text-[var(--red)] border-[var(--red-border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        saved: "bg-green-bg/15 text-[var(--green)] border-[var(--green-border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        published: "bg-[var(--purple-bg)] text-[var(--purple)] border-[var(--purple-border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        info: "bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue-border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
        removed: "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] rounded-[4px] px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-[0.5px] border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
