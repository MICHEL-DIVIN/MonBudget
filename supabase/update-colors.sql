-- Exécutez ce script dans Supabase SQL Editor pour mettre à jour les couleurs des enveloppes
-- (rend les couleurs plus vives comme dans le design original)

UPDATE public.envelopes SET color = 'bg-env-pink', icon = 'redeem', name = 'Cadeau' WHERE name = 'Logement' AND user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.envelopes SET color = 'bg-env-green' WHERE name = 'Courses' AND user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.envelopes SET color = 'bg-env-blue', icon = 'sports_esports', name = 'Loisirs' WHERE name = 'Énergie' AND user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.envelopes SET color = 'bg-env-yellow' WHERE name = 'Shopping' AND user_id = '00000000-0000-0000-0000-000000000001';
