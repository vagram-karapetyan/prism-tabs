import type { ExistingTabGroup, TabMetadata, UndoSnapshot } from '../domain/types';

export function buildUndoSnapshot(
  windowId: number,
  tabs: readonly TabMetadata[],
  existingGroups: readonly ExistingTabGroup[],
  timestampMs: number,
): UndoSnapshot {
  const groupsById = new Map<number, ExistingTabGroup>();
  for (const g of existingGroups) {
    groupsById.set(g.id, g);
  }

  const entries = [...tabs]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((tab, fallbackIdx) => {
      const prevGroupId = typeof tab.groupId === 'number' && tab.groupId >= 0 ? tab.groupId : -1;
      const group = prevGroupId >= 0 ? groupsById.get(prevGroupId) : undefined;
      return {
        tabId: tab.id,
        index: tab.index ?? fallbackIdx,
        previousGroupId: prevGroupId,
        ...(group
          ? {
              groupTitle: group.title,
              groupColor: group.color,
              groupCollapsed: group.collapsed,
            }
          : {}),
      };
    });

  return {
    timestamp: timestampMs,
    windowId,
    entries,
  };
}
