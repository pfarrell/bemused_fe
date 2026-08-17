-- Flags musicbrainz_recording_id groups that are almost certainly AcoustID
-- false positives: multiple media_files share one recording MBID, but the
-- attached track titles don't agree with each other. Read-only.
--
-- Legitimate sharing (a genuine reissue/compilation of the same recording)
-- keeps the same title across every row; a "poisoned" AcoustID match
-- collects unrelated songs under one MBID instead, so title disagreement
-- within a group is the signal.
--
-- Usage: psql "$BEMUSED_DB" -f audit-recording-mbid-collisions.sql

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
    mf.mbid_confidence,
    t.title as track_title,
    ar.name as artist_name
  from media_files mf
  join dupe_groups dg on dg.musicbrainz_recording_id = mf.musicbrainz_recording_id
  join tracks t on t.media_file_id = mf.id
  left join artists ar on ar.id = t.artist_id
),
-- normalize the same way titleMatch.ts does (lowercase, drop parentheticals
-- and punctuation) so trivial formatting differences don't count as a
-- "different" title
normalized as (
  select
    *,
    trim(regexp_replace(regexp_replace(lower(track_title), '\(.*?\)', '', 'g'), '[^a-z0-9]+', ' ', 'g')) as norm_title
  from group_rows
)
select
  musicbrainz_recording_id,
  count(*) as group_size,
  count(distinct norm_title) as distinct_titles,
  round(avg(mbid_confidence), 2) as avg_confidence,
  string_agg(distinct artist_name || ' - ' || track_title, ' | ' order by artist_name || ' - ' || track_title) as sample_tracks
from normalized
group by musicbrainz_recording_id
having count(distinct norm_title) > 1  -- titles disagree within the group: suspect
order by group_size desc;
