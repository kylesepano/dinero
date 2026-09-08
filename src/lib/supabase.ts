import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const validUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname;
  } catch {
    return false;
  }
};
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configurationError =
  !url || !key
    ? "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local (or Vercel), then restart or rebuild dinero."
    : !validUrl(url) || !key.startsWith("sb_publishable_")
      ? "Use a valid Supabase Project URL and an sb_publishable_ key. Secret and service-role keys must never be used in the frontend."
      : "";
export const supabase = configurationError
  ? null
  : createClient(url!, key!, {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
              : AbortSignal.timeout(30000),
          }),
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
export const authRedirect = (reset = false) =>
  `${window.location.origin}/?auth=${reset ? "reset" : "confirm"}`;
