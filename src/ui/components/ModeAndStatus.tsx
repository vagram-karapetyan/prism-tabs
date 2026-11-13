import { AlertTriangle, Sparkles, X, Zap } from 'lucide-preact';
import { type PopupStore } from '../state/popup.store';

interface ModeAndStatusProps {
  store: PopupStore;
}

export function ModeAndStatus({ store }: ModeAndStatusProps) {
  const mode = store.settings.value.mode;
  const maxLimit = store.settings.value.maxTabsPerGroup;
  const isSorting = store.isSorting.value;
  const totalTabs = store.tabs.value.length;
  const totalGroups = store.groups.value.length;
  const ungrouped = store.ungroupedCount.value;
  const fallbackBanner = store.fallbackBanner.value;

  return (
    <section class="prism-top-controls" aria-label="Engine controls">
      <div class="mode-switch" role="tablist" aria-label="Grouping Engine Mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'logic'}
          class={`mode-switch-btn${mode === 'logic' ? ' is-active' : ''}`}
          disabled={isSorting}
          onClick={() => void store.setMode('logic')}
        >
          <Zap size={13} />
          <span>Logic Mode</span>
          <span class="mode-badge">Local</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'meaning'}
          class={`mode-switch-btn${mode === 'meaning' ? ' is-active' : ''}`}
          disabled={isSorting}
          onClick={() => void store.setMode('meaning')}
        >
          <Sparkles size={13} />
          <span>Meaning Mode</span>
          <span class="mode-badge">AI</span>
        </button>
      </div>

      <div class={`refraction-bar${isSorting ? ' is-active' : ''}`}>
        <span>
          {isSorting
            ? store.sortPhase.value
            : `${totalTabs} tabs • ${totalGroups} groups • ${ungrouped} ungrouped`}
        </span>
        <span class="mode-badge">
          {maxLimit === null ? 'Max ∞' : `Max ${maxLimit}`}
        </span>
        <div class="refraction-beam" aria-hidden="true" />
      </div>

      {fallbackBanner !== null && (
        <div class="banner banner-warning" role="status">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{fallbackBanner}</span>
          </div>
          <button
            type="button"
            class="banner-close-btn"
            aria-label="Dismiss notice"
            onClick={() => { store.dismissFallbackBanner(); }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </section>
  );
}
