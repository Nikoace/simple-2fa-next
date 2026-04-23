import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DropdownCtx = createContext<Ctx | null>(null);

function useDropdownCtx() {
  const ctx = useContext(DropdownCtx);
  if (!ctx) {
    throw new Error("Dropdown components must be used inside DropdownMenu");
  }
  return ctx;
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <DropdownCtx.Provider value={value}>{children}</DropdownCtx.Provider>;
}

export function DropdownMenuTrigger({ children }: { asChild?: boolean; children: ReactNode }) {
  const { open, setOpen } = useDropdownCtx();

  return (
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  className,
  children,
}: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  const { open } = useDropdownCtx();
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute right-4 z-20 mt-2 min-w-36 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  children,
  onClick,
  ...props
}: HTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDropdownCtx();
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
