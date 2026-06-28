export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  currency: string;
  locale: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
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

export interface Revenu {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  category: "principal" | "secondaire";
  type: string;
  date: string;
  recurring: boolean;
  recurring_group_id?: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface Depense {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  category: "fixe" | "variable";
  envelope_id: string | null;
  date: string;
  recurring: boolean;
  recurring_group_id?: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface Envelope {
  id: string;
  user_id: string;
  name: string;
  budgeted: number;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Objectif {
  id: string;
  user_id: string;
  label: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "promo";
  read: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export interface SyncQueueItem {
  id: string;
  store: string;
  operation: "create" | "update" | "delete";
  data: Record<string, unknown>;
  created_at: string;
}
