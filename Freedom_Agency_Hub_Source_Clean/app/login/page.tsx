"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("access") === "inactive") setError("This employee account has been deactivated. Contact the agency owner.");
    if (params.get("invitation") === "accepted") setError("Password created successfully. Sign in with your employee email.");
    if (params.get("reset") === "complete") setError("Password updated successfully. Sign in with your new password.");
  }, []);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")), password: String(form.get("password")),
    });
    if (error) { setError("The email or password is incorrect."); setBusy(false); return; }
    window.location.assign("/");
  }

  async function sendRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setError("If that employee email exists, a password-reset link has been sent.");
    setBusy(false);
  }

  return <main className="login-page">
    {!recovering ? <form className="login-card" onSubmit={signIn}>
      <div className="logo">F</div><h1>Freedom Agency Hub</h1><p>Authorized employees only</p>
      <label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <div className="form-error" role="status">{error}</div>}
      <button className="gold" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="logout" onClick={() => { setRecovering(true); setError(""); }}>Forgot password?</button>
    </form> : <form className="login-card" onSubmit={sendRecovery}>
      <div className="logo">F</div><h1>Reset password</h1><p>Enter your employee email address.</p>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      {error && <div className="form-error" role="status">{error}</div>}
      <button className="gold" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      <button type="button" className="logout" onClick={() => { setRecovering(false); setError(""); }}>Back to sign in</button>
    </form>}
  </main>;
}
