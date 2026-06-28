-- ============================================
-- Mon Budget Familial — RLS Verify & Fix
-- ============================================
-- Exécutez UNE FOIS dans Supabase Dashboard > SQL Editor
-- Idempotent : peut être relancé sans danger
--
-- Corrige :
--   • Policies "Allow all" (migration.sql initial)
--   • Escalade de rôle (auth-rls sans security-fix)
--   • Notifications auto bloquées (insert admin-only)
--   • Push upsert sans policy UPDATE
--   • Audit log INSERT ouvert
--   • Colonne recurring_group_id manquante
-- ============================================

-- ============================================
-- ÉTAPE 0 : DIAGNOSTIC (NOTICE dans les logs)
-- ============================================

DO $$
DECLARE
  r RECORD;
  cnt INT;
BEGIN
  RAISE NOTICE '=== Mon Budget — Audit RLS (avant correctif) ===';

  SELECT COUNT(*) INTO cnt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND c.relname IN ('profiles','envelopes','revenus','depenses','objectifs',
                      'audit_log','notifications','push_subscriptions','support_messages');
  RAISE NOTICE 'Tables avec RLS activé : % / 9', cnt;

  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    RAISE WARNING 'POLICY DANGEREUSE : % sur % (USING/WITH CHECK = true)', r.policyname, r.tablename;
  END LOOP;

  SELECT COUNT(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notif_insert_admin';
  IF cnt > 0 THEN
    RAISE WARNING 'notif_insert_admin seul bloque les notifications auto (engine.ts, objectifs)';
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND cmd = 'UPDATE';
  IF cnt = 0 THEN
    RAISE WARNING 'push_subscriptions : aucune policy UPDATE (upsert push cassé)';
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'audit_log'
    AND cmd = 'INSERT' AND with_check IS DISTINCT FROM 'false';
  IF cnt > 0 THEN
    RAISE WARNING 'audit_log : INSERT direct autorisé — falsification possible';
  END IF;
END $$;

-- ============================================
-- ÉTAPE 1 : SCHÉMA (recurring_group_id + contraintes)
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE public.profiles ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));

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

-- ============================================
-- ÉTAPE 2 : ACTIVER RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- ÉTAPE 3 : SUPPRIMER TOUTES LES POLICIES EXISTANTES
-- ============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'envelopes', 'revenus', 'depenses', 'objectifs',
        'audit_log', 'notifications', 'push_subscriptions', 'support_messages'
      )
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Policies legacy nommées explicitement (au cas où pg_policies ne les voit pas)
DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all on envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Allow all on revenus" ON public.revenus;
DROP POLICY IF EXISTS "Allow all on depenses" ON public.depenses;
DROP POLICY IF EXISTS "Allow all on objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Users can insert own envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Users can update own envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Users can delete own envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Users can view own revenus" ON public.revenus;
DROP POLICY IF EXISTS "Users can insert own revenus" ON public.revenus;
DROP POLICY IF EXISTS "Users can update own revenus" ON public.revenus;
DROP POLICY IF EXISTS "Users can delete own revenus" ON public.revenus;
DROP POLICY IF EXISTS "Users can view own depenses" ON public.depenses;
DROP POLICY IF EXISTS "Users can insert own depenses" ON public.depenses;
DROP POLICY IF EXISTS "Users can update own depenses" ON public.depenses;
DROP POLICY IF EXISTS "Users can delete own depenses" ON public.depenses;
DROP POLICY IF EXISTS "Users can view own objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Users can insert own objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Users can update own objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Users can delete own objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all envelopes" ON public.envelopes;
DROP POLICY IF EXISTS "Admins can view all revenus" ON public.revenus;
DROP POLICY IF EXISTS "Admins can view all depenses" ON public.depenses;
DROP POLICY IF EXISTS "Admins can view all objectifs" ON public.objectifs;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "No direct insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "No one can update audit log" ON public.audit_log;
DROP POLICY IF EXISTS "No one can delete audit log" ON public.audit_log;
DROP POLICY IF EXISTS "notif_insert_admin" ON public.notifications;

-- ============================================
-- ÉTAPE 4 : FONCTION ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- ÉTAPE 5 : TRIGGER ANTI-ESCALADE DE RÔLE
-- (filet de sécurité en plus des policies RLS)
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() = NEW.id AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification du rôle interdite';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ============================================
-- ÉTAPE 6 : POLICIES — PROFILES
-- ============================================

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin() AND id != auth.uid());

-- ============================================
-- ÉTAPE 7 : POLICIES — ENVELOPES / REVENUS / DEPENSES / OBJECTIFS
-- ============================================

CREATE POLICY "envelopes_select" ON public.envelopes
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "envelopes_insert" ON public.envelopes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "envelopes_update" ON public.envelopes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "envelopes_delete" ON public.envelopes
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "revenus_select" ON public.revenus
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "revenus_insert" ON public.revenus
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "revenus_update" ON public.revenus
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "revenus_delete" ON public.revenus
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "depenses_select" ON public.depenses
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "depenses_insert" ON public.depenses
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "depenses_update" ON public.depenses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "depenses_delete" ON public.depenses
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "objectifs_select" ON public.objectifs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "objectifs_insert" ON public.objectifs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "objectifs_update" ON public.objectifs
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "objectifs_delete" ON public.objectifs
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 8 : POLICIES — AUDIT LOG
-- ============================================

DO $$ BEGIN
  CREATE POLICY "audit_select_admin" ON public.audit_log
    FOR SELECT USING (public.is_admin());
  CREATE POLICY "audit_no_insert" ON public.audit_log
    FOR INSERT WITH CHECK (false);
  CREATE POLICY "audit_no_update" ON public.audit_log
    FOR UPDATE USING (false);
  CREATE POLICY "audit_no_delete" ON public.audit_log
    FOR DELETE USING (false);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- ÉTAPE 9 : POLICIES — NOTIFICATIONS (CORRIGÉ)
-- ============================================

DO $$ BEGIN
  CREATE POLICY "notif_select" ON public.notifications
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());

  CREATE POLICY "notif_update" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  -- Utilisateur : notifications auto (engine.ts, objectifs)
  CREATE POLICY "notif_insert_self" ON public.notifications
    FOR INSERT WITH CHECK (
      user_id = auth.uid()
      AND (created_by IS NULL OR created_by = auth.uid())
    );

  -- Admin : notifications promo / broadcast
  CREATE POLICY "notif_insert_admin" ON public.notifications
    FOR INSERT WITH CHECK (public.is_admin());

  CREATE POLICY "notif_delete_admin" ON public.notifications
    FOR DELETE USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- ÉTAPE 10 : POLICIES — PUSH (CORRIGÉ : UPDATE pour upsert)
-- ============================================

DO $$ BEGIN
  CREATE POLICY "push_select" ON public.push_subscriptions
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

  CREATE POLICY "push_insert" ON public.push_subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

  CREATE POLICY "push_update" ON public.push_subscriptions
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

  CREATE POLICY "push_delete" ON public.push_subscriptions
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- ÉTAPE 11 : POLICIES — SUPPORT
-- ============================================

DO $$ BEGIN
  CREATE POLICY "support_insert" ON public.support_messages
    FOR INSERT WITH CHECK (user_id = auth.uid());

  CREATE POLICY "support_select_own" ON public.support_messages
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

  CREATE POLICY "support_update_admin" ON public.support_messages
    FOR UPDATE USING (public.is_admin());

  CREATE POLICY "support_delete_admin" ON public.support_messages
    FOR DELETE USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- ÉTAPE 12 : TRIGGERS AUDIT + CASCADE DELETE
-- ============================================

CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.audit_log (actor_id, action, target_id, details)
    VALUES (
      auth.uid(),
      'role_change',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'target_name', NEW.full_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_role_change ON public.profiles;
CREATE TRIGGER trg_role_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

CREATE OR REPLACE FUNCTION public.delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_delete_auth_user ON public.profiles;
CREATE TRIGGER trg_delete_auth_user
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user();

-- ============================================
-- ÉTAPE 13 : VÉRIFICATION POST-CORRECTIF
-- ============================================

DO $$
DECLARE
  r RECORD;
  issues INT := 0;
BEGIN
  RAISE NOTICE '=== Mon Budget — Audit RLS (après correctif) ===';

  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    RAISE WARNING 'RESTE DANGEREUX : % sur %', r.policyname, r.tablename;
    issues := issues + 1;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notif_insert_self'
  ) THEN
    RAISE WARNING 'MANQUANT : notif_insert_self';
    issues := issues + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'push_update'
  ) THEN
    RAISE WARNING 'MANQUANT : push_update';
    issues := issues + 1;
  END IF;

  IF issues = 0 THEN
    RAISE NOTICE 'OK — RLS conforme. % policies actives sur tables publiques.',
      (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public');
  ELSE
    RAISE WARNING '% problème(s) restant(s) — voir messages ci-dessus', issues;
  END IF;
END $$;

-- ============================================
-- RÉSULTAT ATTENDU (requête manuelle)
-- ============================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- ============================================
