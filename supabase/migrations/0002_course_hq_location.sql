-- Adds an "HQ" location to every course — a single point used to center the
-- map when viewing or editing it. Needed because a brand-new course has no
-- holes/points yet to derive a sensible center from (see architecture.md).
--
-- not null with a default: existing rows (and any future insert that somehow
-- omits it) get a safe fallback rather than failing outright, but the app
-- itself always supplies a real value explicitly on create — see
-- lib/db/courses.ts's createCourse, which now requires one.

alter table courses add column hq_location geography(Point, 4326) not null
  default 'SRID=4326;POINT(149.1244 -35.3075)'; -- Canberra, ACT — matches the app's own fallback

alter table courses add column hq_lat double precision generated always as (ST_Y(hq_location::geometry)) stored;
alter table courses add column hq_lng double precision generated always as (ST_X(hq_location::geometry)) stored;
