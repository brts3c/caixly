-- Planos, limites e endurecimento do RBAC do Caixly.
alter table public.products
  add column if not exists description text not null default '',
  add column if not exists emoji text not null default '•';

alter table public.tenants
  add column if not exists max_cashier_discount_percent numeric(5,2) not null default 5
  check (max_cashier_discount_percent between 0 and 100);

update public.subscriptions set plan_code = 'free' where plan_code is null;
alter table public.subscriptions alter column plan_code set default 'free';
alter table public.subscriptions alter column plan_code set not null;
alter table public.subscriptions drop constraint if exists subscriptions_plan_code_check;
alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('free', 'essential', 'professional', 'unlimited'));

insert into public.subscriptions(tenant_id, plan_code, status)
select t.id, 'free', 'trialing'
from public.tenants t
where not exists (select 1 from public.subscriptions s where s.tenant_id = t.id);

create or replace function public.plan_product_limit(requested_tenant uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(
    (select plan_code from public.subscriptions where tenant_id = requested_tenant),
    'free'
  )
    when 'free' then 5
    when 'essential' then 15
    when 'professional' then 30
    when 'unlimited' then null
    else 5
  end;
$$;

create or replace function public.enforce_product_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_limit integer;
  current_count integer;
begin
  product_limit := public.plan_product_limit(new.tenant_id);
  if product_limit is null then
    return new;
  end if;

  select count(*) into current_count
  from public.products
  where tenant_id = new.tenant_id
    and (tg_op = 'INSERT' or id <> new.id);

  if current_count >= product_limit then
    raise exception 'Limite de % produtos atingido para o plano atual', product_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists products_enforce_plan_limit on public.products;
create trigger products_enforce_plan_limit
before insert or update of tenant_id on public.products
for each row execute function public.enforce_product_plan_limit();

create or replace function public.protect_product_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.store_id is distinct from old.store_id then
    raise exception 'Produto não pode ser movido entre empresas ou filiais';
  end if;

  if not public.has_tenant_role(old.tenant_id, array['admin']::public.tenant_role[]) then
    if new.name is distinct from old.name
      or new.sku is distinct from old.sku
      or new.category is distinct from old.category
      or new.sale_price is distinct from old.sale_price
      or new.cost_price is distinct from old.cost_price
      or new.description is distinct from old.description
      or new.emoji is distinct from old.emoji then
      raise exception 'Somente o administrador pode alterar cadastro e preço-base';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_protect_fields on public.products;
create trigger products_protect_fields
before update on public.products
for each row execute function public.protect_product_fields();

create or replace function public.protect_sale_discount()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_percent numeric(5,2);
begin
  if public.has_tenant_role(new.tenant_id, array['admin','manager']::public.tenant_role[]) then
    return new;
  end if;

  select max_cashier_discount_percent into max_percent
  from public.tenants where id = new.tenant_id;

  if new.subtotal > 0 and new.discount > (new.subtotal * coalesce(max_percent, 0) / 100) then
    raise exception 'Desconto acima do limite do operador exige aprovação';
  end if;
  return new;
end;
$$;

drop trigger if exists sales_protect_discount on public.sales;
create trigger sales_protect_discount
before insert or update of subtotal, discount on public.sales
for each row execute function public.protect_sale_discount();

-- Novas empresas sempre começam vazias, no plano gratuito.
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
  if exists (
    select 1 from public.tenant_memberships
    where user_id = auth.uid() and active
  ) then
    raise exception 'Este usuário já pertence a uma empresa';
  end if;

  insert into public.tenants(legal_name, trade_name)
  values (trim(company_legal_name), trim(company_trade_name))
  returning id into new_tenant_id;

  insert into public.tenant_memberships(tenant_id, user_id, role)
  values (new_tenant_id, auth.uid(), 'admin');

  insert into public.stores(tenant_id, name)
  values (new_tenant_id, trim(first_store_name));

  insert into public.subscriptions(tenant_id, plan_code, status)
  values (new_tenant_id, 'free', 'trialing');

  insert into public.audit_logs(tenant_id, actor_user_id, action, entity_type, entity_id)
  values (new_tenant_id, auth.uid(), 'tenant.created', 'tenant', new_tenant_id::text);

  return new_tenant_id;
end;
$$;

drop policy if exists memberships_read_tenant on public.tenant_memberships;
create policy memberships_read_scoped on public.tenant_memberships
for select to authenticated using (
  user_id = auth.uid()
  or public.is_platform_owner()
  or public.has_tenant_role(tenant_id, array['admin','manager']::public.tenant_role[])
);

drop policy if exists stores_read_member on public.stores;
create policy stores_read_scoped on public.stores
for select to authenticated using (
  public.is_platform_owner()
  or public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
  or public.has_store_access(id)
);

drop policy if exists sales_read_store on public.sales;
create policy sales_read_scoped on public.sales
for select to authenticated using (
  operator_user_id = auth.uid()
  or public.has_store_access(store_id, array['manager']::public.tenant_role[])
);

drop policy if exists sales_update_store on public.sales;
create policy sales_update_scoped on public.sales
for update to authenticated
using (
  operator_user_id = auth.uid()
  or public.has_store_access(store_id, array['manager']::public.tenant_role[])
)
with check (
  operator_user_id = auth.uid()
  or public.has_store_access(store_id, array['manager']::public.tenant_role[])
);

drop policy if exists products_insert_management on public.products;
create policy products_insert_admin on public.products
for insert to authenticated
with check (
  public.has_tenant_role(tenant_id, array['admin']::public.tenant_role[])
);

grant execute on function public.plan_product_limit(uuid) to authenticated;
