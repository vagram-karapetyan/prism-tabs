import { ChevronDown, ChevronRight, Pencil, Unlink } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CHROME_TAB_GROUP_COLORS,
  type ChromeTabGroupColor,
  type ExistingTabGroup,
  type TabMetadata,
} from '../../domain/types';
import { type PopupStore } from '../state/popup.store';
import { resolveDraggedTabId } from '../utils/drag-drop';
import { CHROME_COLOR_LABELS } from '../utils/presentation';
import { HighlightedText, TabRow } from './TabRow';

function hasLegacyImeKeyCode(eventCompat: { readonly keyCode?: number }): boolean {
  return eventCompat.keyCode === 229;
}

interface GroupCardProps {
  store: PopupStore;
  group: ExistingTabGroup;
  tabs: TabMetadata[];
  query: string;
}

export function GroupCard({ store, group, tabs, query }: GroupCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(group.title);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isDropOver, setIsDropOver] = useState(false);
  const [collapsedForQuery, setCollapsedForQuery] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipNextBlurCommitRef = useRef(false);

  const trimmedQuery = query.trim();
  const hasSearch = trimmedQuery.length > 0;
  const isExpanded = hasSearch
    ? collapsedForQuery !== trimmedQuery
    : store.expandedGroupIds.value.includes(group.id);
  const draggingId = store.draggingTabId.value;

  useEffect(() => {
    if (isEditingTitle && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (draggingId === null && isDropOver) {
      setIsDropOver(false);
    }
  }, [draggingId, isDropOver]);

  function beginRename(): void {
    skipNextBlurCommitRef.current = false;
    setDraftTitle(group.title || group.cleanTitle);
    setIsEditingTitle(true);
    setIsPaletteOpen(false);
  }

  function commitRename(): void {
    setIsEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== group.title) {
      void store.renameGroup(group.id, trimmed);
    }
  }

  function cancelRename(): void {
    skipNextBlurCommitRef.current = true;
    setIsEditingTitle(false);
    setDraftTitle(group.title);
  }

  function handleColorPick(color: ChromeTabGroupColor): void {
    setIsPaletteOpen(false);
    if (color !== group.color) {
      void store.recolorGroup(group.id, color);
    }
  }

  return (
    <article
      class={`group-card${isDropOver ? ' is-drop-target' : ''}`}
      style={{ '--group-accent': `var(--chrome-${group.color}-dot)` }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isPaletteOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsPaletteOpen(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
        if (!isDropOver) setIsDropOver(true);
      }}
      onDragLeave={(event) => {
        const related = event.relatedTarget;
        if (
          !(
            typeof Node !== 'undefined' &&
            related instanceof Node &&
            event.currentTarget.contains(related)
          )
        ) {
          setIsDropOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropOver(false);
        const tabId = resolveDraggedTabId(store, event);
        if (tabId !== null) {
          void store.moveTab(tabId, group.id);
        }
      }}
    >
      <div class="group-card-header">
        <div class="group-card-left">
          <button
            type="button"
            class="group-expand-btn"
            aria-label={`${group.title || 'Untitled group'} tabs`}
            aria-expanded={isExpanded}
            onClick={() => {
              if (hasSearch) {
                setCollapsedForQuery((prev) => (prev === trimmedQuery ? null : trimmedQuery));
              } else {
                store.toggleGroupExpanded(group.id);
              }
            }}
          >
            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {isEditingTitle ? (
            <input
              ref={renameInputRef}
              type="text"
              class="inline-rename-input"
              aria-label="Rename group"
              autoFocus
              value={draftTitle}
              onInput={(event) => {
                setDraftTitle(event.currentTarget.value);
              }}
              onBlur={() => {
                if (skipNextBlurCommitRef.current) {
                  skipNextBlurCommitRef.current = false;
                  return;
                }
                commitRename();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelRename();
                  return;
                }
                if (event.isComposing || event.key === 'Process' || hasLegacyImeKeyCode(event)) {
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  skipNextBlurCommitRef.current = true;
                  commitRename();
                }
              }}
            />
          ) : (
            <span
              class="group-pill"
              style={{
                backgroundColor: `var(--chrome-${group.color}-bg)`,
                color: `var(--chrome-${group.color}-fg)`,
                borderColor: `var(--chrome-${group.color}-border)`,
              }}
              title="Double-click to rename group"
              onDblClick={() => {
                beginRename();
              }}
            >
              <span class="group-pill-title">
                <HighlightedText text={group.title || 'Untitled Group'} query={query} />
              </span>
            </span>
          )}

          <span class="group-count-badge" title={`${tabs.length} tabs in group`}>
            {tabs.length}
          </span>
        </div>

        <div class="group-actions">
          <button
            type="button"
            class="group-action-btn"
            aria-label={`Change color (${CHROME_COLOR_LABELS[group.color]})`}
            aria-expanded={isPaletteOpen}
            title="Change group color"
            onClick={() => {
              setIsPaletteOpen((prev) => !prev);
            }}
          >
            <span
              class="color-dot-btn"
              style={{ backgroundColor: `var(--chrome-${group.color}-dot)` }}
            />
          </button>

          <button
            type="button"
            class="group-action-btn"
            aria-label="Rename group"
            title="Rename group"
            onMouseDown={(event) => {
              if (isEditingTitle) {
                event.preventDefault();
              }
            }}
            onClick={() => {
              if (isEditingTitle) {
                skipNextBlurCommitRef.current = true;
                commitRename();
              } else {
                beginRename();
              }
            }}
          >
            <Pencil size={12} />
          </button>

          <button
            type="button"
            class="group-action-btn"
            aria-label="Ungroup this group"
            title="Ungroup tabs in this group"
            onClick={() => void store.ungroupGroup(group.id)}
          >
            <Unlink size={12} />
          </button>
        </div>
      </div>

      {isPaletteOpen && (
        <div class="swatch-picker" role="group" aria-label="Chrome tab group colors">
          {CHROME_TAB_GROUP_COLORS.map((color) => {
            const selected = color === group.color;
            return (
              <button
                key={color}
                type="button"
                class={`swatch-option${selected ? ' is-selected' : ''}`}
                aria-label={`Color ${CHROME_COLOR_LABELS[color]}`}
                aria-pressed={selected}
                title={CHROME_COLOR_LABELS[color]}
                onClick={() => {
                  handleColorPick(color);
                }}
              >
                <span
                  class="swatch-orb"
                  style={{ backgroundColor: `var(--chrome-${color}-dot)` }}
                />
              </button>
            );
          })}
        </div>
      )}

      {isExpanded && tabs.length > 0 && (
        <div class="group-tabs-list">
          {tabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              query={query}
              isDragging={draggingId === tab.id}
              onDragStart={(tabId, event) => {
                store.setDraggingTabId(tabId);
                event.dataTransfer?.setData('text/plain', String(tabId));
              }}
              onDragEnd={() => {
                store.setDraggingTabId(null);
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
