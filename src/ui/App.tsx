import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-preact';
import { useEffect, useMemo } from 'preact/hooks';
import { type PrismServiceDependencies } from '../adapters/composition-root';
import { Footer } from './components/Footer';
import { GroupList } from './components/GroupList';
import { Header } from './components/Header';
import { ModeAndStatus } from './components/ModeAndStatus';
import { SearchBar } from './components/SearchBar';
import { SettingsScreen } from './components/SettingsScreen';
import { createPopupStore, type PopupStore, type ToastTone } from './state/popup.store';
import { classifyPopupShortcut } from './utils/keyboard-guard';

interface AppProps {
  store?: PopupStore;
  dependencies?: PrismServiceDependencies;
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <CheckCircle2 size={14} style={{ flexShrink: 0 }} />;
  if (tone === 'warning') return <AlertTriangle size={14} style={{ flexShrink: 0 }} />;
  if (tone === 'error') return <XCircle size={14} style={{ flexShrink: 0 }} />;
  return <Info size={14} style={{ flexShrink: 0 }} />;
}

export function App({ store: providedStore, dependencies }: AppProps) {
  const store = useMemo(
    () => providedStore ?? createPopupStore(dependencies),
    [providedStore, dependencies],
  );

  useEffect(() => {
    void store.init();
    return () => {
      store.dispose();
    };
  }, [store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = classifyPopupShortcut(event);
      if (!action) return;

      if (action === 'escape') {
        if (store.settingsOpen.value) {
          event.preventDefault();
          store.closeSettings();
          return;
        }
        if (store.searchQuery.value.length > 0) {
          event.preventDefault();
          store.clearSearch();
        }
        return;
      }

      if (store.settingsOpen.value) return;

      if (action === 'sort') {
        event.preventDefault();
        void store.runSort();
      } else if (action === 'ungroup') {
        event.preventDefault();
        void store.runUngroupAll();
      } else if (store.hasUndoSnapshot.value) {
        event.preventDefault();
        void store.runUndo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [store]);

  const isSettingsOpen = store.settingsOpen.value;
  const toast = store.toast.value;

  return (
    <div class="prism-shell">
      <Header store={store} />

      {isSettingsOpen ? (
        <SettingsScreen store={store} />
      ) : (
        <>
          <ModeAndStatus store={store} />
          <SearchBar store={store} />
          <GroupList store={store} />
          <Footer store={store} />
        </>
      )}

      {toast && (
        <div
          class={`toast-floating banner-${toast.tone}${isSettingsOpen ? ' toast-floating--bottom' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span class="banner-lead" style={{ alignItems: 'center' }}>
            <ToastIcon tone={toast.tone} />
            <span>{toast.text}</span>
          </span>
          <button
            type="button"
            class="banner-close-btn"
            aria-label="Dismiss notification"
            onClick={() => {
              store.dismissToast();
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
