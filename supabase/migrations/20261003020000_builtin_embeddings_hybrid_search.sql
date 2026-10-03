-- Switch to Supabase's built-in gte-small embeddings (384 dimensions, no external API)
-- and add keyword search, combined with vector search for better answers on exact terms
-- such as prices, product names and postcodes.

alter table chunks alter column embedding type extensions.vector(384);

alter table chunks
  add column fts tsvector
  generated always as (to_tsvector('english', coalesce(heading, '') || ' ' || content)) stored;
create index chunks_fts_idx on chunks using gin (fts);

-- Hybrid search: reciprocal rank fusion of vector similarity and keyword match, one tenant only
create or replace function search_chunks(
  p_tenant_id uuid,
  p_query_embedding extensions.vector(384),
  p_query_text text,
  p_match_count int default 5
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
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> p_query_embedding) as rank,
           1 - (c.embedding <=> p_query_embedding) as similarity
    from chunks c
    where c.tenant_id = p_tenant_id
    order by c.embedding <=> p_query_embedding
    limit 30
  ),
  keyword as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.fts, websearch_to_tsquery('english', regexp_replace(trim(p_query_text), '\s+', ' or ', 'g'))) desc
           ) as rank
    from chunks c
    where c.tenant_id = p_tenant_id
      and c.fts @@ websearch_to_tsquery('english', regexp_replace(trim(p_query_text), '\s+', ' or ', 'g'))
    limit 30
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (50 + s.rank), 0) + coalesce(1.0 / (50 + k.rank), 0) as score,
           s.similarity
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select c.page_id, p.url, p.title, c.heading, c.content, coalesce(f.similarity, 0)::float
  from fused f
  join chunks c on c.id = f.id
  join pages p on p.id = c.page_id
  order by f.score desc
  limit least(p_match_count, 20);
$$;

revoke execute on function search_chunks(uuid, extensions.vector, text, int) from public, anon, authenticated;
grant execute on function search_chunks(uuid, extensions.vector, text, int) to service_role;
