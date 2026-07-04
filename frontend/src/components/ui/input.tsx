import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-[34px] max-[1023px]:h-[38px] px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-border aria-invalid:focus:border-red-border aria-invalid:focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
