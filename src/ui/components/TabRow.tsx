import { Globe } from 'lucide-preact';
import { type TabMetadata } from '../../domain/types';
import { splitHighlightSegments } from '../utils/search-filter';

export function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = splitHighlightSegments(text, query);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.matched ? (
          <mark key={idx} class="highlight-mark">
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface TabRowProps {
  tab: TabMetadata;
  query: string;
  isDragging: boolean;
  onDragStart: (tabId: number, event: DragEvent) => void;
  onDragEnd: () => void;
}

export function TabRow({ tab, query, isDragging, onDragStart, onDragEnd }: TabRowProps) {
  const host = getSafeHostname(tab.url);

  return (
    <div
      class={`tab-row${isDragging ? ' is-dragging' : ''}`}
      draggable
      title={`${tab.title}\n${tab.url}`}
      onDragStart={(event) => { onDragStart(tab.id, event); }}
      onDragEnd={onDragEnd}
    >
      {tab.favIconUrl ? (
        <img class="tab-favicon" src={tab.favIconUrl} alt="" width={14} height={14} />
      ) : (
        <Globe size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
      )}

      <span class="tab-title">
        <HighlightedText text={tab.title || tab.url || 'Untitled Tab'} query={query} />
      </span>

      {host && <span class="tab-host">{host}</span>}
    </div>
  );
}
