import { Sparkles, Undo2, Unlink } from 'lucide-preact';
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
        <span>{isSorting ? 'Sorting...' : 'Sort Tabs'}</span>
        {!isSorting && (
          <kbd class="btn-primary-kbd" aria-hidden="true">
            Alt+P
          </kbd>
        )}
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
        <span>Undo</span>
      </button>
    </footer>
  );
}
