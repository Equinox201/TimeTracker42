import { useEffect, useRef, useState } from "react";

export function easeOutCubic(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - (1 - clamped) ** 3;
}

// Value shown `elapsedMs` into an animation from `from` to `to`. Lands exactly on `to`.
export function countUpValue(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return to;
  }
  return from + (to - from) * easeOutCubic(elapsedMs / durationMs);
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Animates a number towards `target` (from 0 on first render, then from wherever it is).
// Returns the target immediately when the user prefers reduced motion.
export function useCountUp(target: number, durationMs = 700): number {
  const reduced = prefersReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const current = useRef(value);

  useEffect(() => {
    if (reduced) {
      current.current = target;
      setValue(target);
      return undefined;
    }

    const from = current.current;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const next = countUpValue(from, target, now - startedAt, durationMs);
      current.current = next;
      setValue(next);
      if (now - startedAt < durationMs) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);

  return value;
}
