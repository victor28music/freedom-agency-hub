"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function AcceptInvitePage() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Verifying your invitation…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMessage("This invitation link is invalid or has expired. Ask the agency owner for a new invitation."); return; }
      setReady(true);
      setMessage("");
    }
    establishSession();
  }, []);

  async function createPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password.length < 12) { setMessage("Use a password containing at least 12 characters."); setBusy(false); return; }
    if (password !== confirmation) { setMessage("The passwords do not match."); setBusy(false); return; }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMessage(error.message); setBusy(false); return; }
    await supabase.auth.signOut();
    window.location.assign("/login?invitation=accepted");
  }

  return <main className="login-page"><form className="login-card" onSubmit={createPassword}>
    <div className="logo">F</div><h1>Welcome to Freedom Agency Hub</h1><p>Create your private employee password.</p>
    {ready && <><label>New password<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label><label>Confirm password<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label></>}
    {message && <div className="form-error" role="alert">{message}</div>}
    {ready && <button className="gold" disabled={busy}>{busy ? "Saving…" : "Create password"}</button>}
  </form></main>;
}
