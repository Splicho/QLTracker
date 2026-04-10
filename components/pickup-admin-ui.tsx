"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button as UiButton } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter as UiDialogFooter,
  DialogHeader as UiDialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input as UiInput } from "@/components/ui/input";
import { Spinner as UiSpinner } from "@/components/ui/spinner";
import { Switch as UiSwitch } from "@/components/ui/switch";
import {
  Tabs as UiTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea as UiTextarea } from "@/components/ui/textarea";

type AdminButtonVariant = "primary" | "secondary" | "outline" | "danger";
type AdminButtonSize = "sm" | "md" | "lg";
type ButtonRenderState = {
  isPending: boolean;
};

type OverlayState = {
  close: () => void;
  isOpen: boolean;
  open: () => void;
  setOpen: (open: boolean) => void;
};

const AdminModalSizeContext = React.createContext<"md" | "lg" | "full">("md");
const AdminSwitchContext = React.createContext<{
  isDisabled: boolean;
  isSelected: boolean;
  onChange?: (value: boolean) => void;
  size: "sm" | "default";
} | null>(null);

function mapButtonVariant(variant: AdminButtonVariant) {
  switch (variant) {
    case "secondary":
      return "secondary";
    case "outline":
      return "outline";
    case "danger":
      return "destructive";
    default:
      return "default";
  }
}

function mapButtonSize(size: AdminButtonSize) {
  switch (size) {
    case "sm":
      return "sm";
    case "lg":
      return "lg";
    default:
      return "default";
  }
}

function getModalSizeClass(size: "md" | "lg" | "full") {
  switch (size) {
    case "full":
      return "max-h-[calc(100vh-2rem)] sm:max-w-[min(96rem,calc(100vw-2rem))]";
    case "lg":
      return "sm:max-w-3xl";
    default:
      return "sm:max-w-lg";
  }
}

function Button({
  children,
  className,
  isDisabled,
  isPending = false,
  onPress,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: Omit<React.ComponentProps<typeof UiButton>, "children" | "onClick" | "size" | "variant"> & {
  children: React.ReactNode | ((state: ButtonRenderState) => React.ReactNode);
  isDisabled?: boolean;
  isPending?: boolean;
  onPress?: () => void;
  size?: AdminButtonSize;
  variant?: AdminButtonVariant;
}) {
  const content =
    typeof children === "function" ? children({ isPending }) : children;

  return (
    <UiButton
      className={className}
      disabled={isDisabled || isPending || props.disabled}
      onClick={onPress}
      size={mapButtonSize(size)}
      type={type}
      variant={mapButtonVariant(variant)}
      {...props}
    >
      {content}
    </UiButton>
  );
}

function Input({
  className,
  fullWidth,
  variant: _variant,
  ...props
}: React.ComponentProps<typeof UiInput> & {
  fullWidth?: boolean;
  variant?: string;
}) {
  return (
    <UiInput
      className={cn(fullWidth && "w-full", className)}
      {...props}
    />
  );
}

function TextArea({
  className,
  fullWidth,
  rows,
  variant: _variant,
  ...props
}: React.ComponentProps<typeof UiTextarea> & {
  fullWidth?: boolean;
  variant?: string;
}) {
  return (
    <UiTextarea
      className={cn(fullWidth && "w-full", className)}
      rows={rows}
      {...props}
    />
  );
}

function Spinner({
  className,
  color: _color,
  size = "md",
  ...props
}: React.ComponentProps<typeof UiSpinner> & {
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <UiSpinner
      className={cn(
        size === "lg" ? "size-6 animate-spin" : "size-4 animate-spin",
        className,
      )}
      {...props}
    />
  );
}

function Chip({
  children,
  className,
  color = "default",
  variant: _variant,
}: {
  children: React.ReactNode;
  className?: string;
  color?: "accent" | "default" | "success" | "warning";
  variant?: string;
}) {
  const toneClassName =
    color === "accent"
      ? "border-primary/30 bg-primary/10 text-primary"
      : color === "success"
        ? "border-success/30 bg-success/15 text-success"
        : color === "warning"
          ? "border-warning/30 bg-warning/15 text-warning-foreground"
          : "border-border bg-secondary text-secondary-foreground";

  return (
    <Badge
      className={cn("rounded-full border px-2 py-0.5 font-medium capitalize", toneClassName, className)}
      variant="outline"
    >
      {children}
    </Badge>
  );
}

function useOverlayState(initialOpen = false): OverlayState {
  const [isOpen, setOpen] = React.useState(initialOpen);

  return React.useMemo(
    () => ({
      close: () => setOpen(false),
      isOpen,
      open: () => setOpen(true),
      setOpen,
    }),
    [isOpen],
  );
}

function Modal({
  children,
  state,
}: {
  children: React.ReactNode;
  state: OverlayState;
}) {
  return (
    <Dialog open={state.isOpen} onOpenChange={state.setOpen}>
      {children}
    </Dialog>
  );
}

Modal.Trigger = function AdminModalTrigger({
  children,
}: {
  children: React.ReactElement;
}) {
  return <DialogTrigger asChild>{children}</DialogTrigger>;
};

Modal.Backdrop = function AdminModalBackdrop({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
};

Modal.Container = function AdminModalContainer({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  placement?: string;
  size?: "md" | "lg" | "full";
}) {
  return (
    <AdminModalSizeContext.Provider value={size}>
      {children}
    </AdminModalSizeContext.Provider>
  );
};

Modal.Dialog = function AdminModalDialog({
  children,
  className,
}: React.ComponentProps<"div">) {
  const size = React.useContext(AdminModalSizeContext);

  return (
    <DialogContent
      className={cn(
        "gap-0 overflow-hidden border-border/60 bg-background p-0 text-foreground",
        getModalSizeClass(size),
        className,
      )}
      showCloseButton={false}
    >
      {children}
    </DialogContent>
  );
};

Modal.Header = function AdminModalHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UiDialogHeader
      className={cn("gap-1 border-b px-6 py-4 text-left", className)}
      {...props}
    >
      {children}
    </UiDialogHeader>
  );
};

Modal.Heading = function AdminModalHeading({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("text-xl font-medium", className)} {...props} />;
};

Modal.Body = function AdminModalBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
};

Modal.Footer = function AdminModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UiDialogFooter
      className={cn("border-t px-6 py-4", className)}
      {...props}
    />
  );
};

Modal.CloseTrigger = function AdminModalCloseTrigger() {
  return (
    <DialogClose asChild>
      <UiButton className="absolute top-4 right-4 size-8" size="icon" variant="ghost">
        <XIcon />
        <span className="sr-only">Close</span>
      </UiButton>
    </DialogClose>
  );
};

type TabsRootProps = {
  children: React.ReactNode;
  className?: string;
  onSelectionChange?: (key: string) => void;
  selectedKey: string;
  variant?: string;
};

function Tabs({
  children,
  className,
  onSelectionChange,
  selectedKey,
}: TabsRootProps) {
  return (
    <UiTabs
      className={className}
      onValueChange={onSelectionChange}
      value={selectedKey}
    >
      {children}
    </UiTabs>
  );
}

Tabs.ListContainer = function AdminTabsListContainer({
  children,
  className,
}: React.ComponentProps<"div">) {
  return <div className={className}>{children}</div>;
};

Tabs.List = function AdminTabsList({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn("h-auto gap-1 bg-transparent p-0", className)}
      variant="line"
      {...props}
    >
      {children}
    </TabsList>
  );
};

Tabs.Tab = function AdminTabsTab({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <TabsTrigger
      className={cn(
        "h-10 rounded-none px-3 text-sm font-medium after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]",
        className,
      )}
      value={id}
    >
      {children}
    </TabsTrigger>
  );
};

Tabs.Indicator = function AdminTabsIndicator() {
  return null;
};

Tabs.Panel = function AdminTabsPanel({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <TabsContent className={className} value={id}>
      {children}
    </TabsContent>
  );
};

function Switch({
  children,
  isDisabled = false,
  isSelected,
  onChange,
  size = "default",
}: {
  children: React.ReactNode;
  isDisabled?: boolean;
  isSelected: boolean;
  onChange?: (value: boolean) => void;
  size?: "default" | "sm";
}) {
  return (
    <AdminSwitchContext.Provider value={{ isDisabled, isSelected, onChange, size }}>
      <div className="flex items-center gap-3">{children}</div>
    </AdminSwitchContext.Provider>
  );
}

Switch.Control = function AdminSwitchControl({
  children: _children,
}: {
  children?: React.ReactNode;
}) {
  const context = React.useContext(AdminSwitchContext);

  if (!context) {
    throw new Error("Switch.Control must be used inside Switch.");
  }

  return (
    <UiSwitch
      checked={context.isSelected}
      disabled={context.isDisabled}
      onCheckedChange={context.onChange}
      size={context.size}
    />
  );
};

Switch.Thumb = function AdminSwitchThumb() {
  return null;
};

Switch.Content = function AdminSwitchContent({
  children,
  className,
}: React.ComponentProps<"span">) {
  return <span className={cn("text-sm text-foreground", className)}>{children}</span>;
};

const toast = {
  danger(title: string, options?: { description?: string }) {
    sonnerToast.error(title, {
      description: options?.description,
    });
  },
  success(title: string, options?: { description?: string }) {
    sonnerToast.success(title, {
      description: options?.description,
    });
  },
};

export {
  Button,
  Chip,
  Input,
  Modal,
  Spinner,
  Switch,
  Tabs,
  TextArea,
  toast,
  useOverlayState,
};
