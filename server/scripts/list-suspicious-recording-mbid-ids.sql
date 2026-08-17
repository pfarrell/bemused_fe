-- Emits media_files.id, one per line, for every row belonging to a
-- duplicate musicbrainz_recording_id group whose member titles disagree
-- (same "suspicious" definition as audit-recording-mbid-collisions.sql,
-- but raw ids instead of a human-readable summary — meant to be piped
-- straight into backfill-recording-mbid.ts's --ids-file). Read-only.
--
-- Usage:
--   psql "$BEMUSED_DB" -t -A -f list-suspicious-recording-mbid-ids.sql > /tmp/suspicious_ids.txt
--   tsx scripts/backfill-recording-mbid.ts --ids-file /tmp/suspicious_ids.txt --log recheck-suspicious.log

with dupe_groups as (
  select musicbrainz_recording_id
  from media_files
  where musicbrainz_recording_id is not null
  group by musicbrainz_recording_id
  having count(*) > 1
),
group_rows as (
  select
    mf.musicbrainz_recording_id,
    mf.id as media_file_id,
    trim(regexp_replace(regexp_replace(lower(t.title), '\(.*?\)', '', 'g'), '[^a-z0-9]+', ' ', 'g')) as norm_title
  from media_files mf
  join dupe_groups dg on dg.musicbrainz_recording_id = mf.musicbrainz_recording_id
  join tracks t on t.media_file_id = mf.id
),
suspicious_groups as (
  select musicbrainz_recording_id
  from group_rows
  group by musicbrainz_recording_id
  having count(distinct norm_title) > 1
)
select distinct media_file_id
from group_rows
where musicbrainz_recording_id in (select musicbrainz_recording_id from suspicious_groups)
order by media_file_id;
