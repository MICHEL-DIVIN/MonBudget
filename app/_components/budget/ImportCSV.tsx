"use client";
import { useState, useRef } from "react";
import Button from "@/app/_components/ui/Button";
import Icon from "@/app/_components/ui/Icon";

interface ImportCSVProps {
  onImport: (rows: Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }>) => Promise<void>;
}

export default function ImportCSV({ onImport }: ImportCSVProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }>>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      // Skip header
      const rows = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
        // Expected format: Type, Label, Montant, Categorie, Date
        // Or: Label, Montant, Date (simpler)
        if (cols.length >= 5) {
          return {
            type: cols[0].toLowerCase().includes("revenu") ? "revenu" as const : "depense" as const,
            label: cols[1],
            amount: parseFloat(cols[2]) || 0,
            category: cols[3] || "autre",
            date: cols[4] || new Date().toISOString().slice(0, 10),
          };
        } else if (cols.length >= 3) {
          return {
            type: parseFloat(cols[1]) > 0 ? "revenu" as const : "depense" as const,
            label: cols[0],
            amount: Math.abs(parseFloat(cols[1])) || 0,
            category: "autre",
            date: cols[2] || new Date().toISOString().slice(0, 10),
          };
        }
        return null;
      }).filter((r): r is NonNullable<typeof r> => r !== null && r.amount > 0);
      setPreview(rows);
      setDone(false);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    await onImport(preview);
    setImporting(false);
    setDone(true);
    setPreview([]);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        Importez vos transactions depuis un fichier CSV. Format attendu : Type, Label, Montant, Cat&eacute;gorie, Date
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
      >
        <Icon name="upload_file" size={40} className="text-outline mx-auto mb-2" />
        <p className="text-sm font-medium text-on-surface">Cliquez pour s&eacute;lectionner un fichier CSV</p>
        <p className="text-xs text-on-surface-variant mt-1">ou glissez-d&eacute;posez</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />

      {preview.length > 0 && (
        <div>
          <p className="text-sm font-medium text-on-surface mb-2">{preview.length} transactions d&eacute;tect&eacute;es</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {preview.slice(0, 10).map((row, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-surface-container-high rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.type === 'revenu' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                    {row.type === 'revenu' ? 'REV' : 'DEP'}
                  </span>
                  <span className="text-on-surface">{row.label}</span>
                </div>
                <span className="font-medium">{row.amount.toFixed(2)}&euro;</span>
              </div>
            ))}
            {preview.length > 10 && <p className="text-xs text-on-surface-variant text-center">... et {preview.length - 10} autres</p>}
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setPreview([])} className="flex-1">Annuler</Button>
            <Button variant="primary" onClick={handleImport} disabled={importing} className="flex-1">
              {importing ? "Import..." : `Importer ${preview.length} transactions`}
            </Button>
          </div>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 p-3 bg-success/15 rounded-xl">
          <Icon name="check_circle" size={20} className="text-success" />
          <span className="text-sm text-success font-medium">Import r&eacute;ussi !</span>
        </div>
      )}
    </div>
  );
}
