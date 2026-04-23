import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Props = {
  period: number;
  progress: number;
  danger?: boolean;
  className?: string;
};

export function CountdownRing({ period: _period, progress, danger = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    ref.current?.style.setProperty("--ring-progress", `${clamped * 100}%`);
  }, [clamped]);

  return (
    <div
      ref={ref}
      className={cn("countdown-ring", danger && "countdown-ring--danger", className)}
      style={{ "--ring-progress": `${clamped * 100}%` } as CSSProperties}
      aria-hidden
    />
  );
}
