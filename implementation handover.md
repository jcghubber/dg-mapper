# Implementation status — handover

This document complements `architecture.md`. That document describes the *design* —
schema, flows, marker states. This one describes *how much of it actually exists in
code*, as of the most recent files delivered in chat, plus the hard-won implementation
details that aren't obvious from reading the design alone.

Use this to onboard a fresh session (human or Claude) quickly: what's built, what's
half-built, what's untouched, and the traps already found and fixed so they don't get
re-discovered the hard way.

---

## 1. Current status in one paragraph

The app has a working Supabase-backed data layer (courses, points, holes, all with
audit trails, soft delete, and the three-tier public visibility model), a Mantine-based
UI shell, and two of the four course-editing interaction flows fully built and tested:
**add-point** and **hole-builder**. The `EditMode` state machine that all four flows
share is in place and extensible. **Grab-move and micromove are not started.**
Renaming (points/holes/course) and the course settings modal are not started.

---

## 2. What's built

### 2.1 Tooling & UI framework
- Full Mantine migration: `theme.ts` is the single place to change the app's look
  (primary color, radius). `AuthDialog`, `ResetPasswordConfirm`, `MapControls`,
  `MapOverlay` all rewritten on Mantine components.
- **Important fix baked into `theme.ts`**: Mantine's `Popover` and `Modal` both default
  to a z-index *below* Leaflet's own panes (which go up to ~700). `theme.ts` overrides
  both via `Popover.extend`/`Modal.extend` — without this, any Mantine dropdown or
  dialog rendered over the map would appear *behind* map content.
- `scrollWheelZoom="center"` and `touchZoom="center"` on `MapContainer` — the Leaflet
  default zooms around the cursor/fingers, which silently re-centers the map on every
  scroll/pinch. Since the crosshair-based placement UX depends on the map's center
  being exactly predictable, both are locked to always zoom around true center.

### 2.2 Data layer (Supabase)
Matches `architecture.md` §1 exactly, plus one addition beyond that doc:
- `supabase/migrations/0001_points_holes_schema.sql` — courses, points, holes,
  hole_tees, hole_baskets, the audit trigger, RLS policies, generated `lat`/`lng`.
  **Verified against real Postgres+PostGIS**: audit trigger, generated columns,
  cross-user RLS isolation, the three-tier visibility model, hard-delete blocking,
  soft-delete/restore — all empirically tested, not just reviewed.
- `supabase/migrations/0002_course_hq_location.sql` — **not in architecture.md**,
  added during implementation: courses need a center point to display/edit around,
  and a brand-new course has no holes yet to derive one from. Adds
  `courses.hq_location` (+ generated `hq_lat`/`hq_lng`), not-null with a Canberra
  default. `createCourse` now requires an HQ; `setCourseHqLocation`/`updateHq` let it
  be changed later. **No UI to change it yet** — see §4.
- `src/lib/geo.ts` — `toLocationEWKT(lat, lng)`, the write-side counterpart to the
  generated-column read side. PostGIS `geography` columns don't accept a `{lat,lng}`
  object over the REST API; this builds the `SRID=4326;POINT(lng lat)` text format
  Postgres parses natively.
- `src/lib/db/{courses,points,holes}.ts` — the query functions. `holes.ts` fetches
  tee/basket associations as **IDs only** (`HoleWithPointIds`), deliberately not
  embedding full point rows — see §5.
- `src/hooks/{usePoints,useHoles,useCourseData}.ts` — `useCourseData` is the one
  components should use; it joins `useHoles`' ID lists against `usePoints`' live point
  array via `useMemo`, so a moved point is reflected in every hole it belongs to with
  no stale copies anywhere. `useHoles`/`usePoints` alone are lower-level building
  blocks.
- `src/hooks/useDefaultCourse.ts` — **temporary stand-in** for real course
  management (explicitly flagged in its own comment). Auto-creates "My Course" for a
  logged-in user with no course yet, using wherever the map is currently centered as
  the HQ. Exposes `updateHq(lat, lng)`.

### 2.3 Rendering layer
- `src/components/CourseLayer.tsx` — renders real points and hole lines from
  `useCourseData`.
- `src/components/markers/pointIcons.tsx` — **the single editable list** for marker
  appearance: `POINT_ICON_CONFIG` (color/shape/size per point type) and
  `POINT_ICON_VARIANT_STYLES` (visual-state modifiers — currently `default` and
  `selected`; architecture.md §4 lists the rest still to add: candidate, dimmed,
  dragging, micromove-*, alternative). Supports CSS-drawn shapes (`square`, `circle`,
  `ring`) and a custom-image shape (`image`, via a `public/icons/` file).
- `src/lib/geometry.ts` — `centroid()`, the midpoint-line rendering rule from
  architecture.md §2.

### 2.4 Interaction infrastructure
- `src/context/editModeTypes.ts` / `editModeContexts.ts` / `EditModeContext.tsx` /
  `src/hooks/useEditMode.ts` — the `EditMode` state machine from architecture.md §3,
  split across four files specifically for React Fast Refresh compatibility (files
  that export a component can't also export plain values/hooks without breaking HMR).
  **If continuing this work, use this existing split — don't recreate it as one file.**
  All six `EditMode` kinds are declared in the type; only `idle`, `placing`, `naming`,
  `building`, and (partially, see §3) `grabbing` have working reducer cases so far.
- `src/hooks/useLongPressOnMap.ts` (map background) and `useLongPressOnElement.ts`
  (a specific DOM element — markers, hole labels) — Pointer-Events-based long-press
  detection, mouse/touch/pen unified. See §5 for the two non-obvious bugs found and
  fixed in these.

### 2.5 Flows built
- **Add point** — both triggers work: long-press empty map, and the crosshair +
  "Add point at crosshair" button (`App.tsx`). Both land in the same picker
  (`src/components/map/AddPointFlow.tsx`, a *standalone* Leaflet `Popup` — see §5) →
  name modal (`src/components/AddPointNameModal.tsx`) → `addPoint`.
- **Hole builder** — long-press an existing point → `HoleBuilderPanel.tsx` opens with
  that point selected; tapping other points toggles them in/out (both tees and
  baskets, supporting multi-tee/multi-basket holes); Confirm creates/updates the hole.
  Long-pressing an existing hole's label reopens the panel pre-filled for editing.
  Selected points get a green ring (the `'selected'` icon variant).

### 2.6 Supporting features
- View/Edit mode toggle (owner-only), gating the crosshair, add button, delete button,
  and (once built) all other editing affordances.
- Point delete (popup → Delete button → soft delete).
- Course-HQ-based map centering on load (with the crosshair/geolocation "you are here"
  marker kept separate — see `RecenterOnCourseHQ` vs `RecenterAutomatically` in
  `App.tsx`).
- Course name badge, visible in both collapsed and expanded hero-panel states.

---

## 3. Partially done / known caveats

- **Grab-move: type-level only, not functional.** The `EditMode` type already has
  `{ kind: 'grabbing'; pointId; liveLatLng; hasMoved }`, and a `START_GRAB` reducer
  case was added, but **no gesture hook or UI consumes it yet**. A point long-press
  currently *only* triggers hole-building (`START_BUILDING_FROM_POINT`) — it does not
  yet fork into "no movement → select, movement → drag" as architecture.md §3.3
  describes. This fork needs a new combined gesture hook (a plain
  `useLongPressOnElement` can't express it, since the *same* timer-fire needs to lead
  to different outcomes depending on subsequent movement). Nothing was verified working
  for this — treat it as not started, despite the type/reducer scaffolding.
- **The intermittent "add point stuck after dismiss" bug** — a real bug was found and
  fixed (a click-suppression flag that could get stuck armed, silently eating a later
  unrelated click and leaving `EditMode` stuck non-idle). The fix (a self-healing
  timeout) is in `useLongPressOnMap.ts`. It could not be reliably reproduced even
  before the fix, so **treat this as "likely fixed, not proven fixed"** — worth
  keeping an eye on rather than considering fully closed.
- **`useDefaultCourse` is explicitly temporary.** It silently picks/creates a course
  with no user-facing selection. Fine for one-course testing, wrong once real course
  management exists.

---

## 4. Not built yet

Roughly in the order they were discussed as priorities:

1. **Grab-move** (architecture.md §3.3) — see §3 above for how far the scaffolding got.
2. **Micromove** (architecture.md §3.4) — the FAB, the relative trackpad-drag
   mechanic, nothing started.
3. **Renaming** — inline pencil-icon-in-popup for points and holes (agreed approach,
   never implemented); a course settings modal (name + HQ + public toggle — agreed to
   build in full, never started). `updateHq` already exists in `useDefaultCourse` and
   is ready for that modal to call.
4. **Marker visual states beyond `default`/`selected`** — candidate, dimmed, dragging,
   micromove-active, alternative (architecture.md §4's table). The `pointIcons.tsx`
   variant system is structured for this; each is a config entry away, not a redesign.
5. **Use-mode** (non-owner viewing behavior) — explicitly out of scope throughout;
   architecture.md §5 lists it as deferred. Nothing built.
6. **Public/alternative visibility UI** — the schema and RLS for the three-tier
   model (`holes.status`, `points.is_public_alternative`) are done and tested; there's
   no UI anywhere to set either.
7. Multi-layout courses, collaborative editing, additional `line_style`/point `type`
   values — all explicitly deferred in architecture.md §5, still deferred.

---

## 5. Implementation gotchas worth knowing before touching this code

These cost real debugging time — worth reading before extending the gesture hooks or
marker rendering.

- **Never use `Marker` + an imperative `.openPopup()` ref call for a popup that needs
  to open on its own (not via a click).** It silently self-destructs shortly after
  opening — confirmed via DOM mutation tracing, not just observed. Use a **standalone**
  react-leaflet `<Popup position={...}>` (no backing `Marker`) instead — this is
  exactly what `AddPointFlow.tsx` does and does not exhibit the problem.
- **A long-press's own pointer release still fires a native `click`.** Browsers fire
  `click` for any press-then-release with little movement, *regardless of how long it
  was held*. Leaflet's own `closePopupOnClick` (or a marker's click-opens-popup
  behavior) will react to that trailing click and undo whatever the long-press just
  did, unless it's suppressed. Both `useLongPressOnMap` and `useLongPressOnElement`
  handle this via a capture-phase click listener.
- **That suppression listener must live in a separate, always-mounted effect from the
  pointerdown/move/up listeners that detect a *new* long-press starting.** Firing the
  long-press callback typically flips the caller's `enabled` prop to `false` in the
  very same synchronous update (e.g. `mode.kind` stops being `'idle'`) — if the
  click-suppression logic lived in the `enabled`-gated effect, its own cleanup would
  tear it down before the user has even released their pointer, so it would never see
  the actual trailing click at all. Both hooks split this into two effects for exactly
  this reason — don't merge them back without re-solving this.
- **The suppression flag needs a self-healing timeout.** It's armed expecting an
  imminent click; if that click doesn't arrive (platform/timing-dependent), an
  un-timed flag stays armed forever and wrongly eats the *next*, unrelated click later
  — which is what caused the stuck-state bug in §3.
- **`box-sizing: border-box` is mandatory on every CSS-drawn marker shape.** Without
  it, a border is added on top of the size Leaflet's anchor math assumes, silently
  shifting the marker a few pixels from its true coordinate. Baked into
  `buildPointHtml` in `pointIcons.tsx` once, for every shape, so a new shape can't
  reintroduce this.
- **Never set `position: relative` (or any `position` at all) directly on the
  Leaflet-managed marker element itself.** An earlier version did this on the basket
  shape's outer div to give its dashed-ring pseudo-element a positioning context; it
  overrode Leaflet's own required `position: absolute` (two-class CSS selectors beat
  Leaflet's one-class rule), pulling every basket marker into normal document flow and
  stacking them cumulatively downward as more were added. If a shape's inner content
  needs `position: relative`, put it on a *child* wrapper div, never the outer element
  Leaflet itself manages.
- **`exactOptionalPropertyTypes` (on in this project's `tsconfig.json`) rejects
  `key: undefined` on an optional field.** Build the object with the key omitted
  entirely (`...(condition ? { key: value } : {})`) rather than
  `key: condition ? value : undefined`. Came up repeatedly (Mantine `Menu.Item` color,
  `CreateHoleInput` name/number).

---

## 6. File manifest (what should exist in the repo)

Everything below was delivered as a zip matching this exact structure. If a fresh
session needs to verify the repo matches what's documented here, this is the list to
check against.

```
supabase/
  migrations/
    0001_points_holes_schema.sql
    0002_course_hq_location.sql

src/
  types/
    database.ts
  lib/
    supabase.ts
    geo.ts
    geometry.ts
    db/
      courses.ts
      points.ts
      holes.ts
  hooks/
    usePoints.ts
    useHoles.ts
    useCourseData.ts
    useDefaultCourse.ts
    useEditMode.ts
    useLongPressOnMap.ts
    useLongPressOnElement.ts
  context/
    editModeTypes.ts
    editModeContexts.ts
    EditModeContext.tsx
  components/
    CourseLayer.tsx
    HoleBuilderPanel.tsx
    AddPointNameModal.tsx
    MapControls.tsx
    MapControls.css
    MapOverlay.tsx
    AuthDialog.tsx
    ResetPasswordConfirm.tsx
    map/
      AddPointFlow.tsx
    markers/
      pointIcons.tsx
      markers.css
  theme.ts
  main.tsx
  App.tsx
  App.css
public/
  icons/
    basket-placeholder.svg (or your own replacement)
```

**Known cleanup item**: `src/components/Points.ts` (note: capital P, singular, directly
under `components/` — not `lib/db/points.ts`) is a stray broken duplicate found during
this work. It was never wired to anything. Delete it if it's still present.

---

## 7. Suggested next steps

1. Confirm the repo actually matches §6 — there have been several sandbox-reset-induced
   desyncs during this work, so a fresh `git status`/diff against what's described here
   is worth doing before writing new code on top of it.
2. Grab-move next, since it reuses the point long-press gesture already wired up for
   hole-building and just needs the movement-fork behavior added (§3).
3. Micromove after that (the one remaining core flow).
4. Renaming (points/holes inline, course modal) — mechanically simpler than the
   gesture work, good to interleave whenever a break from gesture-debugging is useful.
