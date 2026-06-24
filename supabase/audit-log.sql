-- ============================================
-- Mon Budget Familial — Audit Log
-- ============================================
-- Trace les actions admin sensibles
-- Exécutez APRÈS admin-migration.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire l'audit log
CREATE POLICY "Admins can view audit log" ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- Tout utilisateur authentifié peut insérer (pour tracer ses propres actions)
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- Trigger : log automatique des changements de rôle
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
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
