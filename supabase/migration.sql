-- ============================================
-- Mon Budget Familial - Supabase Migration
-- ============================================
-- Exécutez ce script dans l'éditeur SQL de votre
-- dashboard Supabase (SQL Editor > New Query)
-- ============================================

-- Profils utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  locale TEXT NOT NULL DEFAULT 'fr-FR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enveloppes budgétaires
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

-- Revenus
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

-- Dépenses
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

-- Objectifs d'épargne
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

-- ============================================
-- Index pour les performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_revenus_user_date ON public.revenus(user_id, date);
CREATE INDEX IF NOT EXISTS idx_depenses_user_date ON public.depenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_depenses_envelope ON public.depenses(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_user ON public.envelopes(user_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_user ON public.objectifs(user_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

-- Pour l'instant, sans auth, on autorise tout accès
-- (à remplacer par des policies user_id = auth.uid() quand l'auth sera activée)
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on envelopes" ON public.envelopes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on revenus" ON public.revenus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on depenses" ON public.depenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on objectifs" ON public.objectifs FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Données de démo (optionnel)
-- ============================================
-- Profil par défaut
INSERT INTO public.profiles (id, full_name, currency, locale)
VALUES ('00000000-0000-0000-0000-000000000001', 'Johann Dupont', 'EUR', 'fr-FR')
ON CONFLICT (id) DO NOTHING;

-- Enveloppes par défaut
INSERT INTO public.envelopes (user_id, name, budgeted, color, icon, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cadeau', 150, 'bg-env-pink', 'redeem', 1),
  ('00000000-0000-0000-0000-000000000001', 'Courses', 500, 'bg-env-green', 'shopping_cart', 2),
  ('00000000-0000-0000-0000-000000000001', 'Loisirs', 380, 'bg-env-blue', 'sports_esports', 3),
  ('00000000-0000-0000-0000-000000000001', 'Shopping', 120, 'bg-env-yellow', 'shopping_bag', 4)
ON CONFLICT DO NOTHING;
