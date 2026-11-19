/** Enregistrements locaux (miroir du format « fil » de l'API, sans user_id : une base locale = un utilisateur). */

export type Store = 'envelopes' | 'revenus' | 'depenses' | 'objectifs';

interface Base {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Envelope extends Base {
  name: string;
  budgeted: number;
  color: string;
  icon: string;
  sort_order: number;
}

export interface Revenu extends Base {
  label: string;
  amount: number;
  category: 'principal' | 'secondaire';
  type: string;
  date: string;
  recurring: boolean;
  recurring_group_id: string | null;
}

export interface Depense extends Base {
  label: string;
  amount: number;
  category: 'fixe' | 'variable';
  envelope_id: string | null;
  date: string;
  recurring: boolean;
  recurring_group_id: string | null;
}

export interface Objectif extends Base {
  label: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

export interface StoreMap {
  envelopes: Envelope;
  revenus: Revenu;
  depenses: Depense;
  objectifs: Objectif;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  currency: string;
  locale: string;
  role: 'user' | 'admin';
  has_password: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'success' | 'promo';
  read: boolean;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  new_users_30d: number;
  total_revenus: number;
  total_depenses: number;
  sum_revenus: number;
  sum_depenses: number;
  total_envelopes: number;
  total_objectifs: number;
}
