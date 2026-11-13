import { ArrowLeft, Settings } from 'lucide-preact';
import { APP_VERSION } from '../../domain/version';
import { type PopupStore } from '../state/popup.store';

interface HeaderProps {
  store: PopupStore;
}

export function Header({ store }: HeaderProps) {
  const isSettingsOpen = store.settingsOpen.value;

  return (
    <header class="prism-header">
      <div class="prism-brand">
        <img
          src="/icons/prism.svg"
          alt="Prism Tabs"
          width={20}
          height={20}
          style={{ display: 'block', flexShrink: 0 }}
        />
        <span class="prism-brand-title">Prism Tabs</span>
        <span class="prism-version-pill">v{APP_VERSION}</span>
      </div>

      <button
        type="button"
        class="prism-icon-btn"
        aria-label={isSettingsOpen ? 'Back to tabs' : 'Open settings'}
        onClick={() => {
          if (isSettingsOpen) {
            store.closeSettings();
          } else {
            store.openSettings();
          }
        }}
      >
        {isSettingsOpen ? (
          <>
            <ArrowLeft size={14} />
            <span>Back</span>
          </>
        ) : (
          <Settings size={15} />
        )}
      </button>
    </header>
  );
}
