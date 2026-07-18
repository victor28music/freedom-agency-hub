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

export default function Home() {
  const [section, setSection] = useState("Dashboard");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");

  const filtered = useMemo(
    () => customers.filter(c => `${c.name} ${c.phone} ${c.carrier}`.toLowerCase().includes(search.toLowerCase())),
    [customers, search]
  );

  useEffect(() => {
    const supabase = createClient();
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

  return (
    <main className="shell">
      <aside>
        <div className="brand"><div className="logo">F</div><div><b>Freedom Agency Hub</b><span>Freedom Auto Insurance</span></div></div>
        <nav>
          {["Dashboard","Customers","Documents","Quotes","Policies","Payments","Tasks"].map(item =>
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
            <Metric label="New Leads" value="18" note="+6 today" />
            <Metric label="Quotes in Progress" value="11" note="4 need follow-up" />
            <Metric label="Renewals Due" value="23" note="Next 30 days" />
            <Metric label="Collected Today" value="$4,860" note="12 payments" />
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
              <button className="logout" onClick={() => openDocument(document.storage_path)}>Open</button>
            </div>)}
          </div></div>
        </>}

        {section !== "Dashboard" && section !== "Customers" && section !== "Documents" && <div className="panel empty">
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
