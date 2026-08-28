# Disc golf course designer — architecture summary

Stack: React + Vite, Leaflet (react-leaflet) for the map, Supabase for auth and data storage.

This document captures the data model and interaction design agreed on for v1, with explicit hooks for known future extensions.

---

## 1. Data model

Design principle: tees, baskets, and future marker types (mando, out-of-bounds, etc.) share one `points` table with a `type` discriminator, rather than separate tables per type. This avoids duplicating CRUD logic, RLS policies, and rendering code for every new marker type.

A hole can be associated with **multiple tees and multiple baskets** (many-to-many), via join tables rather than foreign keys on `points` itself — this keeps referential integrity, supports querying in both directions ("holes using this point" / "points on this hole"), and avoids the pitfalls of array columns (no FK enforcement, awkward reverse queries).

### Audit fields (all entities)

Every table below carries the same five audit columns:

| Column | Type | Purpose |
|---|---|---|
| `created_at` | `timestamptz` | When the row was created |
| `modified_at` | `timestamptz` | When the row was last modified |
| `created_by` | `uuid`, FK to `auth.users` | Who created it |
| `modified_by` | `uuid`, FK to `auth.users` | Who last modified it |
| `is_deleted` | `boolean` | Soft-delete flag — supports undo |

**`created_by` replaces the earlier `owner_id`** — in v1 (no collaboration) they're identical, so carrying both would be redundant. `created_by` is used for RLS ownership checks. When multi-editor courses are added later, ownership/permissions should live in a separate `course_members`-style table rather than reusing this audit field, since "who created this" and "who's allowed to edit this" are different concerns that just happen to coincide today.

These fields are enforced server-side by a trigger rather than column defaults, since a default only applies when the client omits the field — a client could otherwise spoof `created_by`/`modified_by` by supplying them explicitly:

```sql
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
```

The same trigger is attached to every table (see schema below).

### Schema

```sql
create extension if not exists postgis;

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
```

Note `on delete cascade` has been dropped from the join tables' foreign keys — since rows are never hard-deleted (see Soft delete below), cascade would never fire anyway.

### Public visibility tiers

`courses.is_public` remains the top-level switch, but visibility below the course is **not** "everything in a public course is visible." Instead, each hole and point resolves to one of three effective states:

- **`included`** — part of the finished design. Shown normally.
- **`alternative`** — not part of the finished design, but the designer wants public viewers to see it anyway (e.g. for feedback on a candidate basket location). Shown, but rendered visually distinct (greyed out).
- **hidden** — not shown to public viewers at all, even though the course itself is public.

`holes.status` is stored directly (`included` / `alternative` / `private`) and set by the designer when creating or editing a hole — `private` holes are never shown publicly regardless of `courses.is_public`, which covers half-formed holes the designer isn't ready to expose even as alternates.

A point's effective status is **derived**, not stored, since a point can belong to multiple holes with different statuses:

```
included    if the point belongs to ≥1 hole with status = 'included'
alternative if the point belongs to ≥1 hole with status = 'alternative', OR points.is_public_alternative = true
hidden      otherwise
```

`points.is_public_alternative` exists specifically for standalone candidate points — a tee or basket location the designer is considering but hasn't attached to any hole yet. Without this flag, such a point would have no hole membership to derive visibility from and would default to hidden.

### Why these choices

- **`geography(Point, 4326)`** instead of plain `lat`/`lng` columns — gives free access to PostGIS distance functions (`ST_Distance`) for hole-length stats, a core disc golf metric.
- **`jsonb metadata`** on `points` and `holes` — lets new attributes (tee-pad surface, basket model, par, difficulty) be added without migrations, until a field is used enough to justify promoting it to a real column.
- **Join tables, not array columns, for hole↔point relationships** — enforce referential integrity, and support efficient queries from either direction.

### Soft delete

There is no `DELETE` RLS policy on any table — Postgres RLS denies any command with no matching policy, so hard deletes are impossible through the API. "Delete" in the app is an `UPDATE` setting `is_deleted = true` (the audit trigger stamps `modified_at`/`modified_by` automatically). Undo is the same update in reverse.

Filtering deleted rows happens **at the query level in application code**, not in RLS — RLS should only gate ownership, not visibility of soft-deleted rows, otherwise a user could never query their own trash to restore something:

```js
// normal view
.eq('created_by', userId).eq('is_deleted', false)

// trash / undo view
.eq('created_by', userId).eq('is_deleted', true)
```

**Join-table implications**: soft-deleting a point does not remove its `hole_tees`/`hole_baskets` rows (no cascade fires). This is actually desirable for undo — restoring the point automatically restores its hole associations with no extra work. It does mean:
- Rendering code must filter out soft-deleted points when computing a hole's tee/basket centroid, and handle a hole having zero live tees or baskets gracefully (e.g. render as incomplete, hide the line).
- Re-adding a previously-removed association must `upsert` on the composite key rather than `insert`, since a soft-deleted row with that same `(hole_id, tee_id)` pair may already exist:
  ```js
  await supabase.from('hole_tees')
    .upsert({ hole_id, tee_id, is_deleted: false }, { onConflict: 'hole_id,tee_id' });
  ```

### Known future extensions this shape supports without rework

- New marker types (mando, OB, etc.) → new `type` value + new icon, no schema change.
- Multiple course "layouts" (e.g. Gold/Blue tees reusing the same physical baskets) → additive `layouts` + `layout_holes` tables; `points` untouched.
- Collaborative courses (multiple editors) → separate `owner_id` on `courses` from point-level ownership, then loosen RLS.
- New hole line-drawing styles (diverge, converge, multi-path, corridor) → `line_style` column already exists; only rendering logic changes.

### Row-level security

Ownership is checked via `created_by`. Only `SELECT`, `INSERT`, and `UPDATE` policies exist — no `DELETE` policy is created for any table, since deletion is handled by soft-delete (see above) and hard deletes should be unreachable through the API entirely.

**Public visibility** follows the three-tier model described above — a `SELECT` is allowed for a non-owner only when the course is public *and* the hole/point resolves to `included` or `alternative`. This is a read-only grant: `INSERT`/`UPDATE` policies stay owner-only regardless of visibility status. Owners can still see their own soft-deleted rows (needed for trash/undo) and their own `private`-status holes; non-owners cannot see either.

```sql
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
```

**Note on point RLS**: this policy grants read access to any point belonging to a *visible* (included or alternative) hole without distinguishing which — that's sufficient for RLS's job (can this row be read at all). The app still needs to compute each point's precise effective status client-side (as described above) to decide *how* to render it — normal vs greyed. Since the app already fetches holes with their nested `hole_tees`/`hole_baskets` for line-drawing, this comes for free, with no extra query needed.

### Fetching a course's holes with their points

```js
const { data: holes } = await supabase
  .from('holes')
  .select(`
    id, number, name, line_style,
    hole_tees ( points ( id, name, location ) ),
    hole_baskets ( points ( id, name, location ) )
  `)
  .eq('course_id', courseId);
```

Returns each hole with `hole_tees[]` and `hole_baskets[]` arrays of full point records in one query.

---

## 2. Hole line rendering (v1: midpoint style)

When a hole has multiple tees and/or baskets, v1 draws a single line from the **centroid of all tees** to the **centroid of all baskets**. This degrades naturally to a normal single tee→basket line when there's exactly one of each — no special-casing needed.

```js
function centroid(points) {
  const n = points.length;
  const lat = points.reduce((sum, p) => sum + p.location.lat, 0) / n;
  const lng = points.reduce((sum, p) => sum + p.location.lng, 0) / n;
  return [lat, lng];
}
```

Computed client-side in plain JS (not the DB) — at course-scale distances, simple lat/lng averaging is accurate enough and avoids unnecessary geodesic math.

The hole's label (number/name) renders as a `divIcon` marker at the line's midpoint, since Leaflet has no native text-on-line support.

**Future line styles** (not built in v1, but the schema already supports them via `line_style`):
- `diverge` — one tee, line splitting toward two baskets.
- `converge` — two tees converging to one basket.
- `multi_path` — two distinct visual paths down the same hole.
- `corridor` — a wide, soft band from tee-midpoint to basket-midpoint.

---

## 3. Course-edit mode: interaction flows

All flows below apply only in **course-edit mode**. In **use mode**, tapping markers triggers different (not yet specified) behavior.

Interaction state is modeled as a single reducer/state machine (`EditMode`) rather than scattered booleans, so invalid combinations (e.g. being in two flows at once) can't occur:

```ts
type EditMode =
  | { kind: 'idle' }
  | { kind: 'placing'; latlng: LatLng }
  | { kind: 'naming'; latlng: LatLng; pointType: 'tee' | 'basket' }
  | { kind: 'building'; editingHoleId: string | null;
      selectedTees: string[]; selectedBaskets: string[] }
  | { kind: 'grabbing'; pointId: string; liveLatLng: LatLng; hasMoved: boolean }
  | { kind: 'micromove'; selectedPointId: string | null }
```

Only one mode is active at a time; entering one flow implicitly gates out the long-press handlers for the others.

### 3.1 Add point (tee / basket)

1. Long-press an empty point on the map.
2. A speech-bubble-style popup opens, anchored at that location, offering **Tee** / **Basket** (extensible to future types like mando).
3. Tapping an option opens a name prompt.
4. On submit, a new row is inserted into `points` with the chosen `type`, name, and location. Mode returns to `idle`.

### 3.2 Define / modify hole

1. **Define**: long-press an unassigned tee or basket. **Modify**: long-press an existing hole's line or label.
2. Enters `building` mode:
   - Define: starts with the long-pressed point selected; points of the *opposite* type become highlighted/tappable candidates.
   - Modify: pre-populates `selectedTees` / `selectedBaskets` from the existing hole, with `editingHoleId` set.
3. Plain taps (not long-press) on candidate points toggle them in/out of the selection. Multiple tees and/or multiple baskets can be selected.
4. An explicit confirm action creates (or updates) the `holes` row and its `hole_tees` / `hole_baskets` join rows. Mode returns to `idle`.

Tapping empty map space during `building` does **not** cancel the flow — cancellation/confirmation requires the explicit control, to avoid losing an in-progress selection to an accidental tap.

### 3.3 Grab-move (drag to reposition)

Long-press on any existing point (tee, basket, other; whether or not it's part of a hole) "lifts" it, and a single continuous gesture either repositions it or falls through to normal selection — no separate trigger needed for the two outcomes.

1. Long-press timer (~500ms) fires on a point → point visually lifts (scale up, shadow); map panning/zooming is disabled for the duration.
2. From this point, pointer movement is tracked:
   - **No movement, pointer released** → falls through to the existing point-selection behavior (i.e. triggers 3.2's define/modify flow as if this had been a plain long-press).
   - **Movement past an ~8px threshold** → the marker now follows the pointer live (`liveLatLng`, local state only). Releasing here commits the new location to `points.location` in Supabase.
3. Gated to `idle` only — a long-press on a candidate point during `building` mode does not trigger grab-move, to avoid a confusing double meaning for the same gesture.

Because holes reference points by id rather than storing coordinates, moving a point automatically moves every hole line it participates in — no additional writes needed. Existing owner-based RLS on `points` already covers the update.

A short-lived `suppressNextClick` flag should guard against the phantom `click` event browsers/Leaflet fire immediately after a drag-release, to avoid it triggering an unrelated map-level click handler.

### 3.4 Micromove (fine adjustment)

For adjustments too small for the grab-move threshold to register as movement rather than a tap. A dedicated FAB (magnifying glass with four cardinal arrows) sits at the bottom-right of the screen in course-edit mode.

1. Tap the micromove icon → enters `micromove` mode. All points (any type) become selectable, single-select only.
2. Tap a point → it becomes the active point (`selectedPointId` set). From here, dragging **anywhere on the map** (not necessarily on the point itself) acts as a relative "trackpad": only the pointer's movement *delta* matters, not its absolute position, and that delta is scaled down before being applied to the point.
3. **Exit**: tapping the micromove icon again, **or** tapping the currently-active point, fully exits micromove mode back to `idle` (both have identical effect — full exit, no "pick another point and keep going" sub-state). This matches the expected real-world usage: a user fine-tunes the one point they're physically standing next to, then leaves the flow.

**Scaling**: delta is applied in screen-pixel space, then converted through Leaflet's projection — this makes the ratio automatically zoom-independent (zooming in further gives finer control for free, without retuning the ratio).

```js
const MICROMOVE_RATIO = 1 / 8; // tune by feel; 1/8–1/12 is a reasonable starting point

function applyMicromoveDelta(map, currentLatLng, dxPx, dyPx) {
  const scaled = { x: dxPx * MICROMOVE_RATIO, y: dyPx * MICROMOVE_RATIO };
  const currentPx = map.latLngToContainerPoint(currentLatLng);
  const newPx = L.point(currentPx.x + scaled.x, currentPx.y + scaled.y);
  return map.containerPointToLatLng(newPx);
}
```

Implementation notes:
- The drag-pad should ignore secondary touch points (`e.isPrimary === false`) so pinch-zoom still works normally while adjusting.
- Update local/rendered position on every `pointermove` for live feedback; debounce the actual Supabase write to pointer-up of each stroke, plus a final flush on mode exit — writing on every pixel of movement would be excessive.
- Map dragging/panning is disabled while a point is actively selected in micromove mode (the map surface is repurposed as the trackpad).

---

## 4. Marker visual states

Marker appearance is driven by a single `visualState`, derived from the current `EditMode` and the point in question — not scattered conditional styling in the render layer.

| State | Applies during | Look |
|---|---|---|
| `default` | `idle`, point not involved in current mode | Normal icon, full opacity |
| `candidate` | `building`, opposite type to current selection, tappable | Icon + colored halo/ring |
| `selected` | `building`, already added to the hole's selection | Icon + solid halo, slightly larger |
| `dimmed` | `building`, same type as already-selected, not eligible to add | Icon at reduced opacity, non-interactive |
| `dragging` | `grabbing`, movement threshold exceeded | Icon lifted (drop shadow, slight scale-up), reduced opacity, no halo |
| `micromove-candidate` | `micromove`, no point yet selected | Icon + halo, applies to **all** types (not type-filtered, unlike `building`) |
| `micromove-active` | `micromove`, currently the selected point | Distinct look from both `selected` and `dragging` — e.g. a pulsing ring, since this is the only state where the marker moves without the finger being on it |
| `alternative` | Public/use-mode viewing, point's effective status resolves to `alternative` (see §1 Public visibility tiers) | Icon rendered greyed out / reduced opacity, distinguishing it from `included`-status points shown at full color |

`alternative` is orthogonal to the edit-mode states above — it applies when *viewing* a public course (owner or otherwise), not during an edit-mode interaction flow. A point could in principle be both mid-`building`-selection (owner editing) and resolve to `alternative` status; edit-mode selection styling should take visual precedence in that case, since the owner is actively working with it.

Implementation approach: a small number of `divIcon` variants per point type, differentiated by a CSS modifier class (`marker-{type} marker-{variant}`), rather than separate image assets — keeps future new states or point types cheap to add.

---

## 5. Open items / deferred to later

- Use-mode marker tap behavior (explicitly out of scope for this document — differs from edit-mode behavior).
- Multi-layout course support (Gold/Blue tee sets sharing baskets).
- Collaborative/multi-editor course permissions.
- Additional `line_style` values beyond `midpoint`.
- Additional point `type` values beyond `tee`/`basket` (e.g. mando, out-of-bounds).
- UI for setting `holes.status` and `points.is_public_alternative` — likely a small addition to the existing define/modify-hole and add-point flows (e.g. a status selector in the hole builder's confirm step; a toggle in a point's edit popup) rather than a new flow of its own.
- Distinct visual treatment (beyond simple greying) for `alternative`-status entities while the *owner* is in course-edit mode, so they can see their own status choices reflected while editing, not just how public viewers will see them.
- Exact FAB icon asset for micromove (custom SVG composition, since no exact match exists in the standard icon set in use).
