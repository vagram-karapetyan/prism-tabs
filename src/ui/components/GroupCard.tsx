import { ChevronDown, ChevronRight, Pencil, Unlink } from 'lucide-preact';
import { useState } from 'preact/hooks';
import {
  CHROME_TAB_GROUP_COLORS,
  type ChromeTabGroupColor,
  type ExistingTabGroup,
  type TabMetadata,
} from '../../domain/types';
import { type PopupStore } from '../state/popup.store';
import { resolveDraggedTabId } from '../utils/drag-drop';
import { HighlightedText, TabRow } from './TabRow';

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

  const hasSearch = query.trim().length > 0;
  const isExpanded = hasSearch || store.expandedGroupIds.value.includes(group.id);
  const draggingId = store.draggingTabId.value;

  function beginRename(): void {
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
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
        if (!isDropOver) setIsDropOver(true);
      }}
      onDragLeave={() => {
        if (isDropOver) setIsDropOver(false);
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
            aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
            aria-expanded={isExpanded}
            onClick={() => { store.toggleGroupExpanded(group.id); }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {isEditingTitle ? (
            <input
              type="text"
              class="inline-rename-input"
              aria-label="Rename group"
              autoFocus
              value={draftTitle}
              onInput={(event) => { setDraftTitle(event.currentTarget.value); }}
              onBlur={() => { commitRename(); }}
              onKeyDown={(event) => {
                if (event.isComposing) return;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitRename();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelRename();
                }
              }}
            />
          ) : (
            <span
              class="group-pill"
              style={{
                backgroundColor: `var(--chrome-${group.color}-bg)`,
                color: `var(--chrome-${group.color}-fg)`,
              }}
              title="Double-click to rename group"
              onDblClick={() => { beginRename(); }}
            >
              <span class="group-pill-title">
                <HighlightedText text={group.title || 'Untitled Group'} query={query} />
              </span>
            </span>
          )}

          <span class="group-count-badge">{tabs.length}</span>
        </div>

        <div class="group-actions">
          <button
            type="button"
            class="group-action-btn"
            aria-label="Change group color"
            aria-expanded={isPaletteOpen}
            title="Change group color"
            onClick={() => { setIsPaletteOpen((prev) => !prev); }}
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
            onClick={() => { beginRename(); }}
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
        <div class="swatch-picker" role="group" aria-label="Chrome group colors">
          {CHROME_TAB_GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              class={`swatch-option${color === group.color ? ' is-selected' : ''}`}
              style={{ backgroundColor: `var(--chrome-${color}-dot)` }}
              aria-label={`Color ${color}`}
              title={color}
              onClick={() => { handleColorPick(color); }}
            />
          ))}
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
              onDragEnd={() => { store.setDraggingTabId(null); }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
