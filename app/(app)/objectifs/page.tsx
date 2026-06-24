"use client";

import { useState } from "react";
import Card from "@/app/_components/ui/Card";
import Icon from "@/app/_components/ui/Icon";
import Button from "@/app/_components/ui/Button";
import Badge from "@/app/_components/ui/Badge";
import Input from "@/app/_components/ui/Input";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import Modal from "@/app/_components/ui/Modal";
import { useOfflineData } from "@/lib/offline/hooks";
import { useCurrency } from "@/lib/currency/provider";
import { useUserId } from "@/lib/auth/provider";
import { useToast } from "@/app/_components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import type { Objectif } from "@/lib/supabase/types";

export default function ObjectifsPage() {
  const userId = useUserId();
  const { data: objectifs, loading, addItem, updateItem, deleteItem } = useOfflineData<Objectif>("objectifs");
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [showFundsSheet, setShowFundsSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fundsTargetId, setFundsTargetId] = useState<string | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrent, setFormCurrent] = useState("");
  const [formDeadline, setFormDeadline] = useState("");

  // Funds state
  const [fundsAmount, setFundsAmount] = useState("");

  function resetForm() {
    setFormLabel("");
    setFormTarget("");
    setFormCurrent("");
    setFormDeadline("");
    setEditingId(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(obj: Objectif) {
    setFormLabel(obj.label);
    setFormTarget(String(obj.target_amount));
    setFormCurrent(String(obj.current_amount));
    setFormDeadline(obj.deadline ?? "");
    setEditingId(obj.id);
    setShowForm(true);
  }

  function openFundsSheet(id: string) {
    setFundsTargetId(id);
    setFundsAmount("");
    setShowFundsSheet(true);
  }

  async function handleSubmit() {
    const target = parseFloat(formTarget) || 0;
    const current = parseFloat(formCurrent) || 0;
    if (!formLabel.trim() || target <= 0) return;

    if (editingId) {
      await updateItem(editingId, {
        label: formLabel.trim(),
        target_amount: target,
        current_amount: current,
        deadline: formDeadline || null,
      });
    } else {
      await addItem({
        user_id: userId,
        label: formLabel.trim(),
        target_amount: target,
        current_amount: current,
        deadline: formDeadline || null,
      });
      toast("Objectif créé !", "success");
      supabase.from("notifications").insert({
        user_id: userId,
        title: "Nouvel objectif créé",
        body: `"${formLabel.trim()}" — cible de ${formatAmount(target)}${formDeadline ? ` avant le ${new Date(formDeadline).toLocaleDateString("fr-FR")}` : ""}.`,
        type: "info",
      }).then(() => {});
    }
    setShowForm(false);
    resetForm();
  }

  async function handleAddFunds() {
    if (!fundsTargetId) return;
    const amount = parseFloat(fundsAmount) || 0;
    if (amount <= 0) return;

    const obj = objectifs.find((o) => o.id === fundsTargetId);
    if (!obj) return;

    const newAmount = Number(obj.current_amount) + amount;
    await updateItem(fundsTargetId, { current_amount: newAmount });

    if (newAmount >= Number(obj.target_amount) && Number(obj.current_amount) < Number(obj.target_amount)) {
      toast("Objectif atteint !", "success");
      supabase.from("notifications").insert({
        user_id: userId,
        title: "Objectif atteint !",
        body: `Félicitations ! Vous avez atteint votre objectif "${obj.label}" (${formatAmount(Number(obj.target_amount))}).`,
        type: "success",
      }).then(() => {});
    }

    setShowFundsSheet(false);
    setFundsTargetId(null);
    setFundsAmount("");
  }

  async function handleDelete(id: string) {
    await deleteItem(id);
  }

  function getProgress(obj: Objectif) {
    if (obj.target_amount <= 0) return 0;
    return Math.min((obj.current_amount / obj.target_amount) * 100, 100);
  }

  function formatDeadline(date: string) {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const formTitle = editingId ? "Modifier l'objectif" : "Nouvel objectif";

  const formContent = (
    <div className="space-y-4">
      <Input
        label="Nom de l'objectif"
        value={formLabel}
        onChange={(e) => setFormLabel(e.target.value)}
        placeholder="Ex: Vacances, Fonds d'urgence..."
      />
      <Input
        label="Montant cible"
        value={formTarget}
        onChange={(e) => setFormTarget(e.target.value)}
        type="number"
        placeholder="0.00"
      />
      <Input
        label="Montant actuel"
        value={formCurrent}
        onChange={(e) => setFormCurrent(e.target.value)}
        type="number"
        placeholder="0.00"
      />
      <Input
        label="Date limite (optionnel)"
        value={formDeadline}
        onChange={(e) => setFormDeadline(e.target.value)}
        type="date"
      />
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={() => {
            setShowForm(false);
            resetForm();
          }}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={!formLabel.trim() || !formTarget || parseFloat(formTarget) <= 0}
          className="flex-1"
        >
          {editingId ? "Modifier" : "Créer"}
        </Button>
      </div>
    </div>
  );

  const fundsContent = (
    <div className="space-y-4">
      <Input
        label="Montant à ajouter"
        value={fundsAmount}
        onChange={(e) => setFundsAmount(e.target.value)}
        type="number"
        placeholder="0.00"
      />
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={() => {
            setShowFundsSheet(false);
            setFundsTargetId(null);
          }}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleAddFunds}
          disabled={!fundsAmount || parseFloat(fundsAmount) <= 0}
          className="flex-1"
        >
          Ajouter
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="flag" size={24} className="text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-on-surface">
            Objectifs d&apos;épargne
          </h1>
        </div>
        <Button variant="primary" size="sm" icon="add" onClick={openAddForm}>
          Nouvel objectif
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} padding="md">
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-surface-container-high rounded w-1/3" />
                <div className="h-3 bg-surface-container-high rounded w-full" />
                <div className="h-4 bg-surface-container-high rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && objectifs.length === 0 && (
        <Card padding="lg">
          <div className="text-center py-8">
            <Icon name="flag" size={48} className="text-outline mx-auto mb-3" />
            <p className="text-on-surface font-medium mb-1">
              Aucun objectif d&apos;épargne
            </p>
            <p className="text-sm text-on-surface-variant mb-4">
              Créez votre premier objectif pour commencer à épargner !
            </p>
            <Button variant="primary" size="md" icon="add" onClick={openAddForm}>
              Créer un objectif
            </Button>
          </div>
        </Card>
      )}

      {/* Goal cards */}
      {!loading && objectifs.length > 0 && (
        <div className="space-y-3 md:space-y-4">
          {objectifs.map((obj) => {
            const progress = getProgress(obj);
            const isComplete = progress >= 100;

            return (
              <Card key={obj.id} padding="md">
                <div className="space-y-3">
                  {/* Top row: icon + label + badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Icon name="target" size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface">{obj.label}</p>
                        {obj.deadline && (
                          <p className="text-xs text-on-surface-variant">
                            Échéance : {formatDeadline(obj.deadline)}
                          </p>
                        )}
                      </div>
                    </div>
                    {isComplete ? (
                      <Badge variant="success">Atteint</Badge>
                    ) : (
                      <Badge variant="info">{Math.round(progress)}%</Badge>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2.5 bg-outline-variant/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isComplete ? "bg-success" : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Amounts */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-on-surface">
                      <span className="font-semibold">{formatAmount(obj.current_amount)}</span>
                      {" / "}
                      <span className="text-on-surface-variant">{formatAmount(obj.target_amount)}</span>
                    </p>
                    <p className="text-sm font-medium text-on-surface-variant">
                      {Math.round(progress)}%
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      icon="add"
                      onClick={() => openFundsSheet(obj.id)}
                      className="flex-1"
                    >
                      Ajouter des fonds
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon="edit"
                      onClick={() => openEditForm(obj)}
                    >
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="delete"
                      onClick={() => handleDelete(obj.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit form - Desktop Modal */}
      <div className="hidden md:block">
        <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={formTitle}>
          {formContent}
        </Modal>
      </div>

      {/* Add/Edit form - Mobile BottomSheet */}
      <div className="md:hidden">
        <BottomSheet isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={formTitle}>
          {formContent}
        </BottomSheet>
      </div>

      {/* Add Funds - Desktop Modal */}
      <div className="hidden md:block">
        <Modal isOpen={showFundsSheet} onClose={() => { setShowFundsSheet(false); setFundsTargetId(null); }} title="Ajouter des fonds">
          {fundsContent}
        </Modal>
      </div>

      {/* Add Funds - Mobile BottomSheet */}
      <div className="md:hidden">
        <BottomSheet isOpen={showFundsSheet} onClose={() => { setShowFundsSheet(false); setFundsTargetId(null); }} title="Ajouter des fonds">
          {fundsContent}
        </BottomSheet>
      </div>
    </div>
  );
}
