import { type PopupStore } from '../state/popup.store';

export function resolveDraggedTabId(store: PopupStore, event: DragEvent): number | null {
  const fromSignal = store.draggingTabId.value;
  if (fromSignal !== null) return fromSignal;
  const raw = event.dataTransfer?.getData('text/plain') ?? '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
