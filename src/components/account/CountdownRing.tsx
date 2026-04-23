import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Props = {
  period: number;
  progress: number;
  danger?: boolean;
  className?: string;
};

export function CountdownRing({ period: _period, progress, danger = false, className }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div
      className={cn("countdown-ring", danger && "countdown-ring--danger", className)}
      style={{ "--ring-progress": `${clamped * 100}%` } as CSSProperties}
      aria-hidden
    />
  );
}
