import { jsPDF } from "jspdf";

interface PdfRow {
  label: string;
  amount: string;
  date?: string;
  category?: string;
}

interface PdfSection {
  title: string;
  rows: PdfRow[];
}

interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  sections: PdfSection[];
  footer?: string;
}

export function generateBudgetPdf(options: ExportPdfOptions): void {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0, 74, 198);
  doc.text(options.title, 14, y);
  y += 8;

  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(options.subtitle, 14, y);
    y += 10;
  }

  if (options.summary && options.summary.length > 0) {
    doc.setDrawColor(220, 220, 230);
    doc.setFillColor(245, 245, 255);
    doc.roundedRect(14, y, pageW - 28, 8 * options.summary.length + 8, 3, 3, "FD");
    y += 6;

    options.summary.forEach((s) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 100);
      doc.text(s.label, 20, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 27, 35);
      doc.text(s.value, pageW - 20, y, { align: "right" });
      y += 7;
    });

    y += 6;
  }

  options.sections.forEach((section) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 27, 35);
    doc.text(section.title, 14, y);
    y += 2;

    doc.setDrawColor(0, 74, 198);
    doc.setLineWidth(0.5);
    doc.line(14, y, 60, y);
    y += 6;

    const hasDate = section.rows.some((r) => r.date);
    const hasCategory = section.rows.some((r) => r.category);

    doc.setFillColor(237, 237, 249);
    doc.rect(14, y - 3, pageW - 28, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(67, 70, 85);
    let colX = 16;
    doc.text("Libellé", colX, y);
    if (hasCategory) { colX = 80; doc.text("Catégorie", colX, y); }
    if (hasDate) { colX = hasCategory ? 120 : 100; doc.text("Date", colX, y); }
    doc.text("Montant", pageW - 16, y, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    section.rows.forEach((row, i) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      if (i % 2 === 0) {
        doc.setFillColor(250, 248, 255);
        doc.rect(14, y - 3.5, pageW - 28, 6, "F");
      }

      doc.setTextColor(25, 27, 35);
      let rx = 16;
      doc.text(row.label.substring(0, 30), rx, y);
      if (hasCategory && row.category) { rx = 80; doc.setTextColor(100, 100, 120); doc.text(row.category, rx, y); }
      if (hasDate && row.date) { rx = hasCategory ? 120 : 100; doc.setTextColor(100, 100, 120); doc.text(row.date, rx, y); }
      doc.setTextColor(25, 27, 35);
      doc.setFont("helvetica", "bold");
      doc.text(row.amount, pageW - 16, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 6;
    });

    y += 8;
  });

  if (options.footer) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(options.footer, pageW / 2, 288, { align: "center" });
  }

  doc.save(`${options.title.replace(/\s+/g, "_")}.pdf`);
}
