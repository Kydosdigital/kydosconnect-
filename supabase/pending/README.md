# Pending migrations

Written but not yet applied to the database. When one is applied, move it into
`supabase/migrations/` in the same commit so the folder always matches production.

- `20261003010000_private_membership_check.sql`: moves the RLS membership check into a
  private schema (Supabase security advisor lints 0028/0029). Needs confirmation because
  it drops and recreates policies.
