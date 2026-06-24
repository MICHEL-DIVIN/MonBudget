"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/app/_components/ui/Card";
import Icon from "@/app/_components/ui/Icon";
import Input from "@/app/_components/ui/Input";
import Select from "@/app/_components/ui/Select";
import Button from "@/app/_components/ui/Button";
import Avatar from "@/app/_components/ui/Avatar";
import Badge from "@/app/_components/ui/Badge";
import BottomSheet from "@/app/_components/ui/BottomSheet";
import ImportCSV from "@/app/_components/budget/ImportCSV";
import BugReportForm from "@/app/_components/support/BugReportForm";
import { useOfflineData } from "@/lib/offline/hooks";
import { useToast } from "@/app/_components/ui/Toast";
import { useCurrency, type CurrencyCode } from "@/lib/currency/provider";
import { useTheme } from "@/lib/theme/provider";
import { supabase } from "@/lib/supabase/client";
import { generateBudgetPdf } from "@/lib/utils/exportPdf";
import { useUserId } from "@/lib/auth/provider";
import { useAuth } from "@/lib/auth/provider";
import { validatePassword } from "@/lib/auth/validation";
import type { Profile, Objectif, Revenu, Depense } from "@/lib/supabase/types";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dollar ($)" },
  { value: "GBP", label: "Livre Sterling (£)" },
  { value: "XOF", label: "Franc CFA BCEAO (XOF)" },
  { value: "XAF", label: "Franc CFA BEAC (XAF)" },
  { value: "CAD", label: "Dollar Canadien (CA$)" },
  { value: "CHF", label: "Franc Suisse (CHF)" },
];

type SheetPanel = null | "compte" | "notifications" | "securite" | "export" | "aide" | "guide" | "faq" | "contact";

export default function ProfilPage() {
  const userId = useUserId();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { currency: currentCurrency, setCurrency: setGlobalCurrency } = useCurrency();
  const { theme: currentTheme, setTheme: setThemeFromCtx } = useTheme();
  const { data: profiles, updateItem: updateProfile } = useOfflineData<Profile>("profiles");
  const { data: objectifs } = useOfflineData<Objectif>("objectifs");
  const { addItem: addRevenu } = useOfflineData<Revenu>("revenus");
  const { addItem: addDepense } = useOfflineData<Depense>("depenses");

  const profile = profiles.length > 0 ? profiles[0] : null;
  const fullName = profile?.full_name ?? "";
  const nameParts = fullName.split(" ");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("fr");
  const [notifications, setNotificationsState] = useState(true);
  const [budgetAlerts, setBudgetAlertsState] = useState(true);
  const [weeklyReport, setWeeklyReportState] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("monbudget-notif-prefs");
      if (saved) {
        const p = JSON.parse(saved);
        setNotificationsState(p.notifications ?? true);
        setBudgetAlertsState(p.budgetAlerts ?? true);
        setWeeklyReportState(p.weeklyReport ?? false);
      }
    } catch { /* ignore */ }
  }, []);

  function setNotifications(v: boolean) {
    setNotificationsState(v);
    localStorage.setItem("monbudget-notif-prefs", JSON.stringify({ notifications: v, budgetAlerts, weeklyReport }));
  }
  function setBudgetAlerts(v: boolean) {
    setBudgetAlertsState(v);
    localStorage.setItem("monbudget-notif-prefs", JSON.stringify({ notifications, budgetAlerts: v, weeklyReport }));
  }
  function setWeeklyReport(v: boolean) {
    setWeeklyReportState(v);
    localStorage.setItem("monbudget-notif-prefs", JSON.stringify({ notifications, budgetAlerts, weeklyReport: v }));
  }
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetPanel>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast("Format non autorisé. Utilisez JPG, PNG ou WebP.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Image trop grande (max 2 Mo)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (!base64.startsWith("data:image/jpeg") && !base64.startsWith("data:image/png") && !base64.startsWith("data:image/webp")) {
        toast("Format d'image invalide", "error");
        return;
      }
      setAvatarPreview(base64);
      if (profile) {
        await updateProfile(profile.id, { avatar_url: base64 });
        try {
          await supabase.from("profiles").update({ avatar_url: base64 }).eq("id", profile.id);
        } catch { /* offline */ }
        toast("Photo de profil mise à jour");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveAvatar() {
    setAvatarPreview(null);
    if (profile) {
      updateProfile(profile.id, { avatar_url: null });
      try { await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id); } catch { /* offline */ }
      toast("Photo supprimée", "info");
    }
  }

  async function handlePasswordChange() {
    if (!currentPassword) {
      toast("Entrez votre mot de passe actuel", "error");
      return;
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast(pwError, "error");
      return;
    }
    if (!confirmPassword) {
      toast("Confirmez votre nouveau mot de passe", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Les mots de passe ne correspondent pas", "error");
      return;
    }
    try {
      const email = user?.email;
      if (!email) { toast("Session invalide", "error"); return; }
      const { error: reAuthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (reAuthError) {
        toast("Mot de passe actuel incorrect", "error");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast("Impossible de modifier le mot de passe", "error");
      } else {
        toast("Mot de passe modifié. Reconnexion...", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setActiveSheet(null);
        setTimeout(() => signOut(), 1500);
      }
    } catch {
      toast("Erreur lors du changement de mot de passe", "error");
    }
  }

  const currentAvatar = avatarPreview || profile?.avatar_url || undefined;

  useEffect(() => {
    if (profile) {
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setLanguage(profile.locale?.startsWith("en") ? "en" : "fr");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    const newName = `${firstName} ${lastName}`.trim();
    try {
      await supabase.from("profiles").update({
        full_name: newName,
        currency: currentCurrency,
        locale: language === "en" ? "en-US" : "fr-FR",
        updated_at: new Date().toISOString(),
      }).eq("id", profile?.id ?? userId);
    } catch {
      // offline
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setActiveSheet(null); }, 1500);
  }

  async function handleExportCSV() {
    const { data: revenus } = await supabase.from("revenus").select("*").eq("user_id", userId);
    const { data: depenses } = await supabase.from("depenses").select("*").eq("user_id", userId);
    const rows = [
      "Type,Label,Montant,Catégorie,Date",
      ...(revenus ?? []).map((r: { label: string; amount: number; category: string; date: string }) => `Revenu,${r.label},${r.amount},${r.category},${r.date}`),
      ...(depenses ?? []).map((d: { label: string; amount: number; category: string; date: string }) => `Dépense,${d.label},${d.amount},${d.category},${d.date}`),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF() {
    const { data: revenus } = await supabase.from("revenus").select("*").eq("user_id", userId);
    const { data: depenses } = await supabase.from("depenses").select("*").eq("user_id", userId);
    const { formatAmount } = { formatAmount: (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) };
    generateBudgetPdf({
      title: "Mon Budget Familial — Export",
      subtitle: `Exporté le ${new Date().toLocaleDateString("fr-FR")} par ${displayName}`,
      sections: [
        {
          title: "Revenus",
          rows: (revenus ?? []).map((r: { label: string; amount: number; category: string; date: string }) => ({
            label: r.label, amount: formatAmount(r.amount), category: r.category, date: r.date,
          })),
        },
        {
          title: "Dépenses",
          rows: (depenses ?? []).map((d: { label: string; amount: number; category: string; date: string }) => ({
            label: d.label, amount: formatAmount(d.amount), category: d.category, date: d.date,
          })),
        },
      ],
      footer: "Mon Budget Familial — Document confidentiel",
    });
  }

  async function handleImportCSV(rows: Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }>) {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.label || !row.amount || row.amount <= 0 || !row.date) { skipped++; continue; }
      if (row.type === "revenu") {
        await addRevenu({ user_id: userId, label: row.label, amount: Math.abs(row.amount), category: "secondaire" as const, type: "autre", date: row.date, recurring: false, synced_at: null });
      } else {
        await addDepense({ user_id: userId, label: row.label, amount: Math.abs(row.amount), category: "variable" as const, envelope_id: null, date: row.date, recurring: false, synced_at: null });
      }
      imported++;
    }
    toast(`${imported} entrée(s) importée(s)${skipped > 0 ? `, ${skipped} ignorée(s)` : ""}`, "success");
  }

  const displayName = profile ? profile.full_name : "Utilisateur";
  const displayEmail = email || (firstName && lastName ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com` : "");

  const settingsItems: { key: SheetPanel; icon: string; bg: string; label: string; desc: string }[] = [
    { key: "compte", icon: "person", bg: "bg-primary/15", label: "Compte", desc: "Infos personnelles, photo..." },
    { key: "notifications", icon: "notifications", bg: "bg-secondary/15", label: "Notifications", desc: "Alertes budget, rappels..." },
    { key: "securite", icon: "shield", bg: "bg-error/15", label: "Sécurité", desc: "FaceID, Code PIN, MDP..." },
    { key: "export", icon: "upload_file", bg: "bg-tertiary/15", label: "Export", desc: "PDF, CSV, Rappels fiscaux" },
    { key: "aide", icon: "help", bg: "bg-surface-container-high", label: "Aide", desc: "Centre d'aide, support..." },
  ];

  function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
    return (
      <div className="flex items-center justify-between py-3">
        <span className="text-sm text-on-surface">{label}</span>
        <button onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-outline-variant"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="hidden md:block">
        <h1 className="text-xl md:text-2xl font-bold text-on-surface mb-1">Paramètres du compte</h1>
        <p className="text-sm md:text-base text-on-surface-variant mb-4 md:mb-6">Gérez vos préférences personnelles et la sécurité de votre foyer.</p>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:grid md:grid-cols-12 gap-3 md:gap-4">
        <Card padding="lg" className="md:col-span-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <Avatar name={displayName} size="lg" src={currentAvatar} />
              <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-90 transition-transform">
                <Icon name="photo_camera" size={14} />
              </button>
            </div>
            <div suppressHydrationWarning>
              <p className="font-semibold text-on-surface">{displayName}</p>
              <p className="text-sm text-on-surface-variant">{displayEmail}</p>
              <Badge variant="info">Chef de Famille</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Input label="Adresse Email" value={displayEmail} onChange={(e) => setEmail(e.target.value)} type="email" />
          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
            {saved && <span className="text-sm text-success">Enregistré !</span>}
          </div>
        </Card>

        <Card padding="lg" className="md:col-span-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="tune" size={20} className="text-on-surface-variant" />
            <h3 className="font-semibold text-on-surface">Préférences</h3>
          </div>
          <div className="space-y-4">
            <Select label="Langue" value={language} onChange={(e) => setLanguage(e.target.value)} options={[{ value: "fr", label: "Français (FR)" }, { value: "en", label: "English (EN)" }]} />
            <Select label="Devise" value={currentCurrency} onChange={(e) => setGlobalCurrency(e.target.value as CurrencyCode)} options={CURRENCY_OPTIONS} />
            <Toggle checked={notifications} onChange={() => setNotifications(!notifications)} label="Notifications push" />
            <div className="pt-2">
              <p className="text-sm font-medium text-on-surface mb-2">Th&#232;me</p>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setThemeFromCtx(t)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      currentTheme === t
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="md:col-span-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="lock" size={20} className="text-on-surface-variant" />
            <h3 className="font-semibold text-on-surface">Sécurité</h3>
          </div>
          <div className="space-y-4">
            <Input label="Mot de passe actuel" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" />
            <Input label="Nouveau mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
            <Input label="Confirmer le mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" error={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Les mots de passe ne correspondent pas" : undefined} />
            <Button variant="outline" size="md" onClick={handlePasswordChange} disabled={!currentPassword || !newPassword || !confirmPassword || !!validatePassword(newPassword) || newPassword !== confirmPassword}>Changer le mot de passe</Button>
          </div>
        </Card>

        <Card padding="lg" className="md:col-span-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="download" size={20} className="text-on-surface-variant" />
            <h3 className="font-semibold text-on-surface">Export de données</h3>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">Téléchargez l&apos;historique complet de vos transactions familiales.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="md" icon="description" onClick={handleExportCSV}>Export CSV</Button>
            <Button variant="outline" size="md" icon="picture_as_pdf" onClick={handleExportPDF}>Export PDF</Button>
          </div>
          <div className="border-t border-outline-variant/30 my-4" />
          <div className="flex items-center gap-2 mb-4">
            <Icon name="upload_file" size={20} className="text-on-surface-variant" />
            <h3 className="font-semibold text-on-surface">Importer des transactions</h3>
          </div>
          <ImportCSV onImport={handleImportCSV} />
        </Card>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden space-y-4">
        <div className="flex flex-col items-center text-center pt-4 pb-6">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div className="relative mb-4">
            <Avatar name={displayName} size="lg" src={currentAvatar} />
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform">
              <Icon name="photo_camera" size={16} />
            </button>
          </div>
          <h2 className="text-xl font-bold text-on-surface" suppressHydrationWarning>{displayName}</h2>
          <p className="text-sm text-on-surface-variant mt-1" suppressHydrationWarning>{displayEmail}</p>
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-primary/15 text-primary">Premium Family Plan</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card padding="sm">
            <Icon name="group" size={18} className="text-primary mb-1" />
            <p className="text-xs text-on-surface-variant">Membres</p>
            <p className="text-xl font-bold text-on-surface">1</p>
          </Card>
          <Card padding="sm">
            <Icon name="flag" size={18} className="text-primary mb-1" />
            <p className="text-xs text-on-surface-variant">Objectifs</p>
            <p className="text-xl font-bold text-on-surface">{objectifs.length}</p>
          </Card>
        </div>

        <Card padding="sm">
          <p className="text-[13px] font-medium text-on-surface-variant px-2 mb-2">Paramètres Généraux</p>
          {settingsItems.map((item) => (
            <button key={item.key} onClick={() => setActiveSheet(item.key)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                <Icon name={item.icon} size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-on-surface">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
              <Icon name="chevron_right" size={20} className="text-outline" />
            </button>
          ))}
        </Card>

        <Card padding="sm">
          <button
            onClick={async () => {
              if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) {
                await signOut();
                indexedDB.deleteDatabase("monbudget-db");
                toast("Déconnexion réussie", "info");
                setTimeout(() => window.location.href = "/login", 500);
              }
            }}
            className="w-full flex items-center gap-3 p-3 text-error rounded-xl hover:bg-error/10 active:scale-[0.98] transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-error/15 flex items-center justify-center">
              <Icon name="logout" size={18} className="text-error" />
            </div>
            <span className="font-medium">Déconnexion</span>
          </button>
        </Card>

        <p className="text-center text-[11px] text-outline mt-4 pb-4">Mon Budget Familial · Version 1.0.0</p>
      </div>

      {/* ========== BOTTOM SHEETS ========== */}

      {/* Compte */}
      <BottomSheet isOpen={activeSheet === "compte"} onClose={() => setActiveSheet(null)} title="Compte">
        <div className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              <Avatar name={displayName} size="lg" src={currentAvatar} />
              <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                <Icon name="photo_camera" size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => fileInputRef.current?.click()} className="text-[13px] text-primary font-medium">Changer la photo</button>
              {currentAvatar && (
                <>
                  <span className="text-outline">·</span>
                  <button onClick={handleRemoveAvatar} className="text-[13px] text-error font-medium">Supprimer</button>
                </>
              )}
            </div>
          </div>
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label="Email" value={displayEmail} onChange={(e) => setEmail(e.target.value)} type="email" />
          <Select label="Langue" value={language} onChange={(e) => setLanguage(e.target.value)} options={[{ value: "fr", label: "Français (FR)" }, { value: "en", label: "English (EN)" }]} />
          <Select label="Devise" value={currentCurrency} onChange={(e) => setGlobalCurrency(e.target.value as CurrencyCode)} options={CURRENCY_OPTIONS} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => setActiveSheet(null)} className="flex-1">Annuler</Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "..." : saved ? "Enregistré !" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Notifications */}
      <BottomSheet isOpen={activeSheet === "notifications"} onClose={() => setActiveSheet(null)} title="Notifications">
        <div className="space-y-1">
          <Toggle checked={notifications} onChange={() => setNotifications(!notifications)} label="Notifications push" />
          <Toggle checked={budgetAlerts} onChange={() => setBudgetAlerts(!budgetAlerts)} label="Alertes dépassement budget" />
          <Toggle checked={weeklyReport} onChange={() => setWeeklyReport(!weeklyReport)} label="Rapport hebdomadaire" />
          <div className="border-t border-outline-variant/30 my-3" />
          <div className="py-2">
            <p className="text-sm font-medium text-on-surface mb-2">Th&#232;me</p>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setThemeFromCtx(t)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    currentTheme === t
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-outline-variant/30 my-3" />
          <p className="text-xs text-on-surface-variant">Les notifications vous aident à rester informé de vos dépenses et de vos objectifs d&apos;épargne.</p>
          <div className="pt-4">
            <Button variant="primary" size="md" onClick={() => setActiveSheet(null)} className="w-full">Enregistrer</Button>
          </div>
        </div>
      </BottomSheet>

      {/* Sécurité */}
      <BottomSheet isOpen={activeSheet === "securite"} onClose={() => setActiveSheet(null)} title="Sécurité">
        <div className="space-y-4">
          <Input label="Mot de passe actuel" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="••••••••" />
          <Input label="Nouveau mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Minimum 8 caractères" />
          <Input label="Confirmer le mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Répétez le mot de passe" error={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Les mots de passe ne correspondent pas" : undefined} />
          <div className="border-t border-outline-variant/30 my-2" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-on-surface">Code PIN</p>
              <p className="text-xs text-on-surface-variant">Verrou rapide à 4 chiffres</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-outline" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => setActiveSheet(null)} className="flex-1">Annuler</Button>
            <Button variant="primary" size="md" onClick={handlePasswordChange} disabled={!newPassword || newPassword.length < 6 || (confirmPassword.length > 0 && newPassword !== confirmPassword)} className="flex-1">
              Changer le mot de passe
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Export */}
      <BottomSheet isOpen={activeSheet === "export"} onClose={() => setActiveSheet(null)} title="Export de données">
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">Téléchargez l&apos;historique complet de vos transactions familiales pour vos archives personnelles.</p>

          <button onClick={() => { handleExportCSV(); setActiveSheet(null); }} className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
              <Icon name="description" size={24} className="text-green-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">Export CSV</p>
              <p className="text-xs text-on-surface-variant">Fichier tableur compatible Excel, Google Sheets</p>
            </div>
            <Icon name="download" size={20} className="text-primary" />
          </button>

          <button onClick={() => { handleExportPDF(); setActiveSheet(null); }} className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-error/15 flex items-center justify-center">
              <Icon name="picture_as_pdf" size={24} className="text-error" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">Export PDF</p>
              <p className="text-xs text-on-surface-variant">Rapport formaté pour impression ou archivage</p>
            </div>
            <Icon name="download" size={20} className="text-primary" />
          </button>

          <button className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name="receipt_long" size={24} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">Rappels fiscaux</p>
              <p className="text-xs text-on-surface-variant">Résumé annuel pour votre déclaration</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-outline" />
          </button>

          <div className="border-t border-outline-variant/30 my-2" />
          <h3 className="font-semibold text-on-surface">Importer des transactions</h3>
          <ImportCSV onImport={handleImportCSV} />
        </div>
      </BottomSheet>

      {/* Aide */}
      <BottomSheet isOpen={activeSheet === "aide"} onClose={() => setActiveSheet(null)} title="Aide & Support">
        <div className="space-y-3">
          <button onClick={() => setActiveSheet("guide")} className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name="menu_book" size={24} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">Guide d&apos;utilisation</p>
              <p className="text-xs text-on-surface-variant">Apprenez à utiliser toutes les fonctionnalités</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-outline" />
          </button>

          <button onClick={() => setActiveSheet("faq")} className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center">
              <Icon name="quiz" size={24} className="text-secondary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">FAQ</p>
              <p className="text-xs text-on-surface-variant">Réponses aux questions fréquentes</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-outline" />
          </button>

          <button onClick={() => setActiveSheet("contact")} className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
              <Icon name="mail" size={24} className="text-success" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-on-surface">Contacter le support</p>
              <p className="text-xs text-on-surface-variant">support@monbudget.fr</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-outline" />
          </button>
        </div>
      </BottomSheet>

      {/* Guide d'utilisation */}
      <BottomSheet isOpen={activeSheet === "guide"} onClose={() => setActiveSheet("aide")} title="Guide d'utilisation">
        <div className="space-y-5">
          {[
            { icon: "dashboard", title: "Tableau de bord", desc: "Votre page d'accueil affiche le solde du mois, vos enveloppes budget et les transactions récentes. Changez de mois avec les flèches en haut." },
            { icon: "add_circle", title: "Ajouter une transaction", desc: "Appuyez sur le bouton + violet en bas à droite. Choisissez entre revenu et dépense, remplissez le formulaire et validez." },
            { icon: "account_balance_wallet", title: "Gérer les enveloppes", desc: "Les enveloppes sont des catégories de dépenses avec un budget mensuel. Allez dans Dépenses > Gérer pour ajouter, modifier ou supprimer une enveloppe." },
            { icon: "repeat", title: "Transactions récurrentes", desc: "Activez le toggle \"Récurrent\" lors de l'ajout d'une transaction. Le salaire ou le loyer sera automatiquement ajouté chaque mois." },
            { icon: "savings", title: "Objectifs d'épargne", desc: "Créez des objectifs dans l'onglet Épargne. Définissez un montant cible et une date limite, puis ajoutez des fonds régulièrement." },
            { icon: "assessment", title: "Synthèse annuelle", desc: "Depuis la sidebar (desktop) ou le menu, accédez à la synthèse pour voir vos stats annuelles, graphiques et exporter en PDF." },
            { icon: "download", title: "Export & Import", desc: "Exportez vos données en CSV ou PDF depuis Réglages > Export. Vous pouvez aussi importer un fichier CSV de votre banque." },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name={item.icon} size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-on-surface">{item.title}</p>
                <p className="text-[13px] text-on-surface-variant mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* FAQ */}
      <BottomSheet isOpen={activeSheet === "faq"} onClose={() => setActiveSheet("aide")} title="Questions fréquentes">
        <div className="space-y-4">
          {[
            { q: "Comment ajouter mon salaire mensuel ?", a: "Allez dans Revenus, appuyez sur \"Ajouter un revenu\", entrez le montant et activez le toggle \"Récurrent\". Il sera ajouté automatiquement chaque mois." },
            { q: "Mes données sont-elles sécurisées ?", a: "Vos données sont stockées localement sur votre appareil et synchronisées avec Supabase de manière chiffrée. Elles ne sont jamais partagées avec des tiers." },
            { q: "L'application fonctionne-t-elle hors ligne ?", a: "Oui ! Toutes vos données sont sauvegardées localement. Quand vous retrouvez une connexion, la synchronisation se fait automatiquement." },
            { q: "Comment changer de devise ?", a: "Allez dans Réglages > Compte, puis modifiez la devise dans le menu déroulant. Le changement s'applique immédiatement sur toutes les pages." },
            { q: "Comment supprimer une transaction ?", a: "Appuyez sur la transaction dans la liste, puis sur l'icône poubelle rouge qui apparaît à droite." },
            { q: "Que signifie le score de santé budgétaire ?", a: "C'est une note de A à F basée sur votre taux d'épargne, le respect de vos enveloppes et votre balance mensuelle. A = excellent, F = situation critique." },
            { q: "Comment exporter mes données ?", a: "Allez dans Réglages > Export. Vous pouvez télécharger un fichier CSV (pour Excel) ou un rapport PDF formaté." },
          ].map((item, i) => (
            <details key={i} className="group">
              <summary className="flex items-center gap-3 p-3 bg-surface-container rounded-xl cursor-pointer list-none hover:bg-surface-container-high transition-colors">
                <Icon name="help" size={18} className="text-primary shrink-0" />
                <span className="text-[14px] font-medium text-on-surface flex-1">{item.q}</span>
                <span className="material-symbols-outlined text-on-surface-variant text-lg transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <div className="px-4 pt-2 pb-3 ml-8">
                <p className="text-[13px] text-on-surface-variant leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </BottomSheet>

      {/* Contact Support */}
      <BottomSheet isOpen={activeSheet === "contact"} onClose={() => setActiveSheet("aide")} title="Contacter le support">
        <div className="space-y-5">
          <p className="text-[14px] text-on-surface-variant">Notre équipe est disponible pour vous aider. Choisissez le canal qui vous convient.</p>

          <a href="mailto:support@monbudget.fr" className="flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name="mail" size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-on-surface">Email</p>
              <p className="text-xs text-on-surface-variant">support@monbudget.fr</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Réponse sous 24h</p>
            </div>
            <Icon name="open_in_new" size={18} className="text-outline" />
          </a>

          <a href="https://wa.me/242068875749" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-surface-container rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all">
            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
              <Icon name="chat" size={24} className="text-success" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-on-surface">WhatsApp</p>
              <p className="text-xs text-on-surface-variant">Chat en direct</p>
              <p className="text-[10px] text-on-surface-variant mt-1">Lun-Ven 9h-18h</p>
            </div>
            <Icon name="open_in_new" size={18} className="text-outline" />
          </a>

          <BugReportForm userId={userId} userEmail={user?.email} onSent={() => setActiveSheet("aide")} />

          <div className="text-center pt-2">
            <p className="text-[11px] text-outline">Mon Budget Familial v1.0.0</p>
            <p className="text-[11px] text-outline mt-0.5">© 2025 — Tous droits réservés</p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
