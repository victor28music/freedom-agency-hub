create extension if not exists "pgcrypto";

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete cascade,
  full_name text,
  role text not null default 'agent' check (role in ('owner','manager','agent','csr','accounting')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  preferred_language text default 'English',
  address text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  year integer,
  make text,
  model text,
  vin text,
  created_at timestamptz not null default now()
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  carrier text,
  policy_number text,
  effective_date date,
  expiration_date date,
  monthly_premium numeric(10,2),
  status text default 'active',
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(10,2) not null,
  agency_fee numeric(10,2) default 0,
  method text,
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.policies enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "Members can view their agency" on public.agencies for select
using (id = (select agency_id from public.profiles where id = auth.uid()));
create policy "Members can view their own profile" on public.profiles for select using (id = auth.uid());

create policy "Agency members can view customers"
on public.customers for select
using (agency_id = (select agency_id from public.profiles where id = auth.uid()));

create policy "Agency members can add customers"
on public.customers for insert
with check (agency_id = (select agency_id from public.profiles where id = auth.uid()));

create policy "Agency members can update customers"
on public.customers for update
using (agency_id = (select agency_id from public.profiles where id = auth.uid()));

create policy "Agency members can view vehicles" on public.vehicles for select using (
  exists (select 1 from public.customers c where c.id = customer_id and c.agency_id = (select agency_id from public.profiles where id = auth.uid()))
);
create policy "Agency members can manage vehicles" on public.vehicles for all using (
  exists (select 1 from public.customers c where c.id = customer_id and c.agency_id = (select agency_id from public.profiles where id = auth.uid()))
) with check (
  exists (select 1 from public.customers c where c.id = customer_id and c.agency_id = (select agency_id from public.profiles where id = auth.uid()))
);
create policy "Agency members can view policies" on public.policies for select using (agency_id = (select agency_id from public.profiles where id = auth.uid()));
create policy "Agency members can manage policies" on public.policies for all using (agency_id = (select agency_id from public.profiles where id = auth.uid())) with check (agency_id = (select agency_id from public.profiles where id = auth.uid()));
create policy "Agency members can view payments" on public.payments for select using (agency_id = (select agency_id from public.profiles where id = auth.uid()));
create policy "Authorized staff can add payments" on public.payments for insert with check (
  agency_id = (select agency_id from public.profiles where id = auth.uid()) and
  (select role from public.profiles where id = auth.uid()) in ('owner','manager','agent','csr','accounting')
);
create policy "Owners and managers can view audit logs" on public.audit_logs for select using (
  agency_id = (select agency_id from public.profiles where id = auth.uid()) and
  (select role from public.profiles where id = auth.uid()) in ('owner','manager')
);

create index customers_agency_id_idx on public.customers(agency_id);
create index policies_agency_id_idx on public.policies(agency_id);
create index policies_customer_id_idx on public.policies(customer_id);
create index payments_agency_id_idx on public.payments(agency_id);
create index vehicles_customer_id_idx on public.vehicles(customer_id);
