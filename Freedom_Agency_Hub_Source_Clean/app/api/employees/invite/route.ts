import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const allowedRoles = new Set(["manager", "agent", "csr", "accounting"]);

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publishableKey || !secretKey) {
      return NextResponse.json({ error: "The invitation service is not configured." }, { status: 500 });
    }

    const authClient = createClient(url, publishableKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "Your session is invalid." }, { status: 401 });

    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: owner } = await admin.from("profiles")
      .select("agency_id,role,active")
      .eq("id", user.id)
      .single();
    if (!owner || owner.role !== "owner" || !owner.active || !owner.agency_id) {
      return NextResponse.json({ error: "Only an active agency owner can invite employees." }, { status: 403 });
    }

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "agent");
    if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || !allowedRoles.has(role)) {
      return NextResponse.json({ error: "Enter a valid name, email, and employee role." }, { status: 400 });
    }

    const redirectTo = `${request.nextUrl.origin}/accept-invite`;
    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName, agency_id: owner.agency_id, role },
    });
    if (inviteError || !invitation.user) {
      return NextResponse.json({ error: inviteError?.message || "The invitation could not be created." }, { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invitation.user.id,
      agency_id: owner.agency_id,
      full_name: fullName,
      email,
      role,
      active: true,
      invited_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      return NextResponse.json({ error: "The employee profile could not be created." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "The invitation request could not be completed." }, { status: 500 });
  }
}
