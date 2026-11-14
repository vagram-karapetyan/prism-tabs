import { Globe, GripVertical, Moon, Pin, Volume2 } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type TabMetadata } from '../../domain/types';
import { getSafeHostname } from '../utils/presentation';
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

interface TabRowProps {
  tab: TabMetadata;
  query: string;
  isDragging: boolean;
  onDragStart: (tabId: number, event: DragEvent) => void;
  onDragEnd: () => void;
}

export function TabRow({ tab, query, isDragging, onDragStart, onDragEnd }: TabRowProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFaviconFailed(false);
  }, [tab.favIconUrl]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFaviconFailed(true);
    }
  }, [tab.favIconUrl, faviconFailed]);

  const host = getSafeHostname(tab.url);
  const showFavicon = Boolean(tab.favIconUrl) && !faviconFailed;

  const rowClass = [
    'tab-row',
    tab.active ? 'is-active-tab' : '',
    tab.discarded ? 'is-discarded' : '',
    isDragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={rowClass}
      draggable
      title={`${tab.title}\n${tab.url}`}
      onDragStart={(event) => {
        onDragStart(tab.id, event);
      }}
      onDragEnd={onDragEnd}
    >
      <span class="tab-drag-grip" aria-hidden="true">
        <GripVertical size={11} />
      </span>

      <span class="tab-favicon-wrap" aria-hidden="true">
        {showFavicon ? (
          <img
            ref={imgRef}
            class="tab-favicon"
            src={tab.favIconUrl}
            alt=""
            width={14}
            height={14}
            onLoad={(event) => {
              if (event.currentTarget.naturalWidth === 0) {
                setFaviconFailed(true);
              }
            }}
            onError={() => {
              setFaviconFailed(true);
            }}
          />
        ) : (
          <Globe size={13} style={{ color: 'var(--text-muted)' }} />
        )}
      </span>

      <span class="tab-title">
        <HighlightedText text={tab.title || tab.url || 'Untitled Tab'} query={query} />
      </span>

      <span class="tab-meta-trail">
        {tab.active && <span class="tab-state-dot" title="Active tab" aria-label="Active tab" />}
        {tab.audible && (
          <span class="tab-state-icon is-audible" title="Playing audio">
            <Volume2 size={11} />
          </span>
        )}
        {tab.discarded && (
          <span class="tab-state-icon" title="Hibernated (RAM saved)">
            <Moon size={11} />
          </span>
        )}
        {tab.pinned && (
          <span class="tab-state-icon" title="Pinned tab">
            <Pin size={11} />
          </span>
        )}
        {host && (
          <span class="tab-host">
            <HighlightedText text={host} query={query} />
          </span>
        )}
      </span>
    </div>
  );
}
