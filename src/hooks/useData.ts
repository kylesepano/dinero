import { useState } from "react";
import type { AppData } from "../types";
import { loadData, STORAGE_KEY } from "../utils/storage";
export function useData() {
  const [initial] = useState(loadData);
  const [data, setData] = useState(initial.data);
  const [error, setError] = useState(initial.error);
  function update(next: AppData) {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError("");
    } catch {
      setError(
        "Changes are visible, but could not be saved. Browser storage may be full or disabled. Export a backup before leaving.",
      );
    }
  }
  return { data, update, error };
}
