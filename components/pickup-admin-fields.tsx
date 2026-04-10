"use client";

import type React from "react";
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Spinner,
  TextArea,
} from "@/components/pickup-admin-ui";

export function ActionButton({
  children,
  isDisabled,
  isPending,
  variant,
  onPress,
}: {
  children: React.ReactNode;
  isDisabled?: boolean;
  isPending: boolean;
  variant: "primary" | "secondary" | "outline";
  onPress: () => void;
}) {
  return (
    <Button isDisabled={isDisabled} isPending={isPending} onPress={onPress} variant={variant}>
      {({ isPending: buttonIsPending }) => (
        <>
          {buttonIsPending ? <Spinner color="current" size="sm" /> : null}
          {children}
        </>
      )}
    </Button>
  );
}

export function Field({
  children,
  className = "",
  description,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  label: string;
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
  );
}

export function FieldInput({
  disabled,
  min,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  disabled?: boolean;
  min?: number;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
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
  );
}

export function FieldTextArea({
  disabled,
  minRows = 4,
  placeholder,
  value,
  onChange,
}: {
  disabled?: boolean;
  minRows?: number;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
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
  );
}
