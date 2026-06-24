-- ============================================
-- Mon Budget Familial — MIGRATION COMPLÈTE
-- ============================================
-- CE FICHIER EST LE SEUL À EXÉCUTER
-- Il contient TOUT : tables, RLS, admin, audit, sécurité
-- Exécutez dans Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- ÉTAPE 1 : TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  locale TEXT NOT NULL DEFAULT 'fr-FR',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  budgeted NUMERIC(12,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'bg-primary-fixed',
  icon TEXT NOT NULL DEFAULT 'category',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revenus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('principal', 'secondaire')),
  type TEXT NOT NULL DEFAULT 'autre',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.depenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fixe', 'variable')),
  envelope_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.objectifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table notifications (envoyées par admin ou système)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'promo')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table push_subscriptions (pour Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table messages support
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÉTAPE 2 : INDEX
-- ============================================

CREATE INDEX IF NOT EXISTS idx_revenus_user_date ON public.revenus(user_id, date);
CREATE INDEX IF NOT EXISTS idx_depenses_user_date ON public.depenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_depenses_envelope ON public.depenses(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_user ON public.envelopes(user_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_user ON public.objectifs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ============================================
-- ÉTAPE 3 : CONTRAINTES D'INTÉGRITÉ
-- ============================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE public.profiles ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));

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

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- ============================================
-- ÉTAPE 4 : ACTIVER RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ÉTAPE 5 : SUPPRIMER TOUTES LES POLICIES EXISTANTES
-- ============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'envelopes', 'revenus', 'depenses', 'objectifs', 'audit_log', 'notifications', 'push_subscriptions', 'support_messages')
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================
-- ÉTAPE 6 : FONCTION ADMIN
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ÉTAPE 7 : POLICIES PROFILES
-- ============================================

-- SELECT : propre profil + admin voit tout
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

-- INSERT : uniquement son propre profil
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- UPDATE utilisateur : propre profil, MAIS ne peut PAS changer son rôle
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- UPDATE admin : peut tout modifier (y compris les rôles d'autres users)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE : admin uniquement, ne peut pas se supprimer soi-même
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin() AND id != auth.uid());

-- ============================================
-- ÉTAPE 8 : POLICIES ENVELOPES
-- ============================================

CREATE POLICY "envelopes_select" ON public.envelopes
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "envelopes_insert" ON public.envelopes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "envelopes_update" ON public.envelopes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "envelopes_delete" ON public.envelopes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 9 : POLICIES REVENUS
-- ============================================

CREATE POLICY "revenus_select" ON public.revenus
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "revenus_insert" ON public.revenus
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "revenus_update" ON public.revenus
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "revenus_delete" ON public.revenus
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 10 : POLICIES DEPENSES
-- ============================================

CREATE POLICY "depenses_select" ON public.depenses
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "depenses_insert" ON public.depenses
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "depenses_update" ON public.depenses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "depenses_delete" ON public.depenses
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 11 : POLICIES OBJECTIFS
-- ============================================

CREATE POLICY "objectifs_select" ON public.objectifs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "objectifs_insert" ON public.objectifs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "objectifs_update" ON public.objectifs
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "objectifs_delete" ON public.objectifs
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 12 : POLICIES AUDIT LOG (INVIOLABLE)
-- ============================================

-- Lecture : admins uniquement
CREATE POLICY "audit_select_admin" ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- INSERT/UPDATE/DELETE : interdit à TOUS (seuls les triggers SECURITY DEFINER écrivent)
CREATE POLICY "audit_no_insert" ON public.audit_log
  FOR INSERT WITH CHECK (false);
CREATE POLICY "audit_no_update" ON public.audit_log
  FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete" ON public.audit_log
  FOR DELETE USING (false);

-- ============================================
-- ÉTAPE 12b : POLICIES NOTIFICATIONS
-- ============================================

-- User voit ses propres notifications + celles globales (user_id IS NULL)
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR public.is_admin());
-- User peut marquer ses notifs comme lues
CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Seuls les admins peuvent créer des notifications
CREATE POLICY "notif_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin());
-- Seuls les admins peuvent supprimer
CREATE POLICY "notif_delete_admin" ON public.notifications
  FOR DELETE USING (public.is_admin());

-- ============================================
-- ÉTAPE 12c : POLICIES PUSH SUBSCRIPTIONS
-- ============================================

CREATE POLICY "push_select" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "push_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_delete" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ÉTAPE 12d : POLICIES SUPPORT MESSAGES
-- ============================================

CREATE POLICY "support_insert" ON public.support_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "support_select_own" ON public.support_messages
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "support_update_admin" ON public.support_messages
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "support_delete_admin" ON public.support_messages
  FOR DELETE USING (public.is_admin());

-- ============================================
-- ÉTAPE 13 : TRIGGERS
-- ============================================

-- Audit : log automatique des changements de rôle
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_role_change ON public.profiles;
CREATE TRIGGER trg_role_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- Cascade : supprimer l'utilisateur auth quand le profil est supprimé
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
-- FIN DE LA MIGRATION
-- ============================================
-- Pour promouvoir un admin :
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'VOTRE-UUID';
-- ============================================
