"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferred_language?: string;
  address?: string;
  notes?: string;
  carrier: string;
  status: "Active" | "Quoted" | "Cancel Notice" | "New";
};

type Vehicle = {
  id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
};

type CustomerActivity = {
  id: string;
  type: "Quote" | "Policy" | "Payment" | "Document" | "Task";
  title: string;
  detail: string;
  date: string;
};

type Driver = {
  id: string;
  customer_id: string;
  full_name: string;
  date_of_birth: string | null;
  relationship: "named_insured" | "spouse" | "child" | "other";
  license_state: string | null;
  license_last4: string | null;
  license_status: "valid" | "permit" | "suspended" | "expired" | "unknown";
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

type QuoteIntake = {
  id: string;
  customer_id: string;
  status: "draft" | "ready" | "quoted" | "bound" | "closed";
  requested_bodily_injury: string | null;
  requested_property_damage: string | null;
  uninsured_motorist: boolean;
  comprehensive_deductible: number | null;
  collision_deductible: number | null;
  roadside_assistance: boolean;
  rental_reimbursement: boolean;
  prior_carrier: string | null;
  prior_policy_expiration: string | null;
  continuous_coverage_months: number | null;
  lapse_days: number;
  homeowner: boolean;
  garaging_address: string | null;
  usage_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  customers: { full_name: string } | null;
};

type DrivingIncident = {
  id: string;
  driver_id: string | null;
  incident_type: "accident" | "violation" | "claim" | "suspension" | "other";
  incident_date: string | null;
  description: string | null;
  at_fault: boolean | null;
  estimated_amount: number | null;
  drivers: { full_name: string } | null;
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);
  const [customerActivity, setCustomerActivity] = useState<CustomerActivity[]>([]);
  const [customerDrivers, setCustomerDrivers] = useState<Driver[]>([]);
  const [customerMessage, setCustomerMessage] = useState("");
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [userRole, setUserRole] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quoteIntakes, setQuoteIntakes] = useState<QuoteIntake[]>([]);
  const [intakeMessage, setIntakeMessage] = useState("");
  const [selectedIntake, setSelectedIntake] = useState<QuoteIntake | null>(null);
  const [intakeDrivers, setIntakeDrivers] = useState<Driver[]>([]);
  const [intakeVehicles, setIntakeVehicles] = useState<Vehicle[]>([]);
  const [drivingIncidents, setDrivingIncidents] = useState<DrivingIncident[]>([]);
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

  useEffect(() => {
    if (section !== "Quote Intake") return;
    createClient().from("quote_intakes")
      .select("id,customer_id,status,requested_bodily_injury,requested_property_damage,uninsured_motorist,comprehensive_deductible,collision_deductible,roadside_assistance,rental_reimbursement,prior_carrier,prior_policy_expiration,continuous_coverage_months,lapse_days,homeowner,garaging_address,usage_notes,internal_notes,created_at,customers(full_name)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setIntakeMessage(error.message);
        else setQuoteIntakes((data ?? []) as unknown as QuoteIntake[]);
      });
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
    const email = String(formData.get("email") || "").trim();
    const preferredLanguage = String(formData.get("language") || "English");
    const address = String(formData.get("address") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const { data } = await supabase.from("customers").insert({ agency_id: profile.agency_id, full_name: name, phone, email: email || null, preferred_language: preferredLanguage, address: address || null, notes: notes || null, created_by: user.id }).select("id").single();
    if (data) setCustomers(prev => [{ id: data.id, name, phone, email, preferred_language: preferredLanguage, address, notes, carrier: "—", status: "New" }, ...prev]);
    setShowCustomer(false);
  }

  async function openCustomer(customerId: string) {
    setCustomerMessage("");
    const supabase = createClient();
    const [{ data: customer, error }, { data: vehicles }, { data: drivers }, { data: customerQuotes }, { data: customerPolicies }, { data: customerPayments }, { data: customerDocuments }, { data: customerTasks }] = await Promise.all([
      supabase.from("customers").select("id,full_name,phone,email,preferred_language,address,notes,policies(carrier,status)").eq("id", customerId).single(),
      supabase.from("vehicles").select("id,customer_id,year,make,model,vin").eq("customer_id", customerId).order("created_at"),
      supabase.from("drivers").select("id,customer_id,full_name,date_of_birth,relationship,license_state,license_last4,license_status").eq("customer_id", customerId).order("created_at"),
      supabase.from("quotes").select("id,carrier,status,monthly_payment,created_at").eq("customer_id", customerId),
      supabase.from("policies").select("id,carrier,policy_number,status,effective_date,created_at").eq("customer_id", customerId),
      supabase.from("payments").select("id,receipt_number,amount,status,created_at").eq("customer_id", customerId),
      supabase.from("documents").select("id,original_filename,created_at").eq("customer_id", customerId),
      supabase.from("tasks").select("id,title,status,created_at").eq("customer_id", customerId),
    ]);
    if (error || !customer) { setCustomerMessage(error?.message || "Customer could not be opened."); return; }
    const row = customer as any;
    setSelectedCustomer({
      id: row.id,
      name: row.full_name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      preferred_language: row.preferred_language ?? "English",
      address: row.address ?? "",
      notes: row.notes ?? "",
      carrier: row.policies?.[0]?.carrier ?? "—",
      status: row.policies?.[0]?.status === "active" ? "Active" : "New",
    });
    setCustomerVehicles((vehicles ?? []) as Vehicle[]);
    setCustomerDrivers((drivers ?? []) as Driver[]);
    const activity: CustomerActivity[] = [
      ...(customerQuotes ?? []).map((item: any) => ({ id: `quote-${item.id}`, type: "Quote" as const, title: `${item.carrier} quote`, detail: `${item.status} · $${Number(item.monthly_payment ?? 0).toFixed(2)}/month`, date: item.created_at })),
      ...(customerPolicies ?? []).map((item: any) => ({ id: `policy-${item.id}`, type: "Policy" as const, title: `${item.carrier || "Carrier"} policy`, detail: `${item.policy_number || "No policy number"} · ${item.status}`, date: item.created_at || item.effective_date })),
      ...(customerPayments ?? []).map((item: any) => ({ id: `payment-${item.id}`, type: "Payment" as const, title: `Payment ${item.receipt_number || "receipt"}`, detail: `$${Number(item.amount ?? 0).toFixed(2)} · ${item.status}`, date: item.created_at })),
      ...(customerDocuments ?? []).map((item: any) => ({ id: `document-${item.id}`, type: "Document" as const, title: item.original_filename, detail: "Document uploaded", date: item.created_at })),
      ...(customerTasks ?? []).map((item: any) => ({ id: `task-${item.id}`, type: "Task" as const, title: item.title, detail: item.status.replace("_", " "), date: item.created_at })),
    ].filter(item => item.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setCustomerActivity(activity);
  }

  async function updateCustomer(formData: FormData) {
    if (!selectedCustomer) return;
    setCustomerMessage("");
    const updated = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      preferred_language: String(formData.get("language") || "English"),
      address: String(formData.get("address") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    };
    const { error } = await createClient().from("customers").update({
      full_name: updated.name,
      phone: updated.phone || null,
      email: updated.email || null,
      preferred_language: updated.preferred_language,
      address: updated.address || null,
      notes: updated.notes || null,
      updated_at: new Date().toISOString(),
    }).eq("id", selectedCustomer.id);
    if (error) { setCustomerMessage(error.message); return; }
    setSelectedCustomer(previous => previous ? { ...previous, ...updated } : previous);
    setCustomers(previous => previous.map(customer => customer.id === selectedCustomer.id ? { ...customer, ...updated } : customer));
    setCustomerMessage("Customer profile updated.");
  }

  async function addVehicle(formData: FormData) {
    if (!selectedCustomer) return;
    setCustomerMessage("");
    const { data, error } = await createClient().from("vehicles").insert({
      customer_id: selectedCustomer.id,
      year: Number(formData.get("year")) || null,
      make: String(formData.get("make") || "").trim() || null,
      model: String(formData.get("model") || "").trim() || null,
      vin: String(formData.get("vin") || "").trim().toUpperCase() || null,
    }).select("id,customer_id,year,make,model,vin").single();
    if (error) { setCustomerMessage(error.message); return; }
    if (data) setCustomerVehicles(previous => [...previous, data as Vehicle]);
    setCustomerMessage("Vehicle added.");
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? "vehicle"}?`)) return;
    const { error } = await createClient().from("vehicles").delete().eq("id", vehicle.id);
    if (error) { setCustomerMessage(error.message); return; }
    setCustomerVehicles(previous => previous.filter(item => item.id !== vehicle.id));
    setCustomerMessage("Vehicle deleted.");
  }

  async function addDriver(formData: FormData) {
    if (!selectedCustomer) return;
    setCustomerMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const last4 = String(formData.get("license_last4") || "").trim().toUpperCase();
    const { data, error } = await supabase.from("drivers").insert({
      agency_id: profile.agency_id,
      customer_id: selectedCustomer.id,
      full_name: String(formData.get("full_name") || "").trim(),
      date_of_birth: String(formData.get("date_of_birth") || "") || null,
      relationship: String(formData.get("relationship") || "named_insured"),
      license_state: String(formData.get("license_state") || "").trim().toUpperCase() || null,
      license_last4: last4 || null,
      license_status: String(formData.get("license_status") || "valid"),
      created_by: user.id,
    }).select("id,customer_id,full_name,date_of_birth,relationship,license_state,license_last4,license_status").single();
    if (error) { setCustomerMessage(error.message); return; }
    if (data) setCustomerDrivers(previous => [...previous, data as Driver]);
    setCustomerMessage("Driver added.");
  }

  async function deleteDriver(driver: Driver) {
    if (!window.confirm(`Delete driver ${driver.full_name}?`)) return;
    const { error } = await createClient().from("drivers").delete().eq("id", driver.id);
    if (error) { setCustomerMessage(error.message); return; }
    setCustomerDrivers(previous => previous.filter(item => item.id !== driver.id));
    setCustomerMessage("Driver deleted.");
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

  function intakePayload(formData: FormData) {
    return {
      requested_bodily_injury: String(formData.get("requested_bodily_injury") || "").trim() || null,
      requested_property_damage: String(formData.get("requested_property_damage") || "").trim() || null,
      uninsured_motorist: formData.get("uninsured_motorist") === "on",
      comprehensive_deductible: Number(formData.get("comprehensive_deductible")) || null,
      collision_deductible: Number(formData.get("collision_deductible")) || null,
      roadside_assistance: formData.get("roadside_assistance") === "on",
      rental_reimbursement: formData.get("rental_reimbursement") === "on",
      prior_carrier: String(formData.get("prior_carrier") || "").trim() || null,
      prior_policy_expiration: String(formData.get("prior_policy_expiration") || "") || null,
      continuous_coverage_months: Number(formData.get("continuous_coverage_months")) || null,
      lapse_days: Number(formData.get("lapse_days")) || 0,
      homeowner: formData.get("homeowner") === "on",
      garaging_address: String(formData.get("garaging_address") || "").trim() || null,
      usage_notes: String(formData.get("usage_notes") || "").trim() || null,
      internal_notes: String(formData.get("internal_notes") || "").trim() || null,
    };
  }

  async function addQuoteIntake(formData: FormData) {
    setIntakeMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const { data, error } = await supabase.from("quote_intakes").insert({
      agency_id: profile.agency_id,
      customer_id: String(formData.get("customer_id")),
      status: "draft",
      ...intakePayload(formData),
      created_by: user.id,
    }).select("id,customer_id,status,requested_bodily_injury,requested_property_damage,uninsured_motorist,comprehensive_deductible,collision_deductible,roadside_assistance,rental_reimbursement,prior_carrier,prior_policy_expiration,continuous_coverage_months,lapse_days,homeowner,garaging_address,usage_notes,internal_notes,created_at,customers(full_name)").single();
    if (error) { setIntakeMessage(error.message); return; }
    if (data) setQuoteIntakes(previous => [data as unknown as QuoteIntake, ...previous]);
    setIntakeMessage("Quote intake worksheet created.");
  }

  async function openQuoteIntake(intake: QuoteIntake) {
    setIntakeMessage("");
    const supabase = createClient();
    const [{ data: drivers }, { data: vehicles }, { data: incidents }] = await Promise.all([
      supabase.from("drivers").select("id,customer_id,full_name,date_of_birth,relationship,license_state,license_last4,license_status").eq("customer_id", intake.customer_id).order("created_at"),
      supabase.from("vehicles").select("id,customer_id,year,make,model,vin").eq("customer_id", intake.customer_id).order("created_at"),
      supabase.from("driving_incidents").select("id,driver_id,incident_type,incident_date,description,at_fault,estimated_amount,drivers(full_name)").eq("quote_intake_id", intake.id).order("incident_date", { ascending: false }),
    ]);
    setSelectedIntake(intake);
    setIntakeDrivers((drivers ?? []) as Driver[]);
    setIntakeVehicles((vehicles ?? []) as Vehicle[]);
    setDrivingIncidents((incidents ?? []) as unknown as DrivingIncident[]);
  }

  async function updateQuoteIntake(formData: FormData) {
    if (!selectedIntake) return;
    setIntakeMessage("");
    const status = String(formData.get("status")) as QuoteIntake["status"];
    const updates = { status, ...intakePayload(formData) };
    const { error } = await createClient().from("quote_intakes").update(updates).eq("id", selectedIntake.id);
    if (error) { setIntakeMessage(error.message); return; }
    setSelectedIntake(previous => previous ? { ...previous, ...updates } : previous);
    setQuoteIntakes(previous => previous.map(item => item.id === selectedIntake.id ? { ...item, ...updates } : item));
    setIntakeMessage("Worksheet updated.");
  }

  async function addDrivingIncident(formData: FormData) {
    if (!selectedIntake) return;
    setIntakeMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("agency_id").eq("id", user.id).single() : { data: null };
    if (!user || !profile) return;
    const driverId = String(formData.get("driver_id") || "");
    const { data, error } = await supabase.from("driving_incidents").insert({
      agency_id: profile.agency_id,
      quote_intake_id: selectedIntake.id,
      driver_id: driverId || null,
      incident_type: String(formData.get("incident_type")),
      incident_date: String(formData.get("incident_date") || "") || null,
      description: String(formData.get("description") || "").trim() || null,
      at_fault: formData.get("at_fault") === "on",
      estimated_amount: Number(formData.get("estimated_amount")) || null,
      created_by: user.id,
    }).select("id,driver_id,incident_type,incident_date,description,at_fault,estimated_amount,drivers(full_name)").single();
    if (error) { setIntakeMessage(error.message); return; }
    if (data) setDrivingIncidents(previous => [data as unknown as DrivingIncident, ...previous]);
    setIntakeMessage("Incident added.");
  }

  async function deleteDrivingIncident(incident: DrivingIncident) {
    if (!window.confirm("Delete this driving incident?")) return;
    const { error } = await createClient().from("driving_incidents").delete().eq("id", incident.id);
    if (error) { setIntakeMessage(error.message); return; }
    setDrivingIncidents(previous => previous.filter(item => item.id !== incident.id));
    setIntakeMessage("Incident deleted.");
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
    const { error } = await supabase.rpc("void_payment", {
      target_payment_id: payment.id,
      void_explanation: reason.trim(),
    });
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

  const isOperationalStaff = ["owner", "manager", "agent", "csr"].includes(userRole);

  return (
    <main className="shell">
      <aside>
        <div className="brand"><div className="logo">F</div><div><b>Freedom Agency Hub</b><span>Freedom Auto Insurance</span></div></div>
        <nav>
          {["Dashboard","Customers","Documents","Quote Intake","Quotes","Policies","Payments","Tasks", ...(userRole === "owner" ? ["Employees"] : [])].map(item =>
            <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>
          )}
        </nav>
        <div className="secure">Secure cloud-ready system</div>
      </aside>

      <section className="content">
        <header>
          <div><h1>{section}</h1><p>Freedom Auto Insurance operations</p></div>
          <div className="header-actions">{isOperationalStaff && <button className="gold" onClick={() => setShowCustomer(true)}>+ New Customer</button>}<button className="logout" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sign out</button></div>
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
            <CustomerTable customers={customers.slice(0,5)} onSelect={openCustomer} />
          </div>
        </>}

        {section === "Customers" && <div className="panel">
          <div className="row"><h2>Customer Records</h2><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." /></div>
          <CustomerTable customers={filtered} onSelect={openCustomer} />
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

        {section === "Quote Intake" && <>
          {isOperationalStaff && <div className="panel"><h2>New Auto Quote Intake</h2><p className="muted">Collect the risk once, then use it to prepare carrier quotes.</p><form action={addQuoteIntake} className="intake-form">
            <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Bodily injury limits<input name="requested_bodily_injury" placeholder="Example: 25/50" /></label>
            <label>Property damage<input name="requested_property_damage" placeholder="Example: 25" /></label>
            <label>Comprehensive deductible<input name="comprehensive_deductible" type="number" min="0" step="1" /></label>
            <label>Collision deductible<input name="collision_deductible" type="number" min="0" step="1" /></label>
            <label>Prior carrier<input name="prior_carrier" /></label>
            <label>Prior policy expiration<input name="prior_policy_expiration" type="date" /></label>
            <label>Continuous coverage (months)<input name="continuous_coverage_months" type="number" min="0" /></label>
            <label>Lapse days<input name="lapse_days" type="number" min="0" defaultValue="0" /></label>
            <label className="wide">Garaging address<input name="garaging_address" /></label>
            <div className="intake-checks"><label><input name="uninsured_motorist" type="checkbox" /> Uninsured motorist</label><label><input name="roadside_assistance" type="checkbox" /> Roadside assistance</label><label><input name="rental_reimbursement" type="checkbox" /> Rental reimbursement</label><label><input name="homeowner" type="checkbox" /> Homeowner</label></div>
            <label className="wide">Vehicle usage notes<textarea name="usage_notes" placeholder="Commute, annual mileage, business use, garaging details…" /></label>
            <label className="wide">Internal notes<textarea name="internal_notes" /></label>
            <button className="gold" type="submit">Create worksheet</button>
          </form></div>}
          <div className="panel"><div className="row"><h2>Quote Intake Worklist</h2><span className="muted">{quoteIntakes.length} worksheets</span></div>{intakeMessage && <p className="document-message" role="status">{intakeMessage}</p>}<div className="intake-list">
            {quoteIntakes.length === 0 && <p className="muted">No quote intake worksheets created.</p>}
            {quoteIntakes.map(intake => <div className="intake-card" key={intake.id}><div><b>{intake.customers?.full_name ?? "Customer"}</b><span>{intake.prior_carrier || "No prior carrier"} · Created {new Date(intake.created_at).toLocaleDateString()}</span></div><span className={`badge intake-${intake.status}`}>{intake.status}</span><div className="coverage-summary"><small>Requested limits</small><b>{intake.requested_bodily_injury || "—"} / PD {intake.requested_property_damage || "—"}</b></div><button className="gold" onClick={() => openQuoteIntake(intake)}>Open worksheet</button></div>)}
          </div></div>
        </>}

        {section === "Quotes" && <>
          {isOperationalStaff && <div className="panel"><h2>New Carrier Quote</h2><form action={addQuote} className="quote-form">
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
          </form>{quoteMessage && <p className="document-message" role="status">{quoteMessage}</p>}</div>}
          <div className="panel"><div className="row"><h2>Carrier Comparison</h2><span className="muted">Lowest monthly price first</span></div><div className="quote-list">
            {quotes.length === 0 && <p className="muted">No quotes saved.</p>}
            {quotes.map((quote,index) => <div className={`quote-card ${index === 0 ? "best" : ""}`} key={quote.id}>
              <div><div className="quote-title"><b>{quote.carrier}</b>{index === 0 && <span className="best-label">Lowest monthly</span>}</div><span>{quote.customers?.full_name ?? "Customer"} · {quote.coverage_summary}</span></div>
              <div className="quote-price"><small>Down</small><b>${Number(quote.down_payment).toFixed(2)}</b></div>
              <div className="quote-price"><small>Monthly</small><b>${Number(quote.monthly_payment).toFixed(2)}</b></div>
              <select value={quote.status} disabled={!isOperationalStaff} onChange={event => setQuoteStatus(quote.id, event.target.value as Quote["status"])}><option value="draft">Draft</option><option value="presented">Presented</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option></select>
            </div>)}
          </div></div>
        </>}

        {section === "Policies" && <>
          {isOperationalStaff && <div className="panel"><h2>Add Policy</h2><form action={addPolicy} className="quote-form">
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
          </form>{policyMessage && <p className="document-message" role="status">{policyMessage}</p>}</div>}
          <div className="panel"><div className="row"><h2>Policy Book</h2><span className="muted">Renewals ordered by expiration</span></div><div className="quote-list">
            {policies.length === 0 && <p className="muted">No policies saved.</p>}
            {policies.map(policy => { const days = policy.expiration_date ? Math.ceil((new Date(`${policy.expiration_date}T12:00:00`).getTime() - Date.now()) / 86400000) : null; return <div className={`policy-card ${days !== null && days <= 30 ? "renewal-due" : ""}`} key={policy.id}>
              <div><b>{policy.customers?.full_name ?? "Customer"}</b><span>{policy.carrier} · #{policy.policy_number}</span><small>{policy.coverage_summary}</small></div>
              <div className="quote-price"><small>Monthly</small><b>${Number(policy.monthly_premium ?? 0).toFixed(2)}</b></div>
              <div className="quote-price"><small>Expires</small><b>{policy.expiration_date ?? "—"}</b><span>{days === null ? "" : days < 0 ? "Expired" : `${days} days`}</span></div>
              <select value={policy.status} disabled={!isOperationalStaff} onChange={event => setPolicyStatus(policy.id,event.target.value)}><option value="active">Active</option><option value="pending">Pending</option><option value="cancel_notice">Cancel notice</option><option value="canceled">Canceled</option><option value="expired">Expired</option><option value="rewritten">Rewritten</option></select>
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

        {section !== "Dashboard" && section !== "Customers" && section !== "Documents" && section !== "Quote Intake" && section !== "Quotes" && section !== "Policies" && section !== "Payments" && section !== "Tasks" && section !== "Employees" && <div className="panel empty">
          <h2>{section}</h2>
          <p>This production module is scaffolded and ready to connect to Supabase.</p>
        </div>}
      </section>

      {showCustomer && <div className="modal">
        <form action={addCustomer}>
          <div className="row"><h2>Add Customer</h2><button type="button" className="close" onClick={() => setShowCustomer(false)}>×</button></div>
          <label>Full Name<input name="name" required /></label>
          <label>Phone<input name="phone" /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Preferred Language<select name="language"><option>English</option><option>Spanish</option></select></label>
          <label>Address<input name="address" /></label>
          <label>Notes<textarea name="notes" /></label>
          <button className="gold" type="submit">Save Customer</button>
        </form>
      </div>}
      {selectedCustomer && <div className="modal customer-modal"><div className="customer-profile" role="dialog" aria-label="Customer profile">
        <div className="row"><div><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.carrier} · {selectedCustomer.status}</p></div><button className="close" onClick={() => setSelectedCustomer(null)}>×</button></div>
        {isOperationalStaff ? <form action={updateCustomer} className="customer-profile-form">
          <label>Full name<input name="name" defaultValue={selectedCustomer.name} required /></label>
          <label>Phone<input name="phone" defaultValue={selectedCustomer.phone} /></label>
          <label>Email<input name="email" type="email" defaultValue={selectedCustomer.email} /></label>
          <label>Preferred language<select name="language" defaultValue={selectedCustomer.preferred_language}><option>English</option><option>Spanish</option></select></label>
          <label className="wide">Address<input name="address" defaultValue={selectedCustomer.address} /></label>
          <label className="wide">Notes<textarea name="notes" defaultValue={selectedCustomer.notes} /></label>
          <button className="gold" type="submit">Save customer</button>
        </form> : <div className="customer-summary"><div><small>Phone</small><b>{selectedCustomer.phone || "—"}</b></div><div><small>Email</small><b>{selectedCustomer.email || "—"}</b></div><div><small>Language</small><b>{selectedCustomer.preferred_language}</b></div><div><small>Address</small><b>{selectedCustomer.address || "—"}</b></div><div className="wide"><small>Notes</small><b>{selectedCustomer.notes || "—"}</b></div></div>}
        <div className="row vehicle-heading"><h3>Drivers</h3><span className="muted">{customerDrivers.length} on file</span></div>
        <div className="driver-list">{customerDrivers.length === 0 && <p className="muted">No drivers added.</p>}{customerDrivers.map(driver => <div className="driver-row" key={driver.id}><div><b>{driver.full_name}</b><span>{driver.relationship.replace("_", " ")} · DOB {driver.date_of_birth || "Not entered"}</span><span>License: {driver.license_state || "—"} ••••{driver.license_last4 || "—"} · {driver.license_status}</span></div>{["owner","manager"].includes(userRole) && <button className="logout" onClick={() => deleteDriver(driver)}>Delete</button>}</div>)}</div>
        {isOperationalStaff && <form action={addDriver} className="driver-form"><label>Full name<input name="full_name" required /></label><label>Date of birth<input name="date_of_birth" type="date" /></label><label>Relationship<select name="relationship" defaultValue="named_insured"><option value="named_insured">Named insured</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option></select></label><label>License state<input name="license_state" maxLength={2} placeholder="AL" /></label><label>License last 4<input name="license_last4" minLength={4} maxLength={4} placeholder="1234" /></label><label>Status<select name="license_status" defaultValue="valid"><option value="valid">Valid</option><option value="permit">Permit</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="unknown">Unknown</option></select></label><button className="gold" type="submit">Add driver</button></form>}
        <div className="row vehicle-heading"><h3>Vehicles</h3><span className="muted">{customerVehicles.length} on file</span></div>
        <div className="vehicle-list">{customerVehicles.length === 0 && <p className="muted">No vehicles added.</p>}{customerVehicles.map(vehicle => <div className="vehicle-row" key={vehicle.id}><div><b>{vehicle.year ?? "—"} {vehicle.make ?? ""} {vehicle.model ?? ""}</b><span>VIN: {vehicle.vin || "Not entered"}</span></div>{isOperationalStaff && <button className="logout" onClick={() => deleteVehicle(vehicle)}>Delete</button>}</div>)}</div>
        {isOperationalStaff && <form action={addVehicle} className="vehicle-form"><label>Year<input name="year" type="number" min="1900" max="2100" /></label><label>Make<input name="make" /></label><label>Model<input name="model" /></label><label>VIN<input name="vin" maxLength={17} /></label><button className="gold" type="submit">Add vehicle</button></form>}
        <div className="row activity-heading"><h3>Customer Activity</h3><span className="muted">Newest first</span></div>
        <div className="activity-list">{customerActivity.length === 0 && <p className="muted">No customer activity recorded.</p>}{customerActivity.map(activity => <div className="activity-row" key={activity.id}><span className={`activity-type ${activity.type.toLowerCase()}`}>{activity.type}</span><div><b>{activity.title}</b><span>{activity.detail}</span></div><time>{new Date(activity.date).toLocaleString()}</time></div>)}</div>
        {customerMessage && <p className="document-message" role="status">{customerMessage}</p>}
      </div></div>}
      {selectedIntake && <div className="modal customer-modal"><div className="customer-profile intake-workspace" role="dialog" aria-label="Quote intake worksheet">
        <div className="row"><div><h2>{selectedIntake.customers?.full_name ?? "Customer"}</h2><p>Auto Quote Intake Worksheet</p></div><button className="close" onClick={() => { setSelectedIntake(null); setIntakeMessage(""); }}>×</button></div>
        <div className="intake-assets"><div><small>Drivers</small><b>{intakeDrivers.length}</b><span>{intakeDrivers.map(driver => driver.full_name).join(", ") || "None"}</span></div><div><small>Vehicles</small><b>{intakeVehicles.length}</b><span>{intakeVehicles.map(vehicle => `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()).join(", ") || "None"}</span></div></div>
        {isOperationalStaff ? <form action={updateQuoteIntake} className="intake-form workspace-form">
          <label>Status<select name="status" defaultValue={selectedIntake.status}><option value="draft">Draft</option><option value="ready">Ready for carriers</option><option value="quoted">Quoted</option><option value="bound">Bound</option><option value="closed">Closed</option></select></label>
          <label>Bodily injury limits<input name="requested_bodily_injury" defaultValue={selectedIntake.requested_bodily_injury ?? ""} /></label>
          <label>Property damage<input name="requested_property_damage" defaultValue={selectedIntake.requested_property_damage ?? ""} /></label>
          <label>Comprehensive deductible<input name="comprehensive_deductible" type="number" min="0" defaultValue={selectedIntake.comprehensive_deductible ?? ""} /></label>
          <label>Collision deductible<input name="collision_deductible" type="number" min="0" defaultValue={selectedIntake.collision_deductible ?? ""} /></label>
          <label>Prior carrier<input name="prior_carrier" defaultValue={selectedIntake.prior_carrier ?? ""} /></label>
          <label>Prior policy expiration<input name="prior_policy_expiration" type="date" defaultValue={selectedIntake.prior_policy_expiration ?? ""} /></label>
          <label>Continuous coverage (months)<input name="continuous_coverage_months" type="number" min="0" defaultValue={selectedIntake.continuous_coverage_months ?? ""} /></label>
          <label>Lapse days<input name="lapse_days" type="number" min="0" defaultValue={selectedIntake.lapse_days} /></label>
          <label className="wide">Garaging address<input name="garaging_address" defaultValue={selectedIntake.garaging_address ?? ""} /></label>
          <div className="intake-checks"><label><input name="uninsured_motorist" type="checkbox" defaultChecked={selectedIntake.uninsured_motorist} /> Uninsured motorist</label><label><input name="roadside_assistance" type="checkbox" defaultChecked={selectedIntake.roadside_assistance} /> Roadside assistance</label><label><input name="rental_reimbursement" type="checkbox" defaultChecked={selectedIntake.rental_reimbursement} /> Rental reimbursement</label><label><input name="homeowner" type="checkbox" defaultChecked={selectedIntake.homeowner} /> Homeowner</label></div>
          <label className="wide">Vehicle usage notes<textarea name="usage_notes" defaultValue={selectedIntake.usage_notes ?? ""} /></label>
          <label className="wide">Internal notes<textarea name="internal_notes" defaultValue={selectedIntake.internal_notes ?? ""} /></label>
          <button className="gold" type="submit">Save worksheet</button>
        </form> : <div className="customer-summary"><div><small>Status</small><b>{selectedIntake.status}</b></div><div><small>Coverage</small><b>{selectedIntake.requested_bodily_injury || "—"} / {selectedIntake.requested_property_damage || "—"}</b></div><div><small>Prior carrier</small><b>{selectedIntake.prior_carrier || "—"}</b></div><div><small>Lapse</small><b>{selectedIntake.lapse_days} days</b></div></div>}
        <div className="row incident-heading"><h3>Accidents, Violations and Claims</h3><span className="muted">{drivingIncidents.length} recorded</span></div>
        <div className="incident-list">{drivingIncidents.length === 0 && <p className="muted">No incidents reported.</p>}{drivingIncidents.map(incident => <div className="incident-row" key={incident.id}><div><b>{incident.incident_type}</b><span>{incident.drivers?.full_name ?? "Unassigned driver"} · {incident.incident_date || "No date"}</span><small>{incident.description || "No description"}{incident.at_fault ? " · At fault" : ""}</small></div>{["owner","manager"].includes(userRole) && <button className="logout" onClick={() => deleteDrivingIncident(incident)}>Delete</button>}</div>)}</div>
        {isOperationalStaff && <form action={addDrivingIncident} className="incident-form"><label>Driver<select name="driver_id" defaultValue=""><option value="">Unassigned</option>{intakeDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}</select></label><label>Type<select name="incident_type" defaultValue="accident"><option value="accident">Accident</option><option value="violation">Violation</option><option value="claim">Claim</option><option value="suspension">Suspension</option><option value="other">Other</option></select></label><label>Date<input name="incident_date" type="date" /></label><label>Estimated amount<input name="estimated_amount" type="number" min="0" step="0.01" /></label><label className="wide">Description<input name="description" /></label><label className="check-label"><input name="at_fault" type="checkbox" /> At fault</label><button className="gold" type="submit">Add incident</button></form>}
        {intakeMessage && <p className="document-message" role="status">{intakeMessage}</p>}
      </div></div>}
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

function CustomerTable({customers,onSelect}:{customers:Customer[];onSelect?:(id:string)=>void}) {
  return <div className="table">
    <div className="tr th"><span>Customer</span><span>Phone</span><span>Carrier</span><span>Status</span></div>
    {customers.map(c => <button type="button" className="tr customer-link" key={c.id} onClick={() => onSelect?.(c.id)}>
      <b>{c.name}</b><span>{c.phone}</span><span>{c.carrier}</span><span className={`badge ${c.status.replace(" ","-").toLowerCase()}`}>{c.status}</span>
    </button>)}
  </div>;
}
