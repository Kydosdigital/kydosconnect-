-- Move the membership check out of the API-exposed public schema.
-- RLS policies still call it, but it can no longer be invoked via /rest/v1/rpc.

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

drop policy tenants_member_read on tenants;
drop policy sites_member_read on sites;
drop policy pages_member_read on pages;
drop policy chunks_member_read on chunks;
drop policy api_keys_member_read on api_keys;
drop policy tool_calls_member_read on tool_calls;

create policy tenants_member_read on tenants for select to authenticated using (private.is_tenant_member(id));
create policy sites_member_read on sites for select to authenticated using (private.is_tenant_member(tenant_id));
create policy pages_member_read on pages for select to authenticated using (private.is_tenant_member(tenant_id));
create policy chunks_member_read on chunks for select to authenticated using (private.is_tenant_member(tenant_id));
create policy api_keys_member_read on api_keys for select to authenticated using (private.is_tenant_member(tenant_id));
create policy tool_calls_member_read on tool_calls for select to authenticated using (private.is_tenant_member(tenant_id));

drop function public.is_tenant_member(uuid);
