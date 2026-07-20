"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  phone: string;
  carrier: string;
  status: "Active" | "Quoted" | "Cancel Notice" | "New";
};

type AgencyDocument = {
  id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  customers: { full_name: string } | null;
};

type Quote = {
  id: string;
  carrier: string;
  quote_number: string | null;
  coverage_summary: string;
  down_payment: number;
  monthly_payment: number;
  term_months: number;
  valid_until: string | null;
  status: "draft" | "presented" | "accepted" | "declined" | "expired";
  customers: { full_name: string } | null;
};

type Policy = {
  id: string;
  carrier: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  monthly_premium: number | null;
  down_payment: number | null;
  payment_due_day: number | null;
  coverage_summary: string | null;
  status: string;
  customers: { full_name: string } | null;
};

type Payment = {
  id: string;
  receipt_number: string | null;
  amount: number;
  agency_fee: number;
  carrier_payment: number;
  method: string | null;
  notes: string | null;
  status: "posted" | "voided";
  created_at: string;
  customers: { full_name: string } | null;
};

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  active: boolean;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "completed" | "canceled";
  due_at: string | null;
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  customers: { full_name: string } | null;
  assignee: { full_name: string | null } | null;
};

type DashboardStats = {
  newCustomers: number;
  openQuotes: number;
  renewalsDue: number;
  collectedToday: number;
};

export default function Home() {
  const [section, setSection] = useState("Dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [userRole, setUserRole] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyMessage, setPolicyMessage] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [taskMessage, setTaskMessage] = useState("");
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ newCustomers: 0, openQuotes: 0, renewalsDue: 0, collectedToday: 0 });
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  const filtered = useMemo(
    () => customers.filter(c => `${c.name} ${c.phone} ${c.carrier}`.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role,active").eq("id", user.id).single();
      if (!data || !data.active) {
        await supabase.auth.signOut();
        window.location.assign("/login?access=inactive");
        return;
      }
      setUserRole(data.role ?? "");
    });
    supabase.from("customers").select("id,full_name,phone,policies(carrier,status)").order("created_at", { ascending: false }).then(({ data }) => {
      setCustomers((data ?? []).map((row: any) => ({
        id: row.id, name: row.full_name, phone: row.phone ?? "", carrier: row.policies?.[0]?.carrier ?? "—",
        status: row.policies?.[0]?.status === "active" ? "Active" : "New",
      })));
    });
  }, []);

  useEffect(() => {
    if (section !== "Documents") return;
    createClient().from("documents")
      .select("id,original_filename,storage_path,mime_type,file_size,created_at,customers(full_name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocuments((data ?? []) as unknown as AgencyDocument[]));
  }, [section]);

  useEffect(() => {
    if (section !== "Dashboard") return;
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      supabase.from("quotes").select("id", { count: "exact", head: true }).in("status", ["draft", "presented"]),
      supabase.from("policies").select("id", { count: "exact", head: true }).eq("status", "active").gte("expiration_date", today.toISOString().slice(0,10)).lte("expiration_date", inThirtyDays.toISOString().slice(0,10)),
      supabase.from("payments").select("amount").eq("status", "posted").gte("created_at", today.toISOString()),
    ]).then(([customersResult, quotesResult, policiesResult, paymentsResult]) => {
      setDashboardStats({
        newCustomers: customersResult.count ?? 0,
        openQuotes: quotesResult.count ?? 0,
        renewalsDue: policiesResult.count ?? 0,
        collectedToday: (paymentsResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
      });
      setDashboardLoaded(true);
    });
  }, [section]);

  useEffect(() => {
    if (section !== "Payments") return;
    createClient().from("payments")
      .select("id,receipt_number,amount,agency_fee,carrier_payment,method,notes,status,created_at,customers(full_name)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPayments((data ?? []) as unknown as Payment[]));
  }, [section]);

  useEffect(() => {
    if (section !== "Tasks") return;
    const supabase = createClient();
    supabase.from("tasks")
      .select("id,title,description,priority,status,due_at,assigned_to,created_by,completed_at,customers(full_name),assignee:profiles!tasks_assigned_to_fkey(full_name)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .then(({ data }) => setTasks((data ?? []) as unknown as Task[]));
    supabase.from("profiles").select("id,full_name,email,role,active").eq("active", true).order("full_name")
      .then(({ data }) => setStaff((data ?? []) as StaffProfile[]));
  }, [section]);

  useEffect(() => {
    if (section !== "Employees" || userRole !== "owner") return;
    createClient().from("profiles")
      .select("id,full_name,email,role,active")
      .order("full_name")
      .then(({ data, error }) => {
        if (error) setEmployeeMessage(error.message);
        else setStaff((data ?? []) as StaffProfile[]);
      });
  }, [section, userRole]);

  useEffect(() => {
    if (section !== "Policies") return;
    createClient().from("policies")
      .select("id,carrier,policy_number,effective_date,expiration_date,monthly_premium,down_payment,payment_due_day,coverage_summary,status,customers(full_name)")
      .order("expiration_date", { ascending: true })
      .then(({ data }) => setPolicies((data ?? []) as unknown as Policy[]));
  }, [section]);

  useEffect(() => {
    if (section !== "Quotes") return;
    createClient().from("quotes")
      .select("id,carrier,quote_number,coverage_summary,down_payment,monthly_payment,term_months,valid_until,status,customers(full_name)")
      .order("monthly_payment", { ascending: true })
      .then(({ data }) => setQuotes((data ?? []) as unknown as Quote[]));
  }, [section]);

  async function addCustomer(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    if (!name) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
    if (!profile) return;
    const { data } = await supabase.from("customers").insert({ agency_id: profile.agency_id, full_name: name, phone, created_by: user.id }).select("id").single();
    if (data) setCustomers(prev => [{ id: data.id, name, phone, carrier: "—", status: "New" }, ...prev]);
    setShowCustomer(false);
  }

  async function uploadDocument(formData: FormData) {
    const customerId = String(formData.get("customer_id") || "");
    const file = formData.get("document");
    if (!(file instanceof File) || !customerId) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type) || file.size > 10485760) {
      setDocumentMessage("Choose a PDF, JPG, or PNG file no larger than 10 MB.");
      return;
    }
    setUploading(true); setDocumentMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single()
      : { data: null };
    if (!user || !profile) { setUploading(false); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${profile.agency_id}/${customerId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("agency-documents").upload(storagePath, file, { upsert: false });
    if (uploadError) { setDocumentMessage(uploadError.message); setUploading(false); return; }
    const { data, error } = await supabase.from("documents").insert({
      agency_id: profile.agency_id, customer_id: customerId, storage_path: storagePath,
      original_filename: file.name, mime_type: file.type, file_size: file.size, uploaded_by: user.id,
    }).select("id,original_filename,storage_path,mime_type,file_size,created_at,customers(full_name)").single();
    if (error) {
      await supabase.storage.from("agency-documents").remove([storagePath]);
      setDocumentMessage(error.message);
    } else if (data) {
      setDocuments(prev => [data as unknown as AgencyDocument, ...prev]);
      setDocumentMessage("Document uploaded securely.");
    }
    setUploading(false);
  }

  async function openDocument(path: string) {
    const { data, error } = await createClient().storage.from("agency-documents").createSignedUrl(path, 60);
    if (error) { setDocumentMessage(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(document: AgencyDocument) {
    if (!window.confirm(`Permanently delete ${document.original_filename}?`)) return;
    setDocumentMessage("");
    const supabase = createClient();
    const { error: fileError } = await supabase.storage.from("agency-documents").remove([document.storage_path]);
    if (fileError) { setDocumentMessage(fileError.message); return; }
    const { error } = await supabase.from("documents").delete().eq("id", document.id);
    if (error) { setDocumentMessage(error.message); return; }
    setDocuments(prev => prev.filter(item => item.id !== document.id));
    setDocumentMessage("Document deleted.");
  }

  async function addQuote(formData: FormData) {
    setQuoteMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const payload = {
      agency_id: profile.agency_id,
      customer_id: String(formData.get("customer_id")),
      carrier: String(formData.get("carrier")).trim(),
      quote_number: String(formData.get("quote_number") || "").trim() || null,
      coverage_summary: String(formData.get("coverage_summary")).trim(),
      down_payment: Number(formData.get("down_payment")),
      monthly_payment: Number(formData.get("monthly_payment")),
      term_months: Number(formData.get("term_months")),
      valid_until: String(formData.get("valid_until") || "") || null,
      status: "draft",
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: user.id,
    };
    const { data, error } = await supabase.from("quotes").insert(payload)
      .select("id,carrier,quote_number,coverage_summary,down_payment,monthly_payment,term_months,valid_until,status,customers(full_name)").single();
    if (error) { setQuoteMessage(error.message); return; }
    if (data) setQuotes(prev => [...prev, data as unknown as Quote].sort((a,b) => Number(a.monthly_payment) - Number(b.monthly_payment)));
    setQuoteMessage("Quote saved.");
  }

  async function setQuoteStatus(id: string, status: Quote["status"]) {
    const { error } = await createClient().from("quotes").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setQuoteMessage(error.message); return; }
    setQuotes(prev => prev.map(quote => quote.id === id ? { ...quote, status } : quote));
  }

  async function addPolicy(formData: FormData) {
    setPolicyMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const payload = {
      agency_id: profile.agency_id,
      customer_id: String(formData.get("customer_id")),
      carrier: String(formData.get("carrier")).trim(),
      policy_number: String(formData.get("policy_number")).trim(),
      effective_date: String(formData.get("effective_date")),
      expiration_date: String(formData.get("expiration_date")),
      monthly_premium: Number(formData.get("monthly_premium")),
      down_payment: Number(formData.get("down_payment")),
      payment_due_day: Number(formData.get("payment_due_day")),
      coverage_summary: String(formData.get("coverage_summary")).trim(),
      status: "active",
      created_by: user.id,
    };
    const { data, error } = await supabase.from("policies").insert(payload)
      .select("id,carrier,policy_number,effective_date,expiration_date,monthly_premium,down_payment,payment_due_day,coverage_summary,status,customers(full_name)").single();
    if (error) { setPolicyMessage(error.message); return; }
    if (data) setPolicies(prev => [...prev, data as unknown as Policy].sort((a,b) => String(a.expiration_date).localeCompare(String(b.expiration_date))));
    setPolicyMessage("Policy saved.");
  }

  async function setPolicyStatus(id: string, status: string) {
    const { error } = await createClient().from("policies").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setPolicyMessage(error.message); return; }
    setPolicies(prev => prev.map(policy => policy.id === id ? { ...policy, status } : policy));
  }

  async function addPayment(formData: FormData) {
    setPaymentMessage("");
    const carrierPayment = Number(formData.get("carrier_payment"));
    const agencyFee = Number(formData.get("agency_fee"));
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const receiptNumber = `FAH-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from("payments").insert({
      agency_id: profile.agency_id,
      customer_id: String(formData.get("customer_id")),
      amount: carrierPayment + agencyFee,
      carrier_payment: carrierPayment,
      agency_fee: agencyFee,
      method: String(formData.get("method")),
      notes: String(formData.get("notes") || "").trim() || null,
      received_by: user.id,
      receipt_number: receiptNumber,
      status: "posted",
    }).select("id,receipt_number,amount,agency_fee,carrier_payment,method,notes,status,created_at,customers(full_name)").single();
    if (error) { setPaymentMessage(error.message); return; }
    if (data) { const payment = data as unknown as Payment; setPayments(prev => [payment,...prev]); setSelectedReceipt(payment); }
    setPaymentMessage("Payment recorded. Receipt ready.");
  }

  async function voidPayment(payment: Payment) {
    const reason = window.prompt("Reason for voiding this payment:");
    if (!reason?.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("payments").update({ status: "voided", void_reason: reason.trim(), voided_by: user.id, voided_at: new Date().toISOString() }).eq("id", payment.id);
    if (error) { setPaymentMessage(error.message); return; }
    setPayments(prev => prev.map(item => item.id === payment.id ? { ...item, status: "voided" } : item));
    setPaymentMessage("Payment voided. The original record remains in the audit trail.");
  }

  async function addTask(formData: FormData) {
    setTaskMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const customerId = String(formData.get("customer_id") || "");
    const assignedTo = String(formData.get("assigned_to") || "");
    const dueAt = String(formData.get("due_at") || "");
    const { data, error } = await supabase.from("tasks").insert({
      agency_id: profile.agency_id,
      customer_id: customerId || null,
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim() || null,
      priority: String(formData.get("priority")),
      status: "open",
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      assigned_to: assignedTo || null,
      created_by: user.id,
    }).select("id,title,description,priority,status,due_at,assigned_to,created_by,completed_at,customers(full_name),assignee:profiles!tasks_assigned_to_fkey(full_name)").single();
    if (error) { setTaskMessage(error.message); return; }
    if (data) setTasks(prev => [...prev, data as unknown as Task].sort((a,b) => String(a.due_at ?? "9999").localeCompare(String(b.due_at ?? "9999"))));
    setTaskMessage("Task created.");
  }

  async function setTaskStatus(task: Task, status: Task["status"]) {
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    const { error } = await createClient().from("tasks").update({ status, completed_at: completedAt, updated_at: new Date().toISOString() }).eq("id", task.id);
    if (error) { setTaskMessage(error.message); return; }
    setTasks(prev => prev.map(item => item.id === task.id ? { ...item, status, completed_at: completedAt } : item));
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    const { error } = await createClient().from("tasks").delete().eq("id", task.id);
    if (error) { setTaskMessage(error.message); return; }
    setTasks(prev => prev.filter(item => item.id !== task.id));
    setTaskMessage("Task deleted.");
  }

  async function manageEmployee(formData: FormData) {
    setEmployeeMessage("");
    const targetUserId = String(formData.get("target_user_id") || "");
    const fullName = String(formData.get("full_name") || "").trim();
    const role = String(formData.get("role") || "agent");
    const active = String(formData.get("active")) === "true";
    const { error } = await createClient().rpc("manage_employee", {
      target_user_id: targetUserId,
      new_full_name: fullName,
      new_role: role,
      new_active: active,
    });
    if (error) { setEmployeeMessage(error.message); return; }
    setStaff(previous => previous.map(person => person.id === targetUserId
      ? { ...person, full_name: fullName, role, active }
      : person));
    setEmployeeMessage("Employee access updated successfully.");
  }

  async function inviteEmployee(formData: FormData) {
    setEmployeeMessage("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setEmployeeMessage("Your session expired. Please sign in again."); return; }
    const response = await fetch("/api/employees/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        fullName: String(formData.get("full_name") || "").trim(),
        email: String(formData.get("email") || "").trim().toLowerCase(),
        role: String(formData.get("role") || "agent"),
      }),
    });
    const result = await response.json();
    if (!response.ok) { setEmployeeMessage(result.error || "The invitation could not be sent."); return; }
    const { data } = await supabase.from("profiles").select("id,full_name,email,role,active").order("full_name");
    setStaff((data ?? []) as StaffProfile[]);
    setEmployeeMessage("Invitation sent. The employee must open the email and create a password.");
  }

  return (
    <main className="shell">
      <aside>
        <div className="brand"><div className="logo">F</div><div><b>Freedom Agency Hub</b><span>Freedom Auto Insurance</span></div></div>
        <nav>
          {["Dashboard","Customers","Documents","Quotes","Policies","Payments","Tasks", ...(userRole === "owner" ? ["Employees"] : [])].map(item =>
            <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>
          )}
        </nav>
        <div className="secure">Secure cloud-ready system</div>
      </aside>

      <section className="content">
        <header>
          <div><h1>{section}</h1><p>Freedom Auto Insurance operations</p></div>
          <div className="header-actions"><button className="gold" onClick={() => setShowCustomer(true)}>+ New Customer</button><button className="logout" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
        </header>

        {section === "Dashboard" && <>
          <div className="metrics">
            <Metric label="New Customers" value={dashboardLoaded ? String(dashboardStats.newCustomers) : "—"} note="Added today" />
            <Metric label="Quotes in Progress" value={dashboardLoaded ? String(dashboardStats.openQuotes) : "—"} note="Draft or presented" />
            <Metric label="Renewals Due" value={dashboardLoaded ? String(dashboardStats.renewalsDue) : "—"} note="Next 30 days" />
            <Metric label="Collected Today" value={dashboardLoaded ? `$${dashboardStats.collectedToday.toFixed(2)}` : "—"} note="Posted payments" />
          </div>
          <div className="panel">
            <h2>Recent Customers</h2>
            <CustomerTable customers={customers.slice(0,5)} />
          </div>
        </>}

        {section === "Customers" && <div className="panel">
          <div className="row"><h2>Customer Records</h2><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." /></div>
          <CustomerTable customers={filtered} />
        </div>}

        {section === "Documents" && <>
          <div className="panel">
            <h2>Secure Document Upload</h2>
            <p className="muted">PDF, JPG, or PNG only. Maximum 10 MB.</p>
            <form action={uploadDocument} className="document-form">
              <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
              <label>Document<input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
              <button className="gold" disabled={uploading}>{uploading ? "Uploading…" : "Upload securely"}</button>
            </form>
            {documentMessage && <p className="document-message" role="status">{documentMessage}</p>}
          </div>
          <div className="panel"><h2>Customer Documents</h2><div className="document-list">
            {documents.length === 0 && <p className="muted">No documents uploaded.</p>}
            {documents.map(document => <div className="document-row" key={document.id}>
              <div><b>{document.original_filename}</b><span>{document.customers?.full_name ?? "Customer"} · {(document.file_size / 1048576).toFixed(2)} MB</span></div>
              <div className="document-actions"><button className="logout" onClick={() => openDocument(document.storage_path)}>Open</button>{["owner","manager"].includes(userRole) && <button className="logout" onClick={() => deleteDocument(document)}>Delete</button>}</div>
            </div>)}
          </div></div>
        </>}

        {section === "Quotes" && <>
          <div className="panel"><h2>New Carrier Quote</h2><form action={addQuote} className="quote-form">
            <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Carrier<input name="carrier" placeholder="Carrier name" required /></label>
            <label>Quote number<input name="quote_number" placeholder="Optional" /></label>
            <label>Down payment<input name="down_payment" type="number" min="0" step="0.01" required /></label>
            <label>Monthly payment<input name="monthly_payment" type="number" min="0" step="0.01" required /></label>
            <label>Term<select name="term_months" defaultValue="6"><option value="6">6 months</option><option value="12">12 months</option></select></label>
            <label>Valid until<input name="valid_until" type="date" /></label>
            <label className="wide">Coverage summary<textarea name="coverage_summary" placeholder="Liability limits, deductibles, roadside, rental…" required /></label>
            <label className="wide">Notes<textarea name="notes" placeholder="Optional internal notes" /></label>
            <button className="gold" type="submit">Save quote</button>
          </form>{quoteMessage && <p className="document-message" role="status">{quoteMessage}</p>}</div>
          <div className="panel"><div className="row"><h2>Carrier Comparison</h2><span className="muted">Lowest monthly price first</span></div><div className="quote-list">
            {quotes.length === 0 && <p className="muted">No quotes saved.</p>}
            {quotes.map((quote,index) => <div className={`quote-card ${index === 0 ? "best" : ""}`} key={quote.id}>
              <div><div className="quote-title"><b>{quote.carrier}</b>{index === 0 && <span className="best-label">Lowest monthly</span>}</div><span>{quote.customers?.full_name ?? "Customer"} · {quote.coverage_summary}</span></div>
              <div className="quote-price"><small>Down</small><b>${Number(quote.down_payment).toFixed(2)}</b></div>
              <div className="quote-price"><small>Monthly</small><b>${Number(quote.monthly_payment).toFixed(2)}</b></div>
              <select value={quote.status} onChange={event => setQuoteStatus(quote.id, event.target.value as Quote["status"])}><option value="draft">Draft</option><option value="presented">Presented</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option></select>
            </div>)}
          </div></div>
        </>}

        {section === "Policies" && <>
          <div className="panel"><h2>Add Policy</h2><form action={addPolicy} className="quote-form">
            <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Carrier<input name="carrier" required /></label>
            <label>Policy number<input name="policy_number" required /></label>
            <label>Payment due day<input name="payment_due_day" type="number" min="1" max="31" required /></label>
            <label>Effective date<input name="effective_date" type="date" required /></label>
            <label>Expiration date<input name="expiration_date" type="date" required /></label>
            <label>Down payment<input name="down_payment" type="number" min="0" step="0.01" required /></label>
            <label>Monthly premium<input name="monthly_premium" type="number" min="0" step="0.01" required /></label>
            <label className="wide">Coverage summary<textarea name="coverage_summary" required placeholder="Limits, deductibles, vehicles, endorsements…" /></label>
            <button className="gold" type="submit">Save policy</button>
          </form>{policyMessage && <p className="document-message" role="status">{policyMessage}</p>}</div>
          <div className="panel"><div className="row"><h2>Policy Book</h2><span className="muted">Renewals ordered by expiration</span></div><div className="quote-list">
            {policies.length === 0 && <p className="muted">No policies saved.</p>}
            {policies.map(policy => { const days = policy.expiration_date ? Math.ceil((new Date(`${policy.expiration_date}T12:00:00`).getTime() - Date.now()) / 86400000) : null; return <div className={`policy-card ${days !== null && days <= 30 ? "renewal-due" : ""}`} key={policy.id}>
              <div><b>{policy.customers?.full_name ?? "Customer"}</b><span>{policy.carrier} · #{policy.policy_number}</span><small>{policy.coverage_summary}</small></div>
              <div className="quote-price"><small>Monthly</small><b>${Number(policy.monthly_premium ?? 0).toFixed(2)}</b></div>
              <div className="quote-price"><small>Expires</small><b>{policy.expiration_date ?? "—"}</b><span>{days === null ? "" : days < 0 ? "Expired" : `${days} days`}</span></div>
              <select value={policy.status} onChange={event => setPolicyStatus(policy.id,event.target.value)}><option value="active">Active</option><option value="pending">Pending</option><option value="cancel_notice">Cancel notice</option><option value="canceled">Canceled</option><option value="expired">Expired</option><option value="rewritten">Rewritten</option></select>
            </div>})}
          </div></div>
        </>}

        {section === "Payments" && <>
          <div className="metrics payment-metrics"><Metric label="Collected Today" value={`$${payments.filter(p => p.status === "posted" && new Date(p.created_at).toDateString() === new Date().toDateString()).reduce((sum,p) => sum + Number(p.amount),0).toFixed(2)}`} note="Posted payments" /><Metric label="Agency Fees Today" value={`$${payments.filter(p => p.status === "posted" && new Date(p.created_at).toDateString() === new Date().toDateString()).reduce((sum,p) => sum + Number(p.agency_fee),0).toFixed(2)}`} note="Agency revenue" /></div>
          <div className="panel"><h2>Record Payment</h2><p className="muted">Record the transaction only. Never enter a card number or bank-account number.</p><form action={addPayment} className="quote-form">
            <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Carrier payment<input name="carrier_payment" type="number" min="0" step="0.01" required /></label>
            <label>Agency fee<input name="agency_fee" type="number" min="0" step="0.01" defaultValue="0" required /></label>
            <label>Method<select name="method" required defaultValue=""><option value="" disabled>Select method</option><option>Cash</option><option>Card</option><option>Check</option><option>ACH</option><option>Money order</option></select></label>
            <label className="wide">Notes<textarea name="notes" placeholder="Optional; never enter payment credentials" /></label>
            <button className="gold" type="submit">Record and create receipt</button>
          </form>{paymentMessage && <p className="document-message" role="status">{paymentMessage}</p>}</div>
          <div className="panel"><h2>Payment Activity</h2><div className="quote-list">
            {payments.length === 0 && <p className="muted">No payments recorded.</p>}
            {payments.map(payment => <div className={`payment-row ${payment.status === "voided" ? "voided" : ""}`} key={payment.id}>
              <div><b>{payment.customers?.full_name ?? "Customer"}</b><span>{payment.receipt_number} · {new Date(payment.created_at).toLocaleString()}</span></div>
              <div className="quote-price"><small>Total</small><b>${Number(payment.amount).toFixed(2)}</b></div>
              <div><span>{payment.method}</span><b>{payment.status}</b></div>
              <div className="document-actions"><button className="logout" onClick={() => setSelectedReceipt(payment)}>Receipt</button>{payment.status === "posted" && ["owner","manager","accounting"].includes(userRole) && <button className="logout" onClick={() => voidPayment(payment)}>Void</button>}</div>
            </div>)}
          </div></div>
        </>}

        {section === "Tasks" && <>
          <div className="metrics task-metrics"><Metric label="Open Tasks" value={String(tasks.filter(task => !["completed","canceled"].includes(task.status)).length)} note="Needs attention" /><Metric label="Overdue" value={String(tasks.filter(task => task.due_at && new Date(task.due_at) < new Date() && !["completed","canceled"].includes(task.status)).length)} note="Past due date" /><Metric label="Completed" value={String(tasks.filter(task => task.status === "completed").length)} note="All completed tasks" /></div>
          <div className="panel"><h2>Create Task or Reminder</h2><form action={addTask} className="quote-form">
            <label className="wide">Task title<input name="title" required placeholder="Call customer about renewal" /></label>
            <label>Customer (optional)<select name="customer_id" defaultValue=""><option value="">No customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Assign to<select name="assigned_to" defaultValue=""><option value="">Unassigned</option>{staff.map(person => <option key={person.id} value={person.id}>{person.full_name || "Staff member"} · {person.role}</option>)}</select></label>
            <label>Due date and time<input name="due_at" type="datetime-local" /></label>
            <label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label className="wide">Instructions<textarea name="description" placeholder="Optional task details" /></label>
            <button className="gold" type="submit">Create task</button>
          </form>{taskMessage && <p className="document-message" role="status">{taskMessage}</p>}</div>
          <div className="panel"><div className="row"><h2>Task List</h2><span className="muted">Due soonest first</span></div><div className="task-list">
            {tasks.length === 0 && <p className="muted">No tasks created.</p>}
            {tasks.map(task => { const overdue = Boolean(task.due_at && new Date(task.due_at) < new Date() && !["completed","canceled"].includes(task.status)); return <div className={`task-card priority-${task.priority} ${overdue ? "overdue" : ""} ${task.status === "completed" ? "completed" : ""}`} key={task.id}>
              <div className="task-main"><div className="quote-title"><b>{task.title}</b><span className={`priority-label ${task.priority}`}>{task.priority}</span>{overdue && <span className="overdue-label">Overdue</span>}</div><span>{task.customers?.full_name ?? "No customer"} · Assigned to {task.assignee?.full_name ?? "Unassigned"}</span>{task.description && <small>{task.description}</small>}</div>
              <div className="task-due"><small>Due</small><b>{task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}</b></div>
              <select value={task.status} onChange={event => setTaskStatus(task,event.target.value as Task["status"])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select>
              {[
                "owner","manager"
              ].includes(userRole) && <button className="logout" onClick={() => deleteTask(task)}>Delete</button>}
            </div>})}
          </div></div>
        </>}

        {section === "Employees" && userRole === "owner" && <>
          <div className="panel">
            <div className="row"><div><h2>Employee Management</h2><p className="muted">Only the agency owner can change roles or employee access.</p></div><span className="badge active">Owner access</span></div>
            {employeeMessage && <p className="document-message" role="status">{employeeMessage}</p>}
          </div>
          <div className="panel"><h2>Invite Employee</h2><p className="muted">The employee will receive a secure email link to create a password.</p><form action={inviteEmployee} className="invite-form">
            <label>Full name<input name="full_name" required /></label>
            <label>Email address<input name="email" type="email" required /></label>
            <label>Role<select name="role" defaultValue="agent"><option value="manager">Manager</option><option value="agent">Agent</option><option value="csr">Customer service</option><option value="accounting">Accounting</option></select></label>
            <button className="gold" type="submit">Send invitation</button>
          </form></div>
          <div className="employee-list">
            {staff.length === 0 && <div className="panel"><p className="muted">No employee profiles found.</p></div>}
            {staff.map(person => <form action={manageEmployee} className="panel employee-card" key={person.id}>
              <input type="hidden" name="target_user_id" value={person.id} />
              <label>Employee name<input name="full_name" defaultValue={person.full_name ?? ""} required /></label>
              <label>Email<input value={person.email ?? "Not available"} disabled /></label>
              <label>Role<select name="role" defaultValue={person.role}><option value="owner">Owner</option><option value="manager">Manager</option><option value="agent">Agent</option><option value="csr">Customer service</option><option value="accounting">Accounting</option></select></label>
              <label>Access<select name="active" defaultValue={String(person.active)}><option value="true">Active</option><option value="false">Deactivated</option></select></label>
              <button className="gold" type="submit">Save employee</button>
            </form>)}
          </div>
        </>}

        {section !== "Dashboard" && section !== "Customers" && section !== "Documents" && section !== "Quotes" && section !== "Policies" && section !== "Payments" && section !== "Tasks" && section !== "Employees" && <div className="panel empty">
          <h2>{section}</h2>
          <p>This production module is scaffolded and ready to connect to Supabase.</p>
        </div>}
      </section>

      {showCustomer && <div className="modal">
        <form action={addCustomer}>
          <div className="row"><h2>Add Customer</h2><button type="button" className="close" onClick={() => setShowCustomer(false)}>×</button></div>
          <label>Full Name<input name="name" required /></label>
          <label>Phone<input name="phone" /></label>
          <label>Preferred Language<select name="language"><option>English</option><option>Spanish</option></select></label>
          <button className="gold" type="submit">Save Customer</button>
        </form>
      </div>}
      {selectedReceipt && <div className="modal receipt-modal"><div className="receipt" role="dialog" aria-label="Payment receipt">
        <div className="row"><div><h2>Freedom Auto Insurance</h2><p>Payment Receipt</p></div><button className="close no-print" onClick={() => setSelectedReceipt(null)}>×</button></div>
        <div className="receipt-number">{selectedReceipt.receipt_number}</div><dl><div><dt>Customer</dt><dd>{selectedReceipt.customers?.full_name}</dd></div><div><dt>Date</dt><dd>{new Date(selectedReceipt.created_at).toLocaleString()}</dd></div><div><dt>Method</dt><dd>{selectedReceipt.method}</dd></div><div><dt>Carrier payment</dt><dd>${Number(selectedReceipt.carrier_payment).toFixed(2)}</dd></div><div><dt>Agency fee</dt><dd>${Number(selectedReceipt.agency_fee).toFixed(2)}</dd></div><div className="receipt-total"><dt>Total received</dt><dd>${Number(selectedReceipt.amount).toFixed(2)}</dd></div><div><dt>Status</dt><dd>{selectedReceipt.status}</dd></div></dl>
        <button className="gold no-print" onClick={() => window.print()}>Print receipt</button>
      </div></div>}
    </main>
  );
}

function Metric({label,value,note}:{label:string,value:string,note:string}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function CustomerTable({customers}:{customers:Customer[]}) {
  return <div className="table">
    <div className="tr th"><span>Customer</span><span>Phone</span><span>Carrier</span><span>Status</span></div>
    {customers.map(c => <div className="tr" key={c.id}>
      <b>{c.name}</b><span>{c.phone}</span><span>{c.carrier}</span><span className={`badge ${c.status.replace(" ","-").toLowerCase()}`}>{c.status}</span>
    </div>)}
  </div>;
}
