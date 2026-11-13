import { useState } from 'preact/hooks';
import { type PopupStore } from '../state/popup.store';
import { resolveDraggedTabId } from '../utils/drag-drop';
import { GroupCard } from './GroupCard';
import { TabRow } from './TabRow';

interface GroupListProps {
  store: PopupStore;
}

export function GroupList({ store }: GroupListProps) {
  const [isUngroupedDropOver, setIsUngroupedDropOver] = useState(false);

  if (store.isLoading.value) {
    return (
      <main class="prism-scroll-area">
        <div class="empty-state">Loading window tabs...</div>
      </main>
    );
  }

  const query = store.searchQuery.value;
  const { groups, ungroupedTabs } = store.searchResult.value;
  const draggingId = store.draggingTabId.value;
  const showUngroupedSection = ungroupedTabs.length > 0 || draggingId !== null;

  return (
    <main class="prism-scroll-area">
      {groups.length === 0 && !showUngroupedSection && (
        <div class="empty-state">
          {query.trim()
            ? `No tabs or groups match "${query.trim()}".`
            : 'No tabs in this window.'}
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
          onDragLeave={() => {
            if (isUngroupedDropOver) setIsUngroupedDropOver(false);
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
                  onDragEnd={() => { store.setDraggingTabId(null); }}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
