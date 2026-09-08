import { useEffect, useRef, useState } from "react";
import type { AppData } from "../types";
import { freshData } from "../data/defaults";
import { supabase } from "../lib/supabase";
import { createWorkspaceRepository } from "../services/workspace";
import {
  cloudError,
  prepareImport,
  type CloudSnapshot,
} from "../services/mapping";
export function useData(ownerId: string) {
  const [repository] = useState(() =>
    supabase ? createWorkspaceRepository(supabase, ownerId) : null,
  );
  const [snapshot, setSnapshot] = useState<CloudSnapshot>({
    data: { ...freshData(), categories: [] },
    revision: 0,
    imports: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  const busy = useRef(false);
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!repository) throw new Error("Supabase is not configured.");
        let next = await repository.load();
        if (cancelled) return;
        if (next.revision === 0) {
          if (
            next.data.categories.length ||
            next.data.transactions.length ||
            next.data.budgets.length
          )
            throw new Error(
              "Cloud records exist without workspace settings. Restore settings before continuing; these records have not been overwritten.",
            );
          try {
            next = await repository.save(prepareImport(freshData()), 0);
          } catch {
            next = await repository.load();
            if (next.revision === 0)
              throw new Error(
                "Could not initialize your workspace. Check the database migrations and retry.",
              );
          }
        }
        if (!cancelled) setSnapshot(next);
      } catch (e) {
        if (!cancelled) setError(cloudError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [attempt, repository]);
  async function update(
    next: AppData,
    importHash: string | null = null,
  ): Promise<boolean> {
    if (busy.current || loading || !active.current) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (!repository) throw new Error("Supabase is not configured.");
      const saved = await repository.save(next, snapshot.revision, importHash);
      if (!active.current) return false;
      setSnapshot(saved);
      return true;
    } catch (e) {
      if (active.current) setError(cloudError(e));
      return false;
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  }
  return {
    data: snapshot.data,
    imports: snapshot.imports,
    update,
    error,
    loading,
    saving,
    ready: snapshot.revision > 0,
    retry: () => setAttempt((a) => a + 1),
  };
}
