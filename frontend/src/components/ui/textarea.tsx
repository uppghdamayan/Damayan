import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full px-2.5 py-2 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none resize-y min-h-[80px] leading-[1.6] transition-all duration-150 focus:bg-surface focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-border aria-invalid:focus:border-red-border aria-invalid:focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
