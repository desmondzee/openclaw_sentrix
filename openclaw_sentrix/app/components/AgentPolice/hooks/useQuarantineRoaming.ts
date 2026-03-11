"use client";

import { useState, useRef, useEffect } from "react";

/** No-op for openclaw: no prison. Returns (x, y) unchanged. */
export function useQuarantineRoaming(
  _isSuspended: boolean,
  x: number,
  y: number
): { x: number; y: number } {
  const [pos] = useState(() => ({ x, y }));
  const ref = useRef({ x, y });
  useEffect(() => {
    ref.current = { x, y };
  }, [x, y]);
  return ref.current;
}
