import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
  size?: 'sm' | 'default'
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  size = 'default',
}: DatePickerWithRangeProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              size === 'sm'
                ? "h-8 text-[11px] w-[220px] px-3 gap-1.5"
                : "h-[34px] text-[13px] w-[240px] px-4",
              "justify-start text-left font-normal border-border rounded-btn bg-surface hover:bg-surface-2 text-text-secondary hover:text-text-primary cursor-pointer transition-all duration-150 outline-none focus:border-accent focus:shadow-accent-focus",
              !date && "text-text-muted"
            )}
          >
            <CalendarIcon className={cn(size === 'sm' ? "h-3.5 w-3.5" : "mr-2 h-4 w-4", "text-text-muted")} />
            {date?.from ? (
              date.to ? (
                <span className="text-text-primary">
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </span>
              ) : (
                <span className="text-text-primary">
                  {format(date.from, "LLL dd, y")}
                </span>
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-surface border border-border rounded-btn shadow-modal z-[50]" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            showOutsideDays={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
