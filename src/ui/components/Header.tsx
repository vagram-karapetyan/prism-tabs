import { ArrowLeft, Settings } from 'lucide-preact';
import { APP_VERSION } from '../../domain/version';
import { type PopupStore } from '../state/popup.store';
import { PrismBrandMark } from './PrismBrandMark';

interface HeaderProps {
  store: PopupStore;
}

export function Header({ store }: HeaderProps) {
  const isSettingsOpen = store.settingsOpen.value;
  const isSorting = store.isSorting.value;

  return (
    <header class="prism-header">
      <div class="prism-brand">
        <PrismBrandMark size={24} isRefracting={isSorting} />
        <div class="prism-brand-copy">
          <h1 class="prism-brand-title">
            Prism <span class="prism-brand-subtitle">{isSettingsOpen ? 'Settings' : 'Tabs'}</span>
          </h1>
          <span class="prism-version-pill">v{APP_VERSION}</span>
        </div>
      </div>

      <div class="prism-header-actions">
        <button
          type="button"
          class={`prism-icon-btn${isSettingsOpen ? '' : ' prism-icon-btn--square'}`}
          aria-label={isSettingsOpen ? 'Back to tabs' : 'Open settings'}
          title={isSettingsOpen ? 'Back to tabs (Esc)' : 'Open settings'}
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
      </div>
    </header>
  );
}
