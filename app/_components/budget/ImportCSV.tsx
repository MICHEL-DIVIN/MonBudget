"use client";
import { useState, useRef, useCallback } from "react";
import Button from "@/app/_components/ui/Button";
import Icon from "@/app/_components/ui/Icon";
import { useCurrency } from "@/lib/currency/provider";

interface ImportCSVProps {
  onImport: (rows: Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }>) => Promise<void>;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      cols.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim().replace(/^"|"$/g, ""));
  return cols;
}

function parseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Math.abs(parseFloat(cleaned)) || 0;
}

function parseCsvText(text: string): Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const isHeader = header.some((h) =>
    h.includes("libell") || h.includes("label") || h.includes("montant") || h.includes("amount") || h.includes("date")
  );
  const dataLines = isHeader ? lines.slice(1) : lines;

  const rows: Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }> = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    // Format MonBudget : Type, Label, Montant, Catégorie, Date
    if (cols.length >= 5 && (cols[0].toLowerCase().includes("revenu") || cols[0].toLowerCase().includes("depense") || cols[0].toLowerCase().includes("dépense"))) {
      rows.push({
        type: cols[0].toLowerCase().includes("revenu") ? "revenu" : "depense",
        label: cols[1],
        amount: parseAmount(cols[2]),
        category: cols[3] || "autre",
        date: parseDate(cols[4]),
      });
      continue;
    }

    // Format banque : Date, Libellé, Débit, Crédit (ou Montant)
    const dateIdx = header.findIndex((h) => h.includes("date"));
    const labelIdx = header.findIndex((h) => h.includes("libell") || h.includes("label") || h.includes("description") || h.includes("intitul"));
    const debitIdx = header.findIndex((h) => h.includes("débit") || h.includes("debit") || h === "debit");
    const creditIdx = header.findIndex((h) => h.includes("crédit") || h.includes("credit") || h === "credit");
    const amountIdx = header.findIndex((h) => h.includes("montant") || h.includes("amount") || h.includes("somme"));

    if (isHeader && (labelIdx >= 0 || debitIdx >= 0 || creditIdx >= 0)) {
      const label = labelIdx >= 0 ? cols[labelIdx] : cols[1] || "Transaction";
      const date = dateIdx >= 0 ? parseDate(cols[dateIdx]) : parseDate(cols[0]);
      const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx]) : 0;
      const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx]) : 0;
      const amount = credit > 0 ? credit : debit;
      if (amount <= 0) continue;
      rows.push({
        label,
        amount,
        category: credit > 0 ? "secondaire" : "variable",
        date,
        type: credit > 0 ? "revenu" : "depense",
      });
      continue;
    }

    // Format simple : Label, Montant, Date
    if (cols.length >= 3) {
      const amount = parseAmount(cols[1]);
      if (amount <= 0) continue;
      const signed = parseFloat(cols[1].replace(",", "."));
      rows.push({
        label: cols[0],
        amount,
        category: "autre",
        date: parseDate(cols[2]),
        type: signed >= 0 ? "revenu" : "depense",
      });
    }
  }

  return rows.filter((r) => r.label && r.amount > 0);
}

export default function ImportCSV({ onImport }: ImportCSVProps) {
  const { currency } = useCurrency();
  const currencySymbol = { EUR: "€", USD: "$", GBP: "£", XOF: "CFA", XAF: "CFA", CAD: "CA$", CHF: "CHF" }[currency] || currency;
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Array<{ label: string; amount: number; category: string; date: string; type: "revenu" | "depense" }>>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(parseCsvText(text));
      setDone(false);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
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
        Importez vos transactions depuis un CSV (format MonBudget, banque avec Date/Libellé/Débit/Crédit, ou Label/Montant/Date).
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/10" : "border-outline-variant hover:border-primary hover:bg-primary/5"
        }`}
      >
        <Icon name="upload_file" size={40} className="text-outline mx-auto mb-2" />
        <p className="text-sm font-medium text-on-surface">Cliquez ou glissez-déposez un fichier CSV</p>
        <p className="text-xs text-on-surface-variant mt-1">Séparateur virgule ou point-virgule</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />

      {preview.length > 0 && (
        <div>
          <p className="text-sm font-medium text-on-surface mb-2">{preview.length} transactions détectées</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {preview.slice(0, 10).map((row, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-surface-container-high rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.type === "revenu" ? "bg-success/15 text-success" : "bg-error/15 text-error"}`}>
                    {row.type === "revenu" ? "REV" : "DEP"}
                  </span>
                  <span className="text-on-surface">{row.label}</span>
                </div>
                <span className="font-medium">{row.amount.toFixed(2)}{currencySymbol}</span>
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
          <span className="text-sm text-success font-medium">Import réussi !</span>
        </div>
      )}
    </div>
  );
}
