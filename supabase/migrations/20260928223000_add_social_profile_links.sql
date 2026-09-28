-- Migration: Add optional social profile links (Instagram, TikTok, Spotify) to public.profiles
-- Safe, additive migration for Phase 1 social profile links.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tiktok_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spotify_url text DEFAULT NULL;

-- Grant column update permissions to authenticated users for the new columns
GRANT UPDATE (instagram_url, tiktok_url, spotify_url) ON TABLE public.profiles TO authenticated;
