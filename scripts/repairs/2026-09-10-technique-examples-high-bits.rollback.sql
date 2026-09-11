-- Rollback for 2026-09-10-technique-examples-high-bits.sql: restores the exact pre-repair values
-- (read from production on 2026-09-10 before the repair).

BEGIN;

UPDATE technique_examples t
SET techniques_bitfield = v.old_value
FROM (VALUES
  ('630fae93-20d3-4b78-bb56-56d0925a1647'::uuid,   36028797018963970::bigint),
  ('62f02210-24e4-4df3-9bdd-d31c292b461e'::uuid,   72057594037927940::bigint),
  ('cdfa6b7c-98e7-4beb-8087-9958828f7eea'::uuid,  144115188075855870::bigint),
  ('4f1624e9-fbc7-4cde-9d6d-bee29fdb4072'::uuid,  288230376151711740::bigint),
  ('5ada291f-95d8-412c-9f81-f20db3ff28c7'::uuid,  576460752303423500::bigint),
  ('cba4feeb-10eb-4207-abb9-51fa65b4718d'::uuid, 1152921504606847000::bigint)
) AS v(uuid, old_value)
WHERE t.uuid = v.uuid;

COMMIT;
