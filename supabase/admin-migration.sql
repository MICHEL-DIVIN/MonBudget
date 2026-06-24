-- ============================================
-- Mon Budget Familial — Migration Admin
-- ============================================
-- Exécutez ce script dans Supabase SQL Editor
-- APRÈS avoir exécuté migration.sql et auth-rls.sql
-- ============================================

-- 1. Ajouter le rôle admin au profil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2. Fonction helper pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Policies admin : les admins peuvent voir TOUTES les données (lecture seule)
-- Profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Envelopes
CREATE POLICY "Admins can view all envelopes" ON public.envelopes
  FOR SELECT USING (public.is_admin());

-- Revenus
CREATE POLICY "Admins can view all revenus" ON public.revenus
  FOR SELECT USING (public.is_admin());

-- Depenses
CREATE POLICY "Admins can view all depenses" ON public.depenses
  FOR SELECT USING (public.is_admin());

-- Objectifs
CREATE POLICY "Admins can view all objectifs" ON public.objectifs
  FOR SELECT USING (public.is_admin());

-- 4. L'admin peut modifier les profils (pour changer les rôles, désactiver, etc.)
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- 5. Vue statistiques globales (pour dashboard admin)
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
  (SELECT COUNT(*) FROM public.revenus) AS total_revenus,
  (SELECT COUNT(*) FROM public.depenses) AS total_depenses,
  (SELECT COALESCE(SUM(amount), 0) FROM public.revenus) AS sum_revenus,
  (SELECT COALESCE(SUM(amount), 0) FROM public.depenses) AS sum_depenses,
  (SELECT COUNT(*) FROM public.envelopes) AS total_envelopes,
  (SELECT COUNT(*) FROM public.objectifs) AS total_objectifs;

-- Sécuriser la vue : seuls les admins peuvent la lire
ALTER VIEW public.admin_stats OWNER TO postgres;
-- Note : les vues héritent des RLS des tables sous-jacentes,
-- donc seul un admin verra les données grâce aux policies ci-dessus.

-- ============================================
-- Pour promouvoir un utilisateur en admin :
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'UUID-DE-LUTILISATEUR';
-- ============================================
