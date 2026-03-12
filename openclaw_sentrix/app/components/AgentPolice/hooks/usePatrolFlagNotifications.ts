"use client";

import { useEffect, useRef, useState } from "react";

export interface PatrolNotification {
  id: string;
  agentId: string;
  agentName?: string;
  message?: string;
  severity?: string;
  timestamp?: string;
}

const PAGE_LOAD_TIME = Date.now();

/**
 * Derives "current" notification from flags: detects new flags by comparing
 * current flag IDs to previously seen. Consumes policeState.flags (no API).
 */
export function usePatrolFlagNotifications(
  flags: Array<Record<string, unknown>>
): { notification: PatrolNotification | null; dismiss: () => void } {
  const seenIds = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<PatrolNotification[]>([]);
  const [current, setCurrent] = useState<PatrolNotification | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!Array.isArray(flags) || flags.length === 0) return;

    if (!isInitialized.current) {
      flags.forEach((f) => {
        const id = (f.flag_id as string) || (f.id as string) || "";
        if (!id) return;
        const ts = (f.timestamp as string) || "";
        const flagTime = ts ? new Date(ts).getTime() : 0;
        if (flagTime < PAGE_LOAD_TIME && flagTime > 0) {
          seenIds.current.add(id);
        }
      });
      isInitialized.current = true;
    }

    const newFlags = flags.filter((f) => {
      const id = (f.flag_id as string) || (f.id as string) || "";
      return id && !seenIds.current.has(id);
    });

    if (newFlags.length === 0) return;

    newFlags.forEach((f) => {
      const id = (f.flag_id as string) || (f.id as string) || "";
      if (id) seenIds.current.add(id);
    });

    const notifications: PatrolNotification[] = newFlags.map((f) => ({
      id: (f.flag_id as string) || (f.id as string) || `flag-${Date.now()}`,
      agentId: (f.target_agent_id as string) || (f.agentId as string) || "",
      agentName: (f.agent_name as string) || (f.agentName as string),
      message: (f.referral_summary as string) || (f.message as string) || "Patrol flag raised",
      severity: (f.severity as string) || (f.consensus_severity as string)?.toLowerCase() || "warning",
      timestamp: (f.timestamp as string) || new Date().toISOString(),
    }));

    setQueue((prev) => [...prev, ...notifications]);
  }, [flags]);

  useEffect(() => {
    if (current !== null) return;
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  const dismiss = () => setCurrent(null);

  return { notification: current, dismiss };
}
