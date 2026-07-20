"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("access") === "inactive") setError("This employee account has been deactivated. Contact the agency owner.");
    if (params.get("invitation") === "accepted") setError("Password created successfully. Sign in with your employee email.");
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
  return <main className="login-page"><form className="login-card" onSubmit={signIn}>
    <div className="logo">F</div><h1>Freedom Agency Hub</h1><p>Authorized employees only</p>
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="gold" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
  </form></main>;
}
