import { ChevronsDownUp, ChevronsUpDown, Layers } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { type PopupStore } from '../state/popup.store';
import { resolveDraggedTabId } from '../utils/drag-drop';
import { GroupCard } from './GroupCard';
import { TabRow } from './TabRow';

interface GroupListProps {
  store: PopupStore;
}

export function GroupList({ store }: GroupListProps) {
  const [isUngroupedDropOver, setIsUngroupedDropOver] = useState(false);
  const draggingId = store.draggingTabId.value;

  useEffect(() => {
    if (draggingId === null && isUngroupedDropOver) {
      setIsUngroupedDropOver(false);
    }
  }, [draggingId, isUngroupedDropOver]);

  if (store.isLoading.value) {
    return (
      <main class="prism-scroll-area" aria-busy="true" aria-label="Loading window tabs">
        <div class="skeleton-stack">
          <div class="skeleton-card" />
          <div class="skeleton-card" />
          <div class="skeleton-card" />
        </div>
      </main>
    );
  }

  const query = store.searchQuery.value;
  const trimmedQuery = query.trim();
  const { groups, ungroupedTabs } = store.searchResult.value;
  const showUngroupedSection = ungroupedTabs.length > 0 || draggingId !== null;
  const expandedIds = store.expandedGroupIds.value;
  const allExpanded =
    groups.length > 0 && groups.every((entry) => expandedIds.includes(entry.group.id));

  function handleToggleExpandAll(): void {
    if (allExpanded) {
      for (const entry of groups) {
        if (expandedIds.includes(entry.group.id)) {
          store.toggleGroupExpanded(entry.group.id);
        }
      }
      return;
    }
    for (const entry of groups) {
      if (!expandedIds.includes(entry.group.id)) {
        store.toggleGroupExpanded(entry.group.id);
      }
    }
  }

  return (
    <main class="prism-scroll-area">
      {groups.length > 1 && !trimmedQuery && (
        <div class="workspace-bar">
          <span class="workspace-heading">Tab Groups ({groups.length})</span>
          <button
            type="button"
            class="workspace-toggle-btn"
            onClick={handleToggleExpandAll}
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp size={12} />
                <span>Collapse all</span>
              </>
            ) : (
              <>
                <ChevronsUpDown size={12} />
                <span>Expand all</span>
              </>
            )}
          </button>
        </div>
      )}

      {groups.length === 0 && !showUngroupedSection && (
        <div class="empty-state">
          <span class="empty-state-icon" aria-hidden="true">
            <Layers size={18} />
          </span>
          <span>
            {trimmedQuery
              ? `No tabs or groups match "${trimmedQuery}".`
              : 'No tabs in this window.'}
          </span>
          {trimmedQuery && (
            <button
              type="button"
              class="workspace-toggle-btn"
              onClick={() => {
                store.clearSearch();
              }}
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {groups.map((entry) => (
        <GroupCard
          key={entry.group.id}
          store={store}
          group={entry.group}
          tabs={entry.tabs}
          query={query}
        />
      ))}

      {showUngroupedSection && (
        <section
          class={`ungrouped-section${isUngroupedDropOver ? ' is-drop-target' : ''}`}
          aria-label="Ungrouped tabs"
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = 'move';
            }
            if (!isUngroupedDropOver) setIsUngroupedDropOver(true);
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
              setIsUngroupedDropOver(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsUngroupedDropOver(false);
            const tabId = resolveDraggedTabId(store, event);
            if (tabId !== null) {
              void store.moveTab(tabId, null);
            }
          }}
        >
          <div class="ungrouped-header">
            <span>
              {draggingId !== null && ungroupedTabs.length === 0
                ? 'Drop here to ungroup tab'
                : 'Ungrouped Tabs'}
            </span>
            <span class="group-count-badge">{ungroupedTabs.length}</span>
          </div>

          {ungroupedTabs.length > 0 && (
            <div class="group-tabs-list">
              {ungroupedTabs.map((tab) => (
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
        </section>
      )}
    </main>
  );
}
