-- When the current crawl began, so the nightly job can tell a stuck crawl from a running one
alter table sites add column crawl_started_at timestamptz;
