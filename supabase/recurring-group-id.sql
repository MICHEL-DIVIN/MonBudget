-- Add recurring_group_id to revenus and depenses
-- Run in Supabase SQL Editor if not already applied

ALTER TABLE public.revenus
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID;

ALTER TABLE public.depenses
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_revenus_recurring_group
  ON public.revenus (user_id, recurring_group_id)
  WHERE recurring = TRUE AND recurring_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_depenses_recurring_group
  ON public.depenses (user_id, recurring_group_id)
  WHERE recurring = TRUE AND recurring_group_id IS NOT NULL;
