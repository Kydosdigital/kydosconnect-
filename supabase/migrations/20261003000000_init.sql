-- Kydos Connect: Phase 1 schema (Read tier)
-- Every tenant-owned table carries tenant_id and has row-level security enabled.
-- The MCP server and crawler use the service role (which bypasses RLS) and always
-- filter by tenant_id explicitly; RLS protects any future dashboard access via the anon key.

-- Supabase keeps extensions in their own schema
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Plans map to the three tiers: read (Starter), measure (Growth), manage (Pro)
create type plan_tier as enum ('starter', 'growth', 'pro');
create type crawl_status as enum ('pending', 'crawling', 'ready', 'failed');

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null,
  plan plan_tier not null default 'starter',
  -- Business profile, served by get_business_info
  profile jsonb not null default '{}'::jsonb,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- Links Supabase Auth users to tenants (owners, agency staff)
create table tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'agency', 'viewer')),
  primary key (tenant_id, user_id)
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  url text not null,
  cms_type text not null default 'unknown',
  max_pages int not null default 100,
  crawl_status crawl_status not null default 'pending',
  last_crawled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (tenant_id, url)
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  url text not null,
  title text,
  description text,
  markdown text not null,
  content_hash text not null,
  updated_at timestamptz not null default now(),
  unique (site_id, url)
);
create index pages_tenant_idx on pages (tenant_id);

create table chunks (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  page_id uuid not null references pages(id) on delete cascade,
  chunk_index int not null,
  heading text,
  content text not null,
  embedding vector(1536) not null
);
create index chunks_tenant_idx on chunks (tenant_id);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

-- MCP access keys. Only a SHA-256 hash is stored; the raw key is shown once at creation.
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  label text not null default 'default',
  key_prefix text not null,
  key_hash text not null unique,
  revoked boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every MCP tool call, for analytics, billing and audit
create table tool_calls (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  api_key_id uuid references api_keys(id) on delete set null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  client_name text,
  ok boolean not null,
  error text,
  latency_ms int not null,
  created_at timestamptz not null default now()
);
create index tool_calls_tenant_time_idx on tool_calls (tenant_id, created_at desc);

-- Semantic search scoped to one tenant
create or replace function match_chunks(
  p_tenant_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 6
)
returns table (
  page_id uuid,
  url text,
  title text,
  heading text,
  content text,
  similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select c.page_id, p.url, p.title, c.heading, c.content,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from chunks c
  join pages p on p.id = c.page_id
  where c.tenant_id = p_tenant_id
  order by c.embedding <=> p_query_embedding
  limit least(p_match_count, 20);
$$;

-- Row-level security: members can read their own tenant's data
create or replace function is_tenant_member(p_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from tenant_members
    where tenant_id = p_tenant_id and user_id = auth.uid()
  );
$$;

alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table sites enable row level security;
alter table pages enable row level security;
alter table chunks enable row level security;
alter table api_keys enable row level security;
alter table tool_calls enable row level security;

create policy tenants_member_read on tenants for select using (is_tenant_member(id));
create policy members_self_read on tenant_members for select using (user_id = auth.uid());
create policy sites_member_read on sites for select using (is_tenant_member(tenant_id));
create policy pages_member_read on pages for select using (is_tenant_member(tenant_id));
create policy chunks_member_read on chunks for select using (is_tenant_member(tenant_id));
create policy api_keys_member_read on api_keys for select using (is_tenant_member(tenant_id));
create policy tool_calls_member_read on tool_calls for select using (is_tenant_member(tenant_id));

-- match_chunks is only called server-side with the service role
revoke execute on function match_chunks(uuid, vector, int) from public, anon, authenticated;
grant execute on function match_chunks(uuid, vector, int) to service_role;
