-- ============================================
-- Mon Budget Familial — Correctifs de sécurité
-- ============================================
-- EXÉCUTER EN URGENCE dans Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. BLOQUER L'ESCALADE DE PRIVILÈGES
-- Un utilisateur ne doit JAMAIS pouvoir modifier
-- sa propre colonne "role"
-- ============================================

-- Supprimer l'ancienne policy d'update sur profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Nouvelle policy : l'utilisateur peut modifier son profil
-- SAUF la colonne role (elle doit rester identique)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Policy admin séparée : seul un admin peut changer les rôles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================
-- 2. CONTRAINTES D'INTÉGRITÉ DES DONNÉES
-- Empêcher les montants négatifs ou absurdes
-- ============================================

-- Montants strictement positifs
ALTER TABLE public.revenus DROP CONSTRAINT IF EXISTS revenus_amount_positive;
ALTER TABLE public.revenus ADD CONSTRAINT revenus_amount_positive CHECK (amount > 0 AND amount < 100000000);

ALTER TABLE public.depenses DROP CONSTRAINT IF EXISTS depenses_amount_positive;
ALTER TABLE public.depenses ADD CONSTRAINT depenses_amount_positive CHECK (amount > 0 AND amount < 100000000);

ALTER TABLE public.objectifs DROP CONSTRAINT IF EXISTS objectifs_target_positive;
ALTER TABLE public.objectifs ADD CONSTRAINT objectifs_target_positive CHECK (target_amount >= 0);

ALTER TABLE public.objectifs DROP CONSTRAINT IF EXISTS objectifs_current_positive;
ALTER TABLE public.objectifs ADD CONSTRAINT objectifs_current_positive CHECK (current_amount >= 0);

ALTER TABLE public.envelopes DROP CONSTRAINT IF EXISTS envelopes_budgeted_positive;
ALTER TABLE public.envelopes ADD CONSTRAINT envelopes_budgeted_positive CHECK (budgeted >= 0);

-- ============================================
-- 3. EMPÊCHER L'INSERTION AVEC UN user_id FORGÉ
-- Le user_id doit toujours correspondre à auth.uid()
-- ============================================

-- Ces policies existent déjà via WITH CHECK (user_id = auth.uid())
-- mais on s'assure qu'elles sont en place

-- Revenus : vérifier aussi sur UPDATE que user_id ne change pas
DROP POLICY IF EXISTS "Users can update own revenus" ON public.revenus;
CREATE POLICY "Users can update own revenus" ON public.revenus
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Depenses : idem
DROP POLICY IF EXISTS "Users can update own depenses" ON public.depenses;
CREATE POLICY "Users can update own depenses" ON public.depenses
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Envelopes : idem
DROP POLICY IF EXISTS "Users can update own envelopes" ON public.envelopes;
CREATE POLICY "Users can update own envelopes" ON public.envelopes
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Objectifs : idem
DROP POLICY IF EXISTS "Users can update own objectifs" ON public.objectifs;
CREATE POLICY "Users can update own objectifs" ON public.objectifs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. CONTRAINTE SUR LES VALEURS DE RÔLE
-- Empêcher des valeurs arbitraires (superadmin, etc.)
-- ============================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE public.profiles ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));

-- ============================================
-- 5. SUPPRIMER L'UTILISATEUR AUTH LORS DE LA SUPPRESSION DU PROFIL
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_delete_auth_user ON public.profiles;
CREATE TRIGGER trg_delete_auth_user
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user();

-- ============================================
-- 6. POLICY DELETE POUR LES ADMINS
-- Permet aux admins de supprimer des profils
-- ============================================

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin() AND id != auth.uid());

-- ============================================
-- 7. PROTÉGER L'AUDIT LOG CONTRE LA FALSIFICATION
-- ============================================

-- Interdire la modification et suppression des logs
-- Supprimer l'ancienne policy INSERT trop permissive
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;

-- Seuls les triggers SECURITY DEFINER peuvent insérer (pas les users directs)
DROP POLICY IF EXISTS "No direct insert audit log" ON public.audit_log;
CREATE POLICY "No direct insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "No one can update audit log" ON public.audit_log;
CREATE POLICY "No one can update audit log" ON public.audit_log
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No one can delete audit log" ON public.audit_log;
CREATE POLICY "No one can delete audit log" ON public.audit_log
  FOR DELETE USING (false);
