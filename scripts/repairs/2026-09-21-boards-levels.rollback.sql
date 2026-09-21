-- Rollback for the 2026-09-21 full board reclassification
-- (scripts/backfill-board-difficulty.ts run against every board).
--
-- The run re-derived level / techniques / difficulty_score for all 117020 boards
-- from the live solver, because the deployed solver's difficulty scoring had
-- drifted since import and ~18-20% of boards carried a stale (too high) level.
--
-- Pre-run values were snapshotted into boards_backup_levels_20260921
-- (uuid, level, techniques, difficulty_score, updated_at), with an off-database
-- copy in 2026-09-21-boards-levels.backup.csv.
--
-- This restores all four columns, including the original updated_at.

BEGIN;

UPDATE boards b
SET level = k.level,
    techniques = k.techniques,
    difficulty_score = k.difficulty_score,
    updated_at = k.updated_at
FROM boards_backup_levels_20260921 k
WHERE b.uuid = k.uuid
  AND (b.level, b.techniques, b.difficulty_score)
      IS DISTINCT FROM (k.level, k.techniques, k.difficulty_score);

SELECT level, count(*)::int AS n FROM boards GROUP BY level ORDER BY level;

COMMIT;

-- Drop the snapshot only once the reclassification is confirmed good:
-- DROP TABLE boards_backup_levels_20260921;
