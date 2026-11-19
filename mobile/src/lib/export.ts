import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AnnualReport } from './calculations';
import { toCsv } from './csv';
import { listAll } from './repo';
import { monthName } from './format';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function share(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Partage indisponible sur cet appareil');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/** Exporte revenus + dépenses en CSV (réimportable) et ouvre la feuille de partage. */
export async function exportCsv(): Promise<void> {
  const name = `budget_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(toCsv(listAll('revenus'), listAll('depenses')));
  await share(file.uri, 'text/csv', name);
}

interface AnnualPdfInput {
  report: AnnualReport;
  year: number;
  userName: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  intl: string;
  fmt: (n: number) => string;
}

/** Rapport annuel PDF (rendu HTML → PDF natif) puis partage. */
export async function exportAnnualPdf({ report, year, userName, t, intl, fmt }: AnnualPdfInput): Promise<void> {
  const rows = report.months
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.totalRevenus > 0 || m.totalDepenses > 0)
    .map(
      ({ m, i }) =>
        `<tr><td>${esc(monthName(intl, i))}</td><td class="n">${esc(fmt(m.totalRevenus))}</td><td class="n">${esc(fmt(m.totalDepenses))}</td><td class="n ${m.epargne < 0 ? 'neg' : 'pos'}">${esc(fmt(m.epargne))}</td></tr>`,
    )
    .join('');

  const kpi = (label: string, value: string) => `<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const envelopes = report.envelopeAnnual
    .map((e) => `<tr><td>${esc(e.name)}</td><td class="n">${esc(fmt(e.totalSpent))}</td><td class="n">${esc(fmt(e.annualBudget))}</td><td class="n">${e.adherence.toFixed(0)}%</td></tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#1a1a24;padding:28px}
    h1{margin:0 0 4px;color:#6d28d9} .sub{color:#5c5c70;margin-bottom:20px;font-size:13px}
    .kpis{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
    .kpi{flex:1 1 30%;background:#f4f2fb;border-radius:10px;padding:10px 12px}
    .kpi span{display:block;font-size:11px;color:#5c5c70} .kpi b{font-size:16px}
    h2{font-size:15px;margin:22px 0 8px} table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{padding:7px 8px;border-bottom:1px solid #e4e4ec;text-align:left} th{background:#f4f2fb}
    .n{text-align:right;font-variant-numeric:tabular-nums} .pos{color:#16a34a} .neg{color:#dc2626}
  </style></head><body>
    <h1>${esc(t('pdf.title', { year }))}</h1>
    <div class="sub">${esc(userName)} — ${esc(t('pdf.generated', { date: new Date().toLocaleDateString(intl) }))}</div>
    <div class="kpis">
      ${kpi(t('sum.totalIncome'), fmt(report.totalRevenus))}
      ${kpi(t('sum.totalExpenses'), fmt(report.totalDepenses))}
      ${kpi(t('sum.netSavings'), fmt(report.totalEpargne))}
      ${kpi(t('tx.cat.fixe'), fmt(report.fixedTotal))}
      ${kpi(t('tx.cat.variable'), fmt(report.variableTotal))}
      ${kpi(t('sum.savingsRate'), `${report.tauxEpargneMoyen.toFixed(1)}%`)}
    </div>
    <h2>${esc(t('sum.monthly'))}</h2>
    <table><tr><th></th><th class="n">${esc(t('dash.income'))}</th><th class="n">${esc(t('dash.expenses'))}</th><th class="n">${esc(t('sum.netSavings'))}</th></tr>${rows}</table>
    ${envelopes ? `<h2>${esc(t('sum.envelopePerf'))}</h2><table><tr><th></th><th class="n">${esc(t('env.spent'))}</th><th class="n">${esc(t('env.budget'))}</th><th class="n">%</th></tr>${envelopes}</table>` : ''}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await share(uri, 'application/pdf', t('pdf.title', { year }));
}
