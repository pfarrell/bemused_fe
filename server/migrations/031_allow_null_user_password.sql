-- server/migrations/031_allow_null_user_password.sql
-- Migration: Allow NULL users.password
-- Date: 2026-07-29
--
-- A user who signs up via Google OAuth has no bemused password until they
-- explicitly set one (PUT /auth/set-password). Existing rows are untouched;
-- the column just stops requiring a value.

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
