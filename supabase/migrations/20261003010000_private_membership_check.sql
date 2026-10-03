-- Move the membership check out of the API-exposed public schema.
-- Policies are altered in place (no drops). The old public function stays but nobody can call it.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid()
  );
$$;
revoke execute on function private.is_tenant_member(uuid) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated, service_role;

alter policy tenants_member_read on tenants to authenticated using (private.is_tenant_member(id));
alter policy sites_member_read on sites to authenticated using (private.is_tenant_member(tenant_id));
alter policy pages_member_read on pages to authenticated using (private.is_tenant_member(tenant_id));
alter policy chunks_member_read on chunks to authenticated using (private.is_tenant_member(tenant_id));
alter policy api_keys_member_read on api_keys to authenticated using (private.is_tenant_member(tenant_id));
alter policy tool_calls_member_read on tool_calls to authenticated using (private.is_tenant_member(tenant_id));

revoke execute on function public.is_tenant_member(uuid) from public, anon, authenticated;
