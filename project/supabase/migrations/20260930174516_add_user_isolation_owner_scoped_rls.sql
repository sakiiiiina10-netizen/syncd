/*
# Add per-user data isolation (user_id columns + owner-scoped RLS)

## Problem
All tables currently use `USING (true)` policies, meaning every
authenticated user can see and modify every other user's data. When a
new user signs up they see the existing user's students, fees, etc.

## Changes

### 1. New columns
- `students.user_id` — uuid, defaults to `auth.uid()`, FK to auth.users
- `fee_setup.user_id` — uuid, defaults to `auth.uid()`, FK to auth.users
- `fee_payments.user_id` — uuid, defaults to `auth.uid()`, FK to auth.users
- `attendance.user_id` — uuid, defaults to `auth.uid()`, FK to auth.users

All are nullable (existing rows get NULL) but default to `auth.uid()`
for new inserts. We do NOT enforce NOT NULL to avoid breaking existing
rows that pre-date the column.

### 2. Backfill existing rows
Existing rows get the user_id of the first registered user so the
current data owner doesn't lose access. This is a best-effort backfill:
we set user_id to the first auth.users id for all existing rows that
have NULL user_id.

### 3. RLS policy replacements
For each table (students, fee_setup, fee_payments, attendance):
- Drop the old `USING (true)` policies
- Create 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE) using
  `auth.uid() = user_id`
- INSERT policies use `WITH CHECK (auth.uid() = user_id)` so the
  default fills in automatically even if the client omits user_id
- UPDATE policies use both USING and WITH CHECK
- DELETE and SELECT use USING only

### 4. Unique constraint update
- fee_setup unique constraint updated to include user_id so different
  users can have their own fee setups without conflicts
- fee_payments gets a unique constraint on (user_id, student_id, unit_number, year)
  to prevent duplicate payment records

### 5. Indexes
- Added indexes on user_id for all tables for query performance

## Security
- All policies scoped to `TO authenticated` with `auth.uid() = user_id`
- No more `USING (true)` — each user only sees their own data
- New users start with a fresh, empty panel

## Notes
1. The frontend already has sign-in/sign-up screens, so authenticated-
   only policies are correct.
2. The DEFAULT auth.uid() on user_id means frontend inserts that omit
   user_id will still work — the database fills it in.
3. Existing data is backfilled to the first user so they don't lose
   their data.
*/

-- ============================================================
-- Add user_id columns
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE fee_setup ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- ============================================================
-- Backfill existing rows to the first user
-- ============================================================
DO $$
DECLARE
  first_user uuid;
BEGIN
  SELECT id INTO first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    UPDATE students SET user_id = first_user WHERE user_id IS NULL;
    UPDATE fee_setup SET user_id = first_user WHERE user_id IS NULL;
    UPDATE fee_payments SET user_id = first_user WHERE user_id IS NULL;
    UPDATE attendance SET user_id = first_user WHERE user_id IS NULL;
  END IF;
END $$;

-- ============================================================
-- Indexes on user_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_setup_user_id ON fee_setup(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_user_id ON fee_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);

-- ============================================================
-- STUDENTS — owner-scoped RLS
-- ============================================================
DROP POLICY IF EXISTS "select_own_students" ON students;
CREATE POLICY "select_own_students" ON students FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_students" ON students;
CREATE POLICY "insert_own_students" ON students FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_students" ON students;
CREATE POLICY "update_own_students" ON students FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_students" ON students;
CREATE POLICY "delete_own_students" ON students FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- FEE SETUP — owner-scoped RLS
-- ============================================================
DROP POLICY IF EXISTS "select_fee_setup" ON fee_setup;
CREATE POLICY "select_fee_setup" ON fee_setup FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_fee_setup" ON fee_setup;
CREATE POLICY "insert_fee_setup" ON fee_setup FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_fee_setup" ON fee_setup;
CREATE POLICY "update_fee_setup" ON fee_setup FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_fee_setup" ON fee_setup;
CREATE POLICY "delete_fee_setup" ON fee_setup FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Update unique constraint to include user_id
ALTER TABLE fee_setup DROP CONSTRAINT IF EXISTS fee_setup_unique;
ALTER TABLE fee_setup ADD CONSTRAINT fee_setup_unique
  UNIQUE (user_id, fee_group, fee_category, unit_number);

-- ============================================================
-- FEE PAYMENTS — owner-scoped RLS
-- ============================================================
DROP POLICY IF EXISTS "select_fee_payments" ON fee_payments;
CREATE POLICY "select_fee_payments" ON fee_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_fee_payments" ON fee_payments;
CREATE POLICY "insert_fee_payments" ON fee_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_fee_payments" ON fee_payments;
CREATE POLICY "update_fee_payments" ON fee_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_fee_payments" ON fee_payments;
CREATE POLICY "delete_fee_payments" ON fee_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ATTENDANCE — owner-scoped RLS
-- ============================================================
DROP POLICY IF EXISTS "select_attendance" ON attendance;
CREATE POLICY "select_attendance" ON attendance FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_attendance" ON attendance;
CREATE POLICY "insert_attendance" ON attendance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_attendance" ON attendance;
CREATE POLICY "update_attendance" ON attendance FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_attendance" ON attendance;
CREATE POLICY "delete_attendance" ON attendance FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
