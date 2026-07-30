create extension if not exists pgcrypto;

create type public.tenant_role as enum ('admin', 'manager', 'cashier');
create type public.sale_status as enum ('open', 'paid', 'cancelled', 'refunded');
create type public.cash_session_status as enum ('open', 'closed');
create type public.stock_movement_kind as enum ('purchase', 'sale', 'adjustment', 'loss', 'return');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Separado das funções dos clientes. Não existe caminho público para promover
-- alguém a dono da plataforma.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text not null,
  document text,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'blocked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  document text,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.store_memberships (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  stock_quantity numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  operator_user_id uuid not null references auth.users(id) on delete restrict,
  status public.cash_session_status not null default 'open',
  opening_amount numeric(12,2) not null default 0 check (opening_amount >= 0),
  closing_amount numeric(12,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict
);

create unique index one_open_cash_session_per_operator
  on public.cash_sessions(store_id, operator_user_id)
  where status = 'open';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  cash_session_id uuid references public.cash_sessions(id) on delete restrict,
  operator_user_id uuid not null references auth.users(id) on delete restrict,
  status public.sale_status not null default 'open',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  cancellation_reason text,
  cancelled_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  product_name text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  method text not null check (method in ('cash', 'pix', 'credit_card', 'debit_card', 'voucher', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  kind public.stock_movement_kind not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  reason text,
  sale_id uuid references public.sales(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  model text not null,
  status text not null check (status in ('processing', 'authorized', 'cancelled', 'rejected')),
  access_key text,
  provider_reference text,
  payload jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sale_id, model)
);

create table public.subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  provider text not null default 'stripe',
  customer_id text unique,
  subscription_id text unique,
  plan_code text,
  status text not null default 'trialing',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index tenant_memberships_user_idx on public.tenant_memberships(user_id, active);
create index stores_tenant_idx on public.stores(tenant_id);
create index products_tenant_store_idx on public.products(tenant_id, store_id, active);
create index sales_tenant_store_created_idx on public.sales(tenant_id, store_id, created_at desc);
create index stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger tenant_memberships_set_updated_at before update on public.tenant_memberships
for each row execute function public.set_updated_at();
create trigger stores_set_updated_at before update on public.stores
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(
  requested_tenant uuid,
  allowed_roles public.tenant_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = requested_tenant
      and tm.user_id = auth.uid()
      and tm.active
      and (allowed_roles is null or tm.role = any(allowed_roles))
  );
$$;

create or replace function public.has_store_access(
  requested_store uuid,
  allowed_roles public.tenant_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.tenant_memberships tm
      on tm.tenant_id = s.tenant_id
     and tm.user_id = auth.uid()
     and tm.active
    where s.id = requested_store
      and (
        tm.role = 'admin'
        or (
          (allowed_roles is null or tm.role = any(allowed_roles))
          and exists (
            select 1 from public.store_memberships sm
            where sm.store_id = s.id and sm.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.create_tenant_with_owner(
  company_legal_name text,
  company_trade_name text,
  first_store_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.tenants(legal_name, trade_name)
  values (company_legal_name, company_trade_name)
  returning id into new_tenant_id;

  insert into public.tenant_memberships(tenant_id, user_id, role)
  values (new_tenant_id, auth.uid(), 'admin');

  insert into public.stores(tenant_id, name)
  values (new_tenant_id, first_store_name);

  insert into public.audit_logs(tenant_id, actor_user_id, action, entity_type, entity_id)
  values (new_tenant_id, auth.uid(), 'tenant.created', 'tenant', new_tenant_id::text);

  return new_tenant_id;
end;
$$;

create or replace function public.protect_paid_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.store_id is distinct from old.store_id
    or new.operator_user_id is distinct from old.operator_user_id then
    raise exception 'Sale identity cannot be rewritten';
  end if;

  if old.status = 'open' and new.status = 'refunded' then
    raise exception 'An open sale cannot be refunded';
  end if;

  if old.status = 'open' and new.status = 'cancelled' then
    if not public.has_tenant_role(old.tenant_id, array['admin','manager']::public.tenant_role[]) then
      raise exception 'Manager approval required';
    end if;
    if nullif(trim(new.cancellation_reason), '') is null then
      raise exception 'Cancellation reason is required';
    end if;
    new.cancelled_by = auth.uid();
    new.cancelled_at = now();
  end if;

  if old.status in ('paid', 'cancelled', 'refunded') then
    if new.subtotal is distinct from old.subtotal
      or new.discount is distinct from old.discount
      or new.total is distinct from old.total then
      raise exception 'Finalized sale totals cannot be rewritten';
    end if;
    if new.status = old.status then
      raise exception 'Finalized sales are immutable';
    end if;
    if not public.has_tenant_role(old.tenant_id, array['admin','manager']::public.tenant_role[]) then
      raise exception 'Manager approval required';
    end if;
    if new.status not in ('cancelled', 'refunded') or nullif(trim(new.cancellation_reason), '') is null then
      raise exception 'Cancellation or refund reason is required';
    end if;
    new.cancelled_by = auth.uid();
    new.cancelled_at = now();
  end if;
  return new;
end;
$$;

create trigger sales_protect_finalized
before update on public.sales
for each row execute function public.protect_paid_sale();

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
alter table public.products enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_self_or_colleague on public.profiles
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_owner()
  or exists (
    select 1
    from public.tenant_memberships mine
    join public.tenant_memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid() and mine.active and theirs.user_id = profiles.user_id
  )
);
create policy profiles_update_self on public.profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy platform_admins_read_self on public.platform_admins
for select to authenticated using (user_id = auth.uid());

create policy tenants_read_member on public.tenants
for select to authenticated using (public.is_platform_owner() or public.has_tenant_role(id));
create policy tenants_update_admin on public.tenants
for update to authenticated
using (public.has_tenant_role(id, array['admin']::public.tenant_role[]))
with check (public.has_tenant_role(id, array['admin']::public.tenant_role[]));

create policy memberships_read_tenant on public.tenant_memberships
for select to authenticated using (public.has_tenant_role(tenant_id));
create policy memberships_insert_admin on public.tenant_memberships
for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]));
create policy memberships_update_admin on public.tenant_memberships
for update to authenticated
using (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]))
with check (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]));
create policy memberships_delete_admin on public.tenant_memberships
for delete to authenticated
using (
  user_id <> auth.uid()
  and public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
);

create policy stores_read_member on public.stores
for select to authenticated using (public.has_tenant_role(tenant_id));
create policy stores_insert_admin on public.stores
for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]));
create policy stores_update_admin on public.stores
for update to authenticated
using (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]))
with check (public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[]));

create policy store_memberships_read_tenant on public.store_memberships
for select to authenticated
using (public.has_store_access(store_id));
create policy store_memberships_write_admin on public.store_memberships
for all to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id = store_id
      and public.has_tenant_role(s.tenant_id, array['admin']::public.tenant_role[])
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id = store_id
      and public.has_tenant_role(s.tenant_id, array['admin']::public.tenant_role[])
  )
);

create policy products_read_store on public.products
for select to authenticated
using (
  (store_id is null and public.has_tenant_role(tenant_id))
  or (store_id is not null and public.has_store_access(store_id))
);
create policy products_insert_management on public.products
for insert to authenticated
with check (
  public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
  or (store_id is not null and public.has_store_access(store_id, array['manager']::public.tenant_role[]))
);
create policy products_update_management on public.products
for update to authenticated
using (
  public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
  or (store_id is not null and public.has_store_access(store_id, array['manager']::public.tenant_role[]))
)
with check (
  public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
  or (store_id is not null and public.has_store_access(store_id, array['manager']::public.tenant_role[]))
);

create policy cash_sessions_read_store on public.cash_sessions
for select to authenticated using (public.has_store_access(store_id));
create policy cash_sessions_open_assigned on public.cash_sessions
for insert to authenticated
with check (operator_user_id = auth.uid() and public.has_store_access(store_id));
create policy cash_sessions_close_management on public.cash_sessions
for update to authenticated
using (public.has_store_access(store_id, array['manager']::public.tenant_role[]))
with check (public.has_store_access(store_id));

create policy sales_read_store on public.sales
for select to authenticated using (public.has_store_access(store_id));
create policy sales_insert_assigned on public.sales
for insert to authenticated
with check (operator_user_id = auth.uid() and public.has_store_access(store_id));
create policy sales_update_store on public.sales
for update to authenticated
using (public.has_store_access(store_id))
with check (public.has_store_access(store_id));

create policy sale_items_read_store on public.sale_items
for select to authenticated
using (
  exists (select 1 from public.sales s where s.id = sale_id and public.has_store_access(s.store_id))
);
create policy sale_items_insert_open_sale on public.sale_items
for insert to authenticated
with check (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.status = 'open'
      and s.operator_user_id = auth.uid() and public.has_store_access(s.store_id)
  )
);
create policy sale_items_change_open_sale on public.sale_items
for update to authenticated
using (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.status = 'open'
      and s.operator_user_id = auth.uid() and public.has_store_access(s.store_id)
  )
)
with check (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.status = 'open'
      and s.operator_user_id = auth.uid() and public.has_store_access(s.store_id)
  )
);
create policy sale_items_delete_open_sale on public.sale_items
for delete to authenticated
using (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.status = 'open'
      and s.operator_user_id = auth.uid() and public.has_store_access(s.store_id)
  )
);

create policy payments_read_store on public.payments
for select to authenticated
using (
  exists (select 1 from public.sales s where s.id = sale_id and public.has_store_access(s.store_id))
);
create policy payments_insert_open_sale on public.payments
for insert to authenticated
with check (
  exists (
    select 1 from public.sales s
    where s.id = sale_id and s.status = 'open'
      and s.operator_user_id = auth.uid() and public.has_store_access(s.store_id)
  )
);

create policy stock_read_store on public.stock_movements
for select to authenticated using (public.has_store_access(store_id));
create policy stock_insert_management on public.stock_movements
for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
    or public.has_store_access(store_id, array['manager']::public.tenant_role[])
  )
);

create policy fiscal_read_management on public.fiscal_documents
for select to authenticated
using (
  public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
  or public.has_store_access(store_id, array['manager']::public.tenant_role[])
);

create policy subscriptions_read_admin on public.subscriptions
for select to authenticated
using (
  public.is_platform_owner()
  or public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
);

create policy audit_read_admin on public.audit_logs
for select to authenticated
using (
  public.is_platform_owner()
  or public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
);
create policy audit_insert_member on public.audit_logs
for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and (tenant_id is null or public.has_tenant_role(tenant_id))
  and (store_id is null or public.has_store_access(store_id))
);

revoke all on function public.create_tenant_with_owner(text, text, text) from public;
grant execute on function public.create_tenant_with_owner(text, text, text) to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.has_tenant_role(uuid, public.tenant_role[]) to authenticated;
grant execute on function public.has_store_access(uuid, public.tenant_role[]) to authenticated;
