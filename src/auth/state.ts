import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
export interface AuthState {
  session: Session | null;
  loading: boolean;
  signingOut: boolean;
  recovery: boolean;
  error: string;
  generation: number;
}
export const initialAuth: AuthState = {
  session: null,
  loading: true,
  signingOut: false,
  recovery: false,
  error: "",
  generation: 0,
};
export function authTransition(
  state: AuthState,
  event: AuthChangeEvent,
  session: Session | null,
): AuthState {
  const changed = state.session?.user.id !== session?.user.id;
  return {
    session,
    loading: false,
    signingOut: false,
    recovery:
      !!session &&
      (event === "PASSWORD_RECOVERY" || (!changed && state.recovery)),
    error: "",
    generation: state.generation + (changed ? 1 : 0),
  };
}
