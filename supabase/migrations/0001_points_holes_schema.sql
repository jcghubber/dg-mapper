-- Points, holes, and course schema for the disc golf course designer.
-- Matches /architecture.md section 1 (Data model). Run this once against a fresh
-- Supabase project (SQL Editor, or `supabase db push` if using the CLI).

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Audit trigger: enforces created_at/created_by/modified_at/modified_by
-- server-side so a client can't spoof them by supplying their own values.
-- ---------------------------------------------------------------------------
create or replace function set_audit_fields()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    new.created_at = now();
    new.created_by = auth.uid();
    new.modified_at = now();
    new.modified_by = auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_at = old.created_at;   -- immutable once set
    new.created_by = old.created_by;   -- immutable once set
    new.modified_at = now();
    new.modified_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_public boolean not null default false, -- lets other users view this course (and its points/holes) read-only
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  created_by uuid references auth.users not null,
  modified_by uuid references auth.users not null,
  is_deleted boolean not null default false
);

create table points (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses not null,
  type text not null check (type in ('tee', 'basket')), -- extend this list for future marker types (mando, OB, etc.)
  name text not null,
  location geography(Point, 4326) not null,
  -- Generated plain-number columns so the client can read coordinates directly
  -- (row.lat / row.lng) without parsing PostGIS's WKB wire format. `location`
  -- remains the source of truth for spatial queries (ST_Distance, etc).
  -- Writes still go through `location` — see src/lib/geo.ts for the EWKT
  -- string format ("SRID=4326;POINT(lng lat)") that Postgres parses natively.
  lng double precision generated always as (ST_X(location::geometry)) stored,
  lat double precision generated always as (ST_Y(location::geometry)) stored,
  is_public_alternative boolean not null default false, -- shows this point (greyed) to public viewers even if not part of any included hole
  metadata jsonb default '{}',  -- escape hatch for future per-type fields before they earn a real column
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  created_by uuid references auth.users not null,
  modified_by uuid references auth.users not null,
  is_deleted boolean not null default false
);

create table holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses not null,
  number int,
  name text,
  status text not null default 'included' check (status in ('included', 'alternative', 'private')),
  line_style text not null default 'midpoint', -- v1: 'midpoint' only. Future: 'diverge' | 'converge' | 'multi_path' | 'corridor'
  metadata jsonb default '{}', -- future: par, notes, difficulty, etc.
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  created_by uuid references auth.users not null,
  modified_by uuid references auth.users not null,
  is_deleted boolean not null default false
);

create table hole_tees (
  hole_id uuid references holes not null,
  tee_id uuid references points not null,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  created_by uuid references auth.users not null,
  modified_by uuid references auth.users not null,
  is_deleted boolean not null default false,
  primary key (hole_id, tee_id)
);

create table hole_baskets (
  hole_id uuid references holes not null,
  basket_id uuid references points not null,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  created_by uuid references auth.users not null,
  modified_by uuid references auth.users not null,
  is_deleted boolean not null default false,
  primary key (hole_id, basket_id)
);

-- attach the audit trigger to every table
create trigger trg_audit_fields before insert or update on courses for each row execute function set_audit_fields();
create trigger trg_audit_fields before insert or update on points for each row execute function set_audit_fields();
create trigger trg_audit_fields before insert or update on holes for each row execute function set_audit_fields();
create trigger trg_audit_fields before insert or update on hole_tees for each row execute function set_audit_fields();
create trigger trg_audit_fields before insert or update on hole_baskets for each row execute function set_audit_fields();

-- ---------------------------------------------------------------------------
-- Indexes — not in architecture.md, added here since Postgres doesn't
-- automatically index foreign key columns, and every query pattern we have
-- (fetch points/holes for a course; find which holes a point belongs to)
-- filters or joins on these.
-- ---------------------------------------------------------------------------
create index idx_points_course_id on points (course_id);
create index idx_holes_course_id on holes (course_id);
create index idx_hole_tees_tee_id on hole_tees (tee_id);
create index idx_hole_baskets_basket_id on hole_baskets (basket_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table courses enable row level security;
alter table points enable row level security;
alter table holes enable row level security;
alter table hole_tees enable row level security;
alter table hole_baskets enable row level security;

create policy "owner or public read courses" on courses
  for select using (auth.uid() = created_by or (is_public and not is_deleted));
create policy "owner insert courses" on courses
  for insert with check (auth.uid() = created_by);
create policy "owner update courses" on courses
  for update using (auth.uid() = created_by);

create policy "owner or public read holes" on holes
  for select using (
    auth.uid() = created_by
    or (
      not is_deleted
      and status in ('included', 'alternative')
      and exists (select 1 from courses c where c.id = holes.course_id and c.is_public and not c.is_deleted)
    )
  );
create policy "owner insert holes" on holes
  for insert with check (auth.uid() = created_by);
create policy "owner update holes" on holes
  for update using (auth.uid() = created_by);

create policy "owner or public read points" on points
  for select using (
    auth.uid() = created_by
    or (
      not is_deleted
      and exists (select 1 from courses c where c.id = points.course_id and c.is_public and not c.is_deleted)
      and (
        points.is_public_alternative
        or exists (
          select 1 from hole_tees ht join holes h on h.id = ht.hole_id
          where ht.tee_id = points.id and not ht.is_deleted and not h.is_deleted
          and h.status in ('included', 'alternative')
        )
        or exists (
          select 1 from hole_baskets hb join holes h on h.id = hb.hole_id
          where hb.basket_id = points.id and not hb.is_deleted and not h.is_deleted
          and h.status in ('included', 'alternative')
        )
      )
    )
  );
create policy "owner insert points" on points
  for insert with check (auth.uid() = created_by);
create policy "owner update points" on points
  for update using (auth.uid() = created_by);

create policy "owner or public read via hole" on hole_tees
  for select using (
    exists (
      select 1 from holes h join courses c on c.id = h.course_id
      where h.id = hole_id
      and (
        h.created_by = auth.uid()
        or (
          not hole_tees.is_deleted and not h.is_deleted
          and h.status in ('included', 'alternative')
          and c.is_public and not c.is_deleted
        )
      )
    )
  );
create policy "owner insert via hole" on hole_tees
  for insert with check (exists (select 1 from holes where holes.id = hole_id and holes.created_by = auth.uid()));
create policy "owner update via hole" on hole_tees
  for update using (exists (select 1 from holes where holes.id = hole_id and holes.created_by = auth.uid()));

create policy "owner or public read via hole" on hole_baskets
  for select using (
    exists (
      select 1 from holes h join courses c on c.id = h.course_id
      where h.id = hole_id
      and (
        h.created_by = auth.uid()
        or (
          not hole_baskets.is_deleted and not h.is_deleted
          and h.status in ('included', 'alternative')
          and c.is_public and not c.is_deleted
        )
      )
    )
  );
create policy "owner insert via hole" on hole_baskets
  for insert with check (exists (select 1 from holes where holes.id = hole_id and holes.created_by = auth.uid()));
create policy "owner update via hole" on hole_baskets
  for update using (exists (select 1 from holes where holes.id = hole_id and holes.created_by = auth.uid()));
