import { generateBudgetPdf } from "./exportPdf";
import { computeAnnualReport, filterByYear } from "./calculations";
import type { Revenu, Depense, Envelope } from "@/lib/supabase/types";

export function generateFiscalPdf(
  revenus: Revenu[],
  depenses: Depense[],
  envelopes: Envelope[],
  year: number,
  formatAmount: (n: number) => string,
  userName: string
): void {
  const prevRev = filterByYear(revenus, year - 1) as Revenu[];
  const prevDep = filterByYear(depenses, year - 1) as Depense[];
  const report = computeAnnualReport(revenus, depenses, envelopes, year, prevRev, prevDep);

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const activeMs = report.months.filter((m) => m.totalRevenus > 0 || m.totalDepenses > 0);

  generateBudgetPdf({
    title: `Rappels fiscaux ${year}`,
    subtitle: `Résumé annuel pour déclaration — ${userName} — généré le ${new Date().toLocaleDateString("fr-FR")}`,
    summary: [
      { label: "Revenus déclarables (total annuel)", value: formatAmount(report.totalRevenus) },
      { label: "Dépenses totales", value: formatAmount(report.totalDepenses) },
      { label: "Dépenses fixes", value: formatAmount(report.fixedTotal) },
      { label: "Dépenses variables", value: formatAmount(report.variableTotal) },
      { label: "Épargne nette", value: formatAmount(report.totalEpargne) },
      { label: "Taux d'épargne moyen", value: `${report.tauxEpargneMoyen.toFixed(1)}%` },
    ],
    sections: [
      {
        title: "Récapitulatif mensuel",
        rows: activeMs.map((m) => {
          const idx = report.months.indexOf(m);
          return {
            label: monthNames[idx],
            amount: formatAmount(m.epargne),
            category: `Rev: ${formatAmount(m.totalRevenus)}`,
            date: `Dép: ${formatAmount(m.totalDepenses)}`,
          };
        }),
      },
      {
        title: "Revenus détaillés",
        rows: (filterByYear(revenus, year) as Revenu[]).map((r) => ({
          label: r.label,
          amount: formatAmount(r.amount),
          category: r.category,
          date: r.date,
        })),
      },
      {
        title: "Dépenses détaillées",
        rows: (filterByYear(depenses, year) as Depense[]).map((d) => ({
          label: d.label,
          amount: formatAmount(d.amount),
          category: d.category,
          date: d.date,
        })),
      },
    ],
    footer: "Document indicatif — vérifiez avec votre conseiller fiscal. Mon Budget Familial.",
  });
}
