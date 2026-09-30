-- Migration: Add optional google_maps_url column to public.hangouts
ALTER TABLE public.hangouts
ADD COLUMN IF NOT EXISTS google_maps_url TEXT NULL;
