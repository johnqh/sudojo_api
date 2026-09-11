-- Repair technique_examples rows whose techniques_bitfield was corrupted by JS number rounding.
--
-- Cause: ExampleCreator wrote techniques_bitfield = techniqueToBit(id) = 2^id as a JS number;
-- Drizzle mode:"number" + postgres.js sent it as ('' + x), JS's shortest decimal, which is not
-- the exact value for 2^55..2^60. E.g. 2^57 was stored as 144115188075855870 = bits 1-56 (bit 57 lost).
--
-- Every example stores exactly its own technique bit (verified 2026-09-10: all 546 rows with
-- primary_technique < 54 have techniques_bitfield = 1 << primary_technique). Hidden UR (54) is exact.
--
-- Safe to re-run: each UPDATE matches the exact corrupted old value, and the transaction
-- aborts unless all 6 rows end up repaired. Rollback: 2026-09-10-technique-examples-high-bits.rollback.sql

BEGIN;

CREATE TEMP TABLE repair (uuid uuid PRIMARY KEY, old_value bigint NOT NULL, new_value bigint NOT NULL) ON COMMIT DROP;
INSERT INTO repair VALUES
  ('630fae93-20d3-4b78-bb56-56d0925a1647',   36028797018963970, 1::bigint << 55), -- Firework: bits 1,55
  ('62f02210-24e4-4df3-9bdd-d31c292b461e',   72057594037927940, 1::bigint << 56), -- Death Blossom: bits 2,56
  ('cdfa6b7c-98e7-4beb-8087-9958828f7eea',  144115188075855870, 1::bigint << 57), -- Franken X-Wing: bits 1-56
  ('4f1624e9-fbc7-4cde-9d6d-bee29fdb4072',  288230376151711740, 1::bigint << 58), -- Franken Swordfish: bits 2-57
  ('5ada291f-95d8-412c-9f81-f20db3ff28c7',  576460752303423500, 1::bigint << 59), -- Franken Jellyfish: bits 2,3,59
  ('cba4feeb-10eb-4207-abb9-51fa65b4718d', 1152921504606847000, 1::bigint << 60); -- Grouped X-Cycles: bits 3,4,60

UPDATE technique_examples t
SET techniques_bitfield = r.new_value
FROM repair r
WHERE t.uuid = r.uuid
  AND t.techniques_bitfield = r.old_value
  AND r.new_value = (1::bigint << t.primary_technique);

DO $$
BEGIN
  IF (SELECT count(*) FROM technique_examples t JOIN repair r ON r.uuid = t.uuid
      WHERE t.techniques_bitfield = r.new_value) <> 6 THEN
    RAISE EXCEPTION 'expected all 6 rows to hold their repaired value; rolling back';
  END IF;
END $$;

SELECT t.uuid, t.primary_technique, t.techniques_bitfield,
       t.techniques_bitfield = (1::bigint << t.primary_technique) AS ok
FROM technique_examples t WHERE t.primary_technique >= 54 ORDER BY t.primary_technique;

COMMIT;
