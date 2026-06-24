import { getDB } from "./db";
import { v4 as uuidv4 } from "uuid";
import type { Revenu, Depense } from "@/lib/supabase/types";

export async function generateRecurringTransactions(): Promise<void> {
  const db = await getDB();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Process recurring revenus
  const allRevenus = await db.getAll("revenus");
  const recurringRevenus = allRevenus.filter(
    (r: any) => r.recurring && !r._deleted
  ) as (Revenu & { _dirty?: boolean; _deleted?: boolean })[];

  for (const template of recurringRevenus) {
    if (Number(template.amount) <= 0) continue;
    const templateDate = new Date(template.date);
    if (templateDate > now) continue;
    // Don't re-generate for the template's own month
    if (templateDate.getMonth() === currentMonth && templateDate.getFullYear() === currentYear) continue;

    // Check if already generated for this month
    const existsThisMonth = allRevenus.some((r: any) =>
      !r._deleted &&
      r.label === template.label &&
      r.recurring &&
      r.id !== template.id &&
      new Date(r.date).getMonth() === currentMonth &&
      new Date(r.date).getFullYear() === currentYear
    );

    if (!existsThisMonth) {
      const newDate = new Date(currentYear, currentMonth, Math.min(templateDate.getDate(), new Date(currentYear, currentMonth + 1, 0).getDate()));
      const newRevenu = {
        id: uuidv4(),
        user_id: template.user_id,
        label: template.label,
        amount: template.amount,
        category: template.category,
        type: template.type,
        date: newDate.toISOString().slice(0, 10),
        recurring: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: null,
        _dirty: true,
        _deleted: false,
      };
      await db.put("revenus", newRevenu as any);
    }
  }

  // Process recurring depenses
  const allDepenses = await db.getAll("depenses");
  const recurringDepenses = allDepenses.filter(
    (d: any) => d.recurring && !d._deleted
  ) as (Depense & { _dirty?: boolean; _deleted?: boolean })[];

  for (const template of recurringDepenses) {
    if (Number(template.amount) <= 0) continue;
    const templateDate = new Date(template.date);
    if (templateDate > now) continue;
    if (templateDate.getMonth() === currentMonth && templateDate.getFullYear() === currentYear) continue;

    const existsThisMonth = allDepenses.some((d: any) =>
      !d._deleted &&
      d.label === template.label &&
      d.recurring &&
      d.id !== template.id &&
      new Date(d.date).getMonth() === currentMonth &&
      new Date(d.date).getFullYear() === currentYear
    );

    if (!existsThisMonth) {
      const newDate = new Date(currentYear, currentMonth, Math.min(templateDate.getDate(), new Date(currentYear, currentMonth + 1, 0).getDate()));
      const newDepense = {
        id: uuidv4(),
        user_id: template.user_id,
        label: template.label,
        amount: template.amount,
        category: template.category,
        envelope_id: template.envelope_id,
        date: newDate.toISOString().slice(0, 10),
        recurring: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: null,
        _dirty: true,
        _deleted: false,
      };
      await db.put("depenses", newDepense as any);
    }
  }
}
