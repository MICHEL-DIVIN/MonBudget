-- ============================================
-- Mon Budget Familial — RLS avec auth.uid()
-- ============================================
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- Supprimer TOUTES les policies existantes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'envelopes', 'revenus', 'depenses', 'objectifs')
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- S'assurer que RLS est activé
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Colonne role admin
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Fonction helper admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Profiles
-- ============================================
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- ============================================
-- Envelopes
-- ============================================
CREATE POLICY "Users can view own envelopes" ON public.envelopes
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own envelopes" ON public.envelopes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own envelopes" ON public.envelopes
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own envelopes" ON public.envelopes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- Revenus
-- ============================================
CREATE POLICY "Users can view own revenus" ON public.revenus
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own revenus" ON public.revenus
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own revenus" ON public.revenus
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own revenus" ON public.revenus
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- Depenses
-- ============================================
CREATE POLICY "Users can view own depenses" ON public.depenses
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own depenses" ON public.depenses
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own depenses" ON public.depenses
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own depenses" ON public.depenses
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- Objectifs
-- ============================================
CREATE POLICY "Users can view own objectifs" ON public.objectifs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own objectifs" ON public.objectifs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own objectifs" ON public.objectifs
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own objectifs" ON public.objectifs
  FOR DELETE USING (user_id = auth.uid());
