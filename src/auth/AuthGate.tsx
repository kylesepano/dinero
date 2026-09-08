import { useRef, useState, type FormEvent } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { supabase, configurationError, authRedirect } from "../lib/supabase";
import { allowSignIn, finishRecovery, signOut, useAuth } from "./store";
import App from "../App";
export default function AuthGate() {
  const auth = useAuth();
  if (configurationError)
    return (
      <AuthFrame>
        <h1>Connect your dinero workspace</h1>
        <p>{configurationError}</p>
        <p>
          Your existing local backup has been preserved. See the Supabase setup
          instructions in the project README.
        </p>
      </AuthFrame>
    );
  if (auth.signingOut)
    return (
      <AuthFrame>
        <p role="status">Signing out...</p>
      </AuthFrame>
    );
  if (auth.error.includes("sign-out"))
    return (
      <AuthFrame>
        <h1>Workspace locked</h1>
        <p role="alert">{auth.error}</p>
        <button
          className="button secondary"
          onClick={() => {
            void signOut();
          }}
        >
          Retry sign out
        </button>
      </AuthFrame>
    );
  if (auth.loading)
    return (
      <AuthFrame>
        <p role="status">Restoring your session...</p>
      </AuthFrame>
    );
  if (auth.session && !auth.recovery)
    return (
      <App
        key={`${auth.session.user.id}:${auth.generation}`}
        ownerId={auth.session.user.id}
        email={auth.session.user.email || "Your account"}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  return (
    <AuthForm
      key={auth.recovery ? "reset" : "signin"}
      recovery={auth.recovery}
      sessionAvailable={!!auth.session}
      authError={auth.error}
    />
  );
}
function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="brand">
          <span className="brand-mark">
            <ChartNoAxesCombined size={24} />
          </span>
          dinero<span className="brand-dot">.</span>
        </div>
        {children}
      </section>
    </div>
  );
}
function AuthForm({
  recovery,
  sessionAvailable,
  authError,
}: {
  recovery: boolean;
  sessionAvailable: boolean;
  authError: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(
    recovery ? "reset" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function switchMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current || !supabase) return;
    setError("");
    setMessage("");
    if ((mode === "signup" || mode === "reset") && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (mode === "signin") {
        allowSignIn();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      if (mode === "signup") {
        allowSignIn();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirect() },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Check your email to confirm your account, then sign in. If you already have an account, sign in or reset your password.",
          );
      }
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: authRedirect(true) },
        );
        if (error) throw error;
        setMessage(
          "If an account exists for this email, a password reset link has been sent. Open the latest link to continue.",
        );
      }
      if (mode === "reset") {
        if (!sessionAvailable)
          throw new Error("This reset link has expired. Request a new one.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        finishRecovery();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setPassword("");
      setConfirm("");
    }
  }
  async function resend() {
    if (!supabase || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: authRedirect() },
      });
      if (error) throw error;
      setMessage("Confirmation email requested. Check your inbox.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not resend confirmation.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <h1>
        {mode === "signin"
          ? "Welcome back."
          : mode === "signup"
            ? "Your money, your space."
            : mode === "forgot"
              ? "Forgot your password?"
              : "Choose a new password."}
      </h1>
      <p>
        {mode === "signin"
          ? "Sign in to your private cloud workspace."
          : mode === "signup"
            ? "Create an account to keep your records together across devices."
            : mode === "forgot"
              ? "We'll send you a link to reset it."
              : "Use at least 8 characters for your new password."}
      </p>
      {authError && (
        <p role="alert" className="form-error">
          {authError}
        </p>
      )}
      {authError.includes("sign-out") && (
        <button
          className="button secondary"
          onClick={() => {
            void signOut();
          }}
        >
          Retry sign out
        </button>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {mode !== "reset" && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={mode === "signin" ? undefined : 8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {(mode === "signup" || mode === "reset") && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <button className="button primary auth-submit">
            {busy
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Update password"}
          </button>
        </fieldset>
      </form>
      <div className="auth-links">
        {mode === "signin" ? (
          <>
            <button className="text-link" onClick={() => switchMode("forgot")}>
              Forgot password?
            </button>
            <button className="text-link" onClick={() => switchMode("signup")}>
              Create an account
            </button>
          </>
        ) : mode === "reset" ? (
          <button
            className="text-link"
            onClick={() => {
              void signOut();
            }}
          >
            Cancel and sign out
          </button>
        ) : (
          <button className="text-link" onClick={() => switchMode("signin")}>
            Back to sign in
          </button>
        )}
        {mode === "signup" && message && (
          <button
            disabled={busy || !email}
            className="text-link"
            onClick={() => {
              void resend();
            }}
          >
            Resend confirmation email
          </button>
        )}
      </div>
    </AuthFrame>
  );
}
