export const DATA_CHANGED_EVENT = "monbudget-data-changed";
export const SYNC_ERROR_EVENT = "monbudget-sync-error";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  }
}

export function notifySyncError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: message }));
  }
}
