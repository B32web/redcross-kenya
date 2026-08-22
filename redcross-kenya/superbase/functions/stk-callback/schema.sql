-- =============================================================
-- RED CROSS KENYA – AID DISTRIBUTION SCHEMA
-- =============================================================

-- AID APPLICATIONS
create table if not exists public.aid_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  full_name text not null,
  phone text not null,
  location text not null,
  description text,
  tier integer not null check (tier between 1 and 5),
  tier_label text not null,
  aid_amount integer not null,
  registration_fee integer not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'pending_review', 'reviewing', 'approved', 'active', 'delivered', 'rejected', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  updated_at timestamptz not null default now()
);

-- PAYMENTS
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.aid_applications(id),
  amount integer not null,
  phone text not null,
  donor_name text,
  payment_type text not null check (payment_type in ('registration_fee', 'monthly_aid')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  checkout_request_id text,
  mpesa_receipt text,
  result_code text,
  result_desc text,
  raw_request_response jsonb,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INDEXES
create index if not exists aid_applications_phone_idx on public.aid_applications (phone);
create index if not exists aid_applications_status_idx on public.aid_applications (status);
create index if not exists aid_applications_expires_at_idx on public.aid_applications (expires_at);
create index if not exists payments_application_id_idx on public.payments (application_id);
create index if not exists payments_phone_status_idx on public.payments (phone, status);

-- RLS POLICIES
alter table public.aid_applications enable row level security;
alter table public.payments enable row level security;

create policy "aid_applications: anyone can insert" on public.aid_applications for insert with check (true);
create policy "aid_applications: anyone can read" on public.aid_applications for select using (true);

create policy "payments: anyone can insert" on public.payments for insert with check (true);
create policy "payments: anyone can read" on public.payments for select using (true);

-- AUTO-CLOSE EXPIRED APPLICATIONS
create or replace function public.close_expired_applications()
returns void as $$
begin
  update public.aid_applications
  set 
    status = 'closed',
    updated_at = now()
  where 
    status not in ('delivered', 'closed', 'rejected', 'active')
    and expires_at < now();
end;
$$ language plpgsql;