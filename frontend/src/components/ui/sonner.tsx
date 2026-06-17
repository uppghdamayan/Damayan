"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, InformationCircleIcon, Alert02Icon, MultiplicationSignCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2.5} className="size-5 text-[var(--accent-hover)]" />
        ),
        info: (
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2.5} className="size-5 text-[var(--blue)]" />
        ),
        warning: (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2.5} className="size-5 text-[var(--amber)]" />
        ),
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2.5} className="size-5 text-[var(--red)]" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2.5} className="size-5 text-[var(--accent-hover)] animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-surface group-[.toaster]:text-text-primary group-[.toaster]:border-border group-[.toaster]:shadow-card rounded-card border p-4 flex gap-3 items-center w-full font-sans " +
            "data-[type=success]:border-[var(--accent-mid)]! data-[type=success]:bg-[var(--accent-light)]! data-[type=success]:text-[var(--accent-hover)]! " +
            "data-[type=error]:border-[var(--red-border)]! data-[type=error]:bg-[var(--red-bg)]! data-[type=error]:text-[var(--red)]! " +
            "data-[type=warning]:border-[var(--amber-border)]! data-[type=warning]:bg-[var(--amber-bg)]! data-[type=warning]:text-[var(--amber)]! " +
            "data-[type=info]:border-[var(--blue-border)]! data-[type=info]:bg-[var(--blue-bg)]! data-[type=info]:text-[var(--blue)]!",
          title: "text-inherit font-semibold text-[13px]",
          description: "text-inherit opacity-90 text-[12px]",
          actionButton: "bg-primary text-primary-foreground font-medium text-[12px] rounded-btn px-3 py-1",
          cancelButton: "bg-muted text-muted-foreground font-medium text-[12px] rounded-btn px-3 py-1",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
