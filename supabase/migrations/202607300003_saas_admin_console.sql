-- Console seguro do único Super Admin da plataforma.
create or replace function public.platform_manage_tenant(
  target_tenant uuid,
  new_status text,
  new_plan_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  old_plan text;
  next_subscription_status text;
begin
  if not public.is_platform_owner() then
    raise exception 'Acesso exclusivo do Super Admin';
  end if;

  if new_status not in ('trial', 'active', 'past_due', 'blocked', 'cancelled') then
    raise exception 'Status de empresa inválido';
  end if;

  if new_plan_code not in ('free', 'essential', 'professional', 'unlimited') then
    raise exception 'Plano inválido';
  end if;

  select status into old_status
  from public.tenants
  where id = target_tenant
  for update;

  if old_status is null then
    raise exception 'Empresa não encontrada';
  end if;

  select plan_code into old_plan
  from public.subscriptions
  where tenant_id = target_tenant;

  next_subscription_status := case
    when new_status = 'trial' then 'trialing'
    when new_status = 'active' then 'active'
    when new_status in ('past_due', 'blocked') then 'past_due'
    when new_status = 'cancelled' then 'canceled'
  end;

  update public.tenants
  set status = new_status
  where id = target_tenant;

  insert into public.subscriptions(tenant_id, plan_code, status)
  values (target_tenant, new_plan_code, next_subscription_status)
  on conflict (tenant_id) do update
  set plan_code = excluded.plan_code,
      status = excluded.status;

  insert into public.audit_logs(
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  values (
    target_tenant,
    auth.uid(),
    'platform.tenant.updated',
    'tenant',
    target_tenant::text,
    jsonb_build_object(
      'old_status', old_status,
      'new_status', new_status,
      'old_plan', coalesce(old_plan, 'free'),
      'new_plan', new_plan_code
    )
  );
end;
$$;

revoke all on function public.platform_manage_tenant(uuid, text, text) from public;
grant execute on function public.platform_manage_tenant(uuid, text, text) to authenticated;
