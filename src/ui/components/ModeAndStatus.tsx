import { AlertTriangle, Sparkles, X, Zap } from 'lucide-preact';
import { type EngineMode } from '../../domain/types';
import { type PopupStore } from '../state/popup.store';
import { getAiStatusBadge, handleTabListKeyDown } from '../utils/presentation';

interface ModeAndStatusProps {
  store: PopupStore;
}

const ENGINE_MODES: readonly EngineMode[] = ['logic', 'meaning'];

export function ModeAndStatus({ store }: ModeAndStatusProps) {
  const settings = store.settings.value;
  const mode = settings.mode;
  const maxLimit = settings.maxTabsPerGroup;
  const isSorting = store.isSorting.value;
  const totalTabs = store.tabs.value.length;
  const totalGroups = store.groups.value.length;
  const ungrouped = store.ungroupedCount.value;
  const fallbackBanner = store.fallbackBanner.value;
  const aiStatus = getAiStatusBadge(settings);

  const onTabKeyDown = (event: KeyboardEvent): void => {
    if (isSorting) return;
    handleTabListKeyDown(event, ENGINE_MODES, mode, (nextMode) => {
      void store.setMode(nextMode);
    });
  };

  return (
    <div class="console-deck">
      <div class="mode-switch" role="tablist" aria-label="Grouping Engine Mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'logic'}
          tabIndex={mode === 'logic' ? 0 : -1}
          class="mode-switch-btn"
          disabled={isSorting}
          onKeyDown={onTabKeyDown}
          onClick={() => void store.setMode('logic')}
        >
          <span class="mode-btn-lead">
            <span class="mode-btn-icon" aria-hidden="true">
              <Zap size={13} />
            </span>
            <span class="mode-btn-title">Logic Mode</span>
          </span>
          <span class="mode-btn-tag">Local</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'meaning'}
          tabIndex={mode === 'meaning' ? 0 : -1}
          class="mode-switch-btn"
          disabled={isSorting}
          onKeyDown={onTabKeyDown}
          onClick={() => void store.setMode('meaning')}
        >
          <span class="mode-btn-lead">
            <span class="mode-btn-icon" aria-hidden="true">
              <Sparkles size={13} />
            </span>
            <span class="mode-btn-title">Meaning Mode</span>
          </span>
          <span class={`mode-btn-tag${!aiStatus.ready && mode === 'meaning' ? ' is-warning' : ''}`}>
            {aiStatus.label}
          </span>
        </button>
      </div>

      <div class={`refraction-bar${isSorting ? ' is-active' : ''}`}>
        {isSorting ? (
          <span class="telemetry-readout">{store.sortPhase.value}</span>
        ) : (
          <div class="telemetry-readout">
            <span>
              <span class="telemetry-num">{totalTabs}</span> tabs
            </span>
            <span class="telemetry-sep" aria-hidden="true">
              ·
            </span>
            <span>
              <span class="telemetry-num">{totalGroups}</span> groups
            </span>
            <span class="telemetry-sep" aria-hidden="true">
              ·
            </span>
            <span>
              <span class="telemetry-num">{ungrouped}</span> free
            </span>
          </div>
        )}

        <button
          type="button"
          class="telemetry-cap-btn"
          title="Configure maximum tabs per group"
          onClick={() => {
            store.openSettings('general');
          }}
        >
          {maxLimit === null ? 'Cap ∞' : `Cap ${maxLimit}`}
        </button>

        <div class="refraction-beam" aria-hidden="true" />
      </div>

      {fallbackBanner !== null && (
        <div class="banner banner-warning" role="status">
          <div class="banner-lead">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{fallbackBanner}</span>
          </div>
          <button
            type="button"
            class="banner-close-btn"
            aria-label="Dismiss notice"
            onClick={() => {
              store.dismissFallbackBanner();
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
