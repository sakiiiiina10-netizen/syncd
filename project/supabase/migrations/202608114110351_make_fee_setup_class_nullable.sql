/*
# Make fee_setup.class nullable

1. Changes
- Alters `fee_setup.class` from NOT NULL to nullable so that rows
  keyed by `fee_group` (with no individual class) can be stored.
2. Security
- No RLS or policy changes.
3. Notes
- Old rows that use `class` directly are unaffected — they still
  have a non-null class value and work via the fallback in feeCalc.ts.
*/

ALTER TABLE fee_setup ALTER COLUMN class DROP NOT NULL;
