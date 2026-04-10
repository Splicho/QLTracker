"use client"

import type React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { Button as UiButton } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button, Input, Spinner, TextArea } from "@/components/pickup-admin-ui"

export function ActionButton({
  children,
  isDisabled,
  isPending,
  variant,
  onPress,
}: {
  children: React.ReactNode
  isDisabled?: boolean
  isPending: boolean
  variant: "primary" | "secondary" | "outline"
  onPress: () => void
}) {
  return (
    <Button
      isDisabled={isDisabled}
      isPending={isPending}
      onPress={onPress}
      variant={variant}
    >
      {({ isPending: buttonIsPending }) => (
        <>
          {buttonIsPending ? <Spinner color="current" size="sm" /> : null}
          {children}
        </>
      )}
    </Button>
  )
}

export function Field({
  children,
  className = "",
  description,
  label,
}: {
  children: React.ReactNode
  className?: string
  description?: string
  label: string
}) {
  return (
    <UiField className={cn("gap-2", className)}>
      <FieldContent>
        <FieldLabel className="text-white/70">{label}</FieldLabel>
        {description ? (
          <FieldDescription className="text-white/45">
            {description}
          </FieldDescription>
        ) : null}
      </FieldContent>
      {children}
    </UiField>
  )
}

export function FieldInput({
  disabled,
  min,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  disabled?: boolean
  min?: number
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      disabled={disabled}
      fullWidth
      min={min}
      placeholder={placeholder}
      type={type}
      variant="secondary"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function FieldTextArea({
  disabled,
  minRows = 4,
  placeholder,
  value,
  onChange,
}: {
  disabled?: boolean
  minRows?: number
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TextArea
      disabled={disabled}
      fullWidth
      placeholder={placeholder}
      rows={minRows}
      variant="secondary"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function parseDateTimeValue(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTimeValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function mergeDateAndTime(
  value: string,
  nextDate: Date | null,
  nextTime: string
) {
  const baseDate = nextDate ?? parseDateTimeValue(value) ?? new Date()
  const [hours, minutes] = nextTime.split(":").map((part) => Number(part))
  const mergedDate = new Date(baseDate)

  mergedDate.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  )

  return formatDateTimeValue(mergedDate)
}

export function FieldSelect<TValue extends string>({
  disabled,
  options,
  placeholder,
  value,
  onChange,
}: {
  disabled?: boolean
  options: Array<{ label: string; value: TValue }>
  placeholder?: string
  value: TValue
  onChange: (value: TValue) => void
}) {
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as TValue)}
    >
      <SelectTrigger className="!h-12 min-h-12 w-full rounded-2xl border-white/10 bg-transparent px-4 text-left text-sm text-white shadow-none">
        <SelectValue placeholder={placeholder ?? "Select option"} />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#111111] text-white">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              className="text-white focus:bg-white/10 focus:text-white"
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function FieldDateTimePicker({
  disabled,
  placeholder = "Select date and time",
  value,
  onChange,
}: {
  disabled?: boolean
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedDate = parseDateTimeValue(value)
  const timeValue = selectedDate ? format(selectedDate, "HH:mm") : "12:00"
  const triggerLabel = selectedDate
    ? format(selectedDate, "dd MMM yyyy, HH:mm")
    : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <UiButton
          className={cn(
            "!h-12 min-h-12 w-full justify-between rounded-2xl border border-white/10 bg-transparent px-4 text-left text-sm font-normal text-white shadow-none hover:bg-white/[0.04]",
            !selectedDate && "text-white/45"
          )}
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span>{triggerLabel}</span>
          <CalendarIcon className="size-4 text-white/45" />
        </UiButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-2xl border border-white/10 bg-[#111111] p-0 text-white"
      >
        <div className="flex flex-col gap-3 p-3">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(nextDate) => {
              if (!nextDate) {
                return
              }

              onChange(mergeDateAndTime(value, nextDate, timeValue))
            }}
          />
          <Input
            className="h-11 border-white/10 bg-transparent text-white"
            disabled={disabled || !selectedDate}
            fullWidth
            type="time"
            value={timeValue}
            variant="secondary"
            onChange={(event) =>
              onChange(
                mergeDateAndTime(value, selectedDate, event.target.value)
              )
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
