import { useSyncExternalStore } from "react";
import { supabase } from "../lib/supabase";
import { authTransition, initialAuth, type AuthState } from "./state";
let state: AuthState = { ...initialAuth };
let locked = false;
const listeners = new Set<() => void>();
function publish(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}
const params = new URLSearchParams(window.location.hash.slice(1));
const callbackError =
  params.get("error_description") ||
  new URLSearchParams(window.location.search).get("error_description");
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (locked) return;
    const next = authTransition(state, event, session);
    if (
      session &&
      new URLSearchParams(window.location.search).get("auth") === "reset"
    )
      next.recovery = true;
    if (callbackError && !session) next.error = callbackError;
    publish(next);
  });
  void supabase.auth
    .getSession()
    .then(({ error }) => {
      if (error && !locked)
        publish({
          ...state,
          session: null,
          loading: false,
          error: error.message,
        });
    })
    .catch(() =>
      publish({
        ...state,
        session: null,
        loading: false,
        error: "Could not restore your session. Please sign in again.",
      }),
    );
} else state = { ...state, loading: false };
export function useAuth() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => state,
  );
}
export function allowSignIn() {
  locked = false;
  publish({ ...state, error: "" });
}
export function finishRecovery() {
  window.history.replaceState({}, "", window.location.pathname);
  publish({ ...state, recovery: false });
}
export async function signOut() {
  locked = true;
  publish({
    ...state,
    session: null,
    recovery: false,
    loading: false,
    error: "",
    generation: state.generation + 1,
    signingOut: true,
  });
  try {
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
    window.history.replaceState({}, "", window.location.pathname);
    publish({ ...state, signingOut: false });
  } catch {
    publish({
      ...state,
      signingOut: false,
      error:
        "This workspace is locked, but sign-out could not be completed. Retry sign out before leaving this shared device.",
    });
  }
}
