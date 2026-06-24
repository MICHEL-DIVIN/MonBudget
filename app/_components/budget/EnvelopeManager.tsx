"use client";

import { useState } from "react";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import Button from "@/app/_components/ui/Button";
import Icon from "@/app/_components/ui/Icon";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import { useCurrency } from "@/lib/currency/provider";
import type { Envelope } from "@/lib/supabase/types";

interface EnvelopeManagerProps {
  envelopes: Envelope[];
  onAdd: (data: { name: string; budgeted: number; color: string; icon: string }) => Promise<void>;
  onUpdate: (id: string, data: Partial<Envelope>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const COLOR_OPTIONS = [
  { value: "bg-primary-fixed", label: "Bleu" },
  { value: "bg-error-container", label: "Rose" },
  { value: "bg-tertiary-fixed", label: "Orange" },
  { value: "bg-secondary-fixed", label: "Violet" },
  { value: "bg-env-green", label: "Vert" },
  { value: "bg-env-pink", label: "Rose clair" },
  { value: "bg-env-blue", label: "Bleu clair" },
  { value: "bg-env-yellow", label: "Jaune" },
];

const ICON_OPTIONS = [
  { value: "home", label: "Logement" },
  { value: "shopping_cart", label: "Courses" },
  { value: "bolt", label: "Énergie" },
  { value: "shopping_bag", label: "Shopping" },
  { value: "redeem", label: "Cadeau" },
  { value: "sports_esports", label: "Loisirs" },
  { value: "restaurant", label: "Restaurant" },
  { value: "directions_car", label: "Transport" },
  { value: "local_hospital", label: "Santé" },
  { value: "school", label: "Éducation" },
  { value: "phone_iphone", label: "Téléphone" },
  { value: "wifi", label: "Internet" },
  { value: "water_drop", label: "Eau" },
  { value: "pets", label: "Animaux" },
  { value: "child_care", label: "Enfants" },
  { value: "fitness_center", label: "Sport" },
  { value: "flight", label: "Voyage" },
  { value: "checkroom", label: "Vêtements" },
  { value: "local_cafe", label: "Café" },
  { value: "movie", label: "Cinéma" },
  { value: "music_note", label: "Musique" },
  { value: "book", label: "Livres" },
  { value: "savings", label: "Épargne" },
  { value: "account_balance", label: "Banque" },
  { value: "handyman", label: "Bricolage" },
  { value: "local_laundry_service", label: "Ménage" },
  { value: "volunteer_activism", label: "Dons" },
  { value: "smoking_rooms", label: "Tabac" },
  { value: "category", label: "Autre" },
  { value: "more_horiz", label: "Divers" },
];

export default function EnvelopeManager({ envelopes, onAdd, onUpdate, onDelete }: EnvelopeManagerProps) {
  const { formatAmount } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [budgeted, setBudgeted] = useState("");
  const [color, setColor] = useState("bg-env-green");
  const [icon, setIcon] = useState("shopping_cart");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setName("");
    setBudgeted("");
    setColor("bg-env-green");
    setIcon("shopping_cart");
    setShowForm(true);
  }

  function openEdit(env: Envelope) {
    setEditingId(env.id);
    setName(env.name);
    setBudgeted(env.budgeted.toString());
    setColor(env.color);
    setIcon(env.icon);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(budgeted);
    if (!name || isNaN(amount) || amount < 0) return;

    if (editingId) {
      await onUpdate(editingId, { name, budgeted: amount, color, icon });
    } else {
      await onAdd({ name, budgeted: amount, color, icon });
    }
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    await onDelete(id);
    setConfirmDelete(null);
  }

  return (
    <>
      {/* Envelope list with edit/delete */}
      <div className="space-y-2">
        {envelopes.map((env) => (
          <div key={env.id} className={`flex items-center gap-3 p-3 rounded-xl ${env.color}/30`}>
            <div className={`w-10 h-10 rounded-full ${env.color} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-lg">{env.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface text-sm">{env.name}</p>
              <p className="text-xs text-on-surface-variant" suppressHydrationWarning>{formatAmount(env.budgeted)}/mois</p>
            </div>
            <button onClick={() => openEdit(env)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors">
              <Icon name="edit" size={16} />
            </button>
            <button onClick={() => setConfirmDelete(env.id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-error-container text-error transition-colors">
              <Icon name="delete" size={16} />
            </button>
          </div>
        ))}

        <button onClick={openAdd} className="w-full p-3 flex items-center justify-center gap-2 text-primary font-medium hover:bg-surface-container-high rounded-xl transition-colors border border-dashed border-outline-variant">
          <Icon name="add" size={20} />
          <span>Nouvelle enveloppe</span>
        </button>
      </div>

      {/* Add/Edit form */}
      <BottomSheet isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Courses" />
          <Input label="Budget mensuel" type="number" value={budgeted} onChange={(e) => setBudgeted(e.target.value)} placeholder="0,00" />
          <Select label="Couleur" value={color} onChange={(e) => setColor(e.target.value)} options={COLOR_OPTIONS} />
          <div>
            <label className="text-sm font-medium text-on-surface-variant block mb-2">Icône</label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
              {ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                    icon === opt.value ? "bg-primary/20 ring-2 ring-primary" : "bg-surface-container-high hover:bg-surface-container-highest"
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg ${icon === opt.value ? "text-primary" : "text-on-surface-variant"}`}>{opt.value}</span>
                  <span className="text-[9px] text-on-surface-variant leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high">
            <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
              <span className="material-symbols-outlined">{icon}</span>
            </div>
            <span className="text-sm text-on-surface font-medium">{name || "Aperçu"}</span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Annuler</Button>
            <Button type="submit" variant="primary" className="flex-1">{editingId ? "Modifier" : "Créer"}</Button>
          </div>
        </form>
      </BottomSheet>

      {/* Delete confirmation */}
      <BottomSheet isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Supprimer l'enveloppe ?">
        <p className="text-sm text-on-surface-variant mb-4">
          Cette action supprimera l&apos;enveloppe et toutes les dépenses qui y sont associées ne seront plus catégorisées.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1">Annuler</Button>
          <Button variant="primary" onClick={() => confirmDelete && handleDelete(confirmDelete)} className="flex-1 !bg-error">Supprimer</Button>
        </div>
      </BottomSheet>
    </>
  );
}
