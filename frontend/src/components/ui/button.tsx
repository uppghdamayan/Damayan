import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-btn border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-border aria-invalid:ring-[3px] aria-invalid:ring-red-border/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[14px]",
  {
    variants: {
      variant: {
        default: "bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover",
        outline:
          "bg-surface-2 text-[var(--text-secondary)] border border-border hover:bg-surface-3 hover:text-[var(--text-primary)] hover:border-border-strong",
        secondary:
          "bg-surface-2 text-[var(--text-secondary)] border border-border hover:bg-surface-3 hover:text-[var(--text-primary)] hover:border-border-strong",
        ghost:
          "bg-transparent border-transparent hover:bg-surface-2 hover:border-border",
        destructive:
          "bg-red-bg text-red border border-red-border hover:bg-red/15 hover:border-red/80",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[28px] gap-[5px] px-3 text-[11px]",
        xs: "h-6 gap-1 px-2 text-[10px]",
        sm: "h-[28px] gap-[5px] px-3 text-[11px]",
        lg: "h-10 gap-1.5 px-4 text-sm",
        icon: "size-8 px-0",
        "icon-xs": "size-6 px-0",
        "icon-sm": "size-[28px] px-0",
        "icon-lg": "size-10 px-0",
        "icon-tb": "size-[34px] px-0",
        tbar: "h-[34px] gap-[5px] px-3.5 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
