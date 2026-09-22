"use client";

import { useEffect, useRef, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Terminé";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Live countdown to `readyAt` (ms epoch). Calls `onReady` once when it elapses. */
export function Countdown({ readyAt, onReady }: { readyAt: number; onReady?: () => void }) {
  const [remaining, setRemaining] = useState(() => readyAt - Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = readyAt - Date.now();
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        onReady?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [readyAt, onReady]);

  return <span>{formatRemaining(remaining)}</span>;
}
