import { Layers, Sparkles, Undo2, Unlink } from 'lucide-preact';
import { type PopupStore } from '../state/popup.store';

interface FooterProps {
  store: PopupStore;
}

export function Footer({ store }: FooterProps) {
  const isSorting = store.isSorting.value;
  const canUndo = store.hasUndoSnapshot.value && !isSorting;
  const hasTabs = store.tabs.value.length > 0;
  const hasGroups = store.groups.value.length > 0;

  return (
    <footer class="prism-footer">
      <button
        type="button"
        class="btn-primary-prism"
        disabled={isSorting || !hasTabs}
        title="Sort tabs in current window (Alt+P)"
        onClick={() => void store.runSort()}
      >
        <Sparkles size={14} />
        <span>{isSorting ? 'Sorting...' : 'Prism Tabs'}</span>
      </button>

      <button
        type="button"
        class="btn-secondary"
        disabled={isSorting || !hasGroups}
        title="Ungroup all tabs (Alt+U)"
        onClick={() => void store.runUngroupAll()}
      >
        <Unlink size={13} />
        <span>Ungroup</span>
      </button>

      <button
        type="button"
        class="btn-secondary"
        disabled={!canUndo}
        title="Undo last sort or ungroup (Ctrl+Z)"
        onClick={() => void store.runUndo()}
      >
        <Undo2 size={13} />
        <span class="sr-only">Undo</span>
        <Layers size={11} style={{ opacity: 0.65 }} />
      </button>
    </footer>
  );
}
