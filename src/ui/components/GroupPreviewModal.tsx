import React, { useMemo, useState, useEffect } from 'react';
import {
  CHROME_TAB_GROUP_COLORS,
  ChromeTabGroupColor,
  GroupingPlan,
  ProposedTabGroup,
  SortChoreographyProgress,
  TabMetadata,
} from '../../engine/types';
import { CHROME_COLOR_STYLES } from '../colorPalette';
import {
  ChevronDown,
  ChevronRight,
  GitMerge,
  GripVertical,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface GroupPreviewListProps {
  plan: GroupingPlan | null;
  tabsById: Map<number, TabMetadata>;
  isLoading: boolean;
  choreography: SortChoreographyProgress | null;
  onUpdateGroup: (groupId: string, updates: Partial<ProposedTabGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
  onMoveTab?: (tabId: number, sourceGroupId: string, targetGroupId: string) => void;
}

export const GroupPreviewList: React.FC<GroupPreviewListProps> = ({
  plan,
  tabsById,
  isLoading,
  choreography,
  onUpdateGroup,
  onRemoveGroup,
  onMoveTab,
}) => {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [colorPickerGroupId, setColorPickerGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedTab, setDraggedTab] = useState<{ tabId: number; sourceGroupId: string } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Close color picker or clear search on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (colorPickerGroupId) {
          setColorPickerGroupId(null);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [colorPickerGroupId, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter groups and tabs when a search query is entered
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const { filteredGroups, totalMatches } = useMemo(() => {
    if (!plan || !plan.groups) {
      return { filteredGroups: [], totalMatches: 0 };
    }
    if (!normalizedQuery) {
      return { filteredGroups: plan.groups, totalMatches: 0 };
    }

    let matches = 0;
    const result: ProposedTabGroup[] = [];

    for (const group of plan.groups) {
      const groupNameMatch = group.groupName.toLowerCase().includes(normalizedQuery);
      const matchingTabIds: number[] = [];

      for (const tabId of group.tabIds) {
        const tab = tabsById.get(tabId);
        if (!tab) continue;
        const titleMatch = tab.title.toLowerCase().includes(normalizedQuery);
        const urlMatch = tab.url.toLowerCase().includes(normalizedQuery);
        if (titleMatch || urlMatch || groupNameMatch) {
          matchingTabIds.push(tabId);
          matches++;
        }
      }

      if (groupNameMatch || matchingTabIds.length > 0) {
        result.push(group);
      }
    }

    return { filteredGroups: result, totalMatches: matches };
  }, [plan, normalizedQuery, tabsById]);

  if (isLoading) {
    return (
      <div className="space-y-1.5 py-0.5 animate-fade-in" aria-label="Sorting tabs">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-prism-surface/90 px-3 py-2.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full skeleton-shimmer" />
              <div className="w-32 h-3.5 rounded skeleton-shimmer" />
            </div>
            <div className="w-10 h-3.5 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (!plan || plan.groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/70 bg-prism-surface/60 p-5 text-center shadow-2xs">
        <p className="text-xs text-slate-800 dark:text-slate-300 font-semibold">
          Ready to cluster tabs
        </p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
          Click <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Prism Tabs</span> or press{' '}
          <kbd className="rounded bg-slate-100 dark:bg-black/40 px-1 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10">
            Alt+P
          </kbd>
        </p>
      </div>
    );
  }

  const showSearchBar = plan.groups.reduce((acc, g) => acc + g.tabIds.length, 0) >= 3;

  return (
    <div className="space-y-1.5 animate-fade-in">
      {/* Inline Instant Tab & Group Search Filter */}
      {showSearchBar && (
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tabs or groups..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800/80 bg-prism-surface/80 pl-7 pr-7 py-1 text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-2xs transition-all"
            aria-label="Filter tabs"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              aria-label="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
          {normalizedQuery && (
            <span className="absolute right-6 text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 rounded">
              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>
      )}

      {/* Render Groups */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-prism-surface/60 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
          No tabs match &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        filteredGroups.map((group) => {
          const colorStyle = CHROME_COLOR_STYLES[group.color] ?? CHROME_COLOR_STYLES.grey;
          const isExpanded = Boolean(normalizedQuery) || expandedGroupIds.has(group.id);
          const isColorPickerOpen = colorPickerGroupId === group.id;
          const isExistingGroup = typeof group.existingGroupId === 'number';
          const addedCount = group.addedTabIds?.length ?? 0;
          const addedSet = new Set(group.addedTabIds ?? []);

          const isChoreoActive = choreography?.activeGroupId === group.id;
          const isChoreoCompleted = choreography?.completedGroupIds.includes(group.id) ?? false;
          const isDragOver = dragOverGroupId === group.id;

          return (
            <div
              key={group.id}
              onDragOver={(e) => {
                if (draggedTab && draggedTab.sourceGroupId !== group.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverGroupId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverGroupId(null);
                if (draggedTab && draggedTab.sourceGroupId !== group.id) {
                  onMoveTab?.(draggedTab.tabId, draggedTab.sourceGroupId, group.id);
                  setDraggedTab(null);
                }
              }}
              className={`rounded-xl border transition-all duration-200 bg-prism-card/90 shadow-2xs ${
                isDragOver
                  ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20'
                  : isChoreoActive
                  ? 'ring-1 ring-indigo-400/80 border-indigo-400/60 shadow-sm'
                  : isChoreoCompleted
                  ? `${colorStyle.borderClass} bg-emerald-50 dark:bg-emerald-950/15`
                  : `${colorStyle.borderClass} hover:border-slate-400 dark:hover:border-slate-600/80`
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                {/* Left: Expand toggle + Color dot + Emoji + Editable Group Name */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.id)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors p-0.5"
                    title={isExpanded ? 'Collapse tabs' : 'View tabs in group'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Native Chrome Color Dot Picker Trigger */}
                  <button
                    type="button"
                    onClick={() =>
                      setColorPickerGroupId(isColorPickerOpen ? null : group.id)
                    }
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-125 ${
                      isChoreoActive ? 'animate-ping' : ''
                    }`}
                    style={{ backgroundColor: colorStyle.hex }}
                    title={`Color: ${colorStyle.label}`}
                  />

                  <span className="text-xs select-none">{group.emoji}</span>

                  <input
                    type="text"
                    value={group.groupName}
                    onChange={(e) =>
                      onUpdateGroup(group.id, { groupName: e.target.value })
                    }
                    className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 rounded px-1 py-0.5 min-w-0 flex-1 truncate"
                    aria-label="Group name"
                  />
                </div>

                {/* Right: Merge counter + Tab count + Ungroup/Remove button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isExistingGroup && addedCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      title={`Merged +${addedCount} tabs into "${group.groupName}"`}
                    >
                      <GitMerge className="w-2.5 h-2.5" />
                      <span>+{addedCount}</span>
                    </span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorStyle.bgClass} ${colorStyle.textClass}`}
                  >
                    {group.tabIds.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveGroup(group.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded"
                    title={
                      isExistingGroup
                        ? 'Ungroup tabs in this cluster (keeps tabs open)'
                        : 'Remove group from preview'
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Inline Chrome Tab Group Color Swatch Bar */}
              {isColorPickerOpen && (
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                    Group color:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {CHROME_TAB_GROUP_COLORS.map((c: ChromeTabGroupColor) => {
                      const meta = CHROME_COLOR_STYLES[c];
                      const selected = c === group.color;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            onUpdateGroup(group.id, { color: c });
                            setColorPickerGroupId(null);
                          }}
                          style={{ backgroundColor: meta.hex }}
                          className={`w-3 h-3 rounded-full transition-transform ${
                            selected
                              ? 'scale-125 ring-2 ring-indigo-500 dark:ring-white'
                              : 'opacity-75 hover:opacity-100 hover:scale-110'
                          }`}
                          title={meta.label}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expanded Tab List with Drag-and-Drop */}
              {isExpanded && (
                <div className="px-3 pb-2 pt-1 border-t border-slate-200 dark:border-slate-800/60 space-y-1 bg-slate-50/70 dark:bg-slate-950/30">
                  {group.reasoning && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                      {group.reasoning}
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {group.tabIds.map((tabId) => {
                      const tab = tabsById.get(tabId);
                      if (!tab) return null;
                      const isNewlyMerged = isExistingGroup && addedSet.has(tabId);
                      const isTabGliding = choreography?.activeTabId === tabId;
                      const isTabDragged = draggedTab?.tabId === tabId;

                      const isMatchedBySearch =
                        normalizedQuery &&
                        (tab.title.toLowerCase().includes(normalizedQuery) ||
                          tab.url.toLowerCase().includes(normalizedQuery));

                      return (
                        <li
                          key={tabId}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(tabId));
                            setDraggedTab({ tabId, sourceGroupId: group.id });
                          }}
                          onDragEnd={() => {
                            setDraggedTab(null);
                            setDragOverGroupId(null);
                          }}
                          className={`group/tab flex items-center justify-between gap-1.5 text-[11px] truncate rounded px-1 py-0.5 cursor-grab active:cursor-grabbing transition-all ${
                            isTabDragged
                              ? 'opacity-40 scale-95'
                              : isTabGliding
                              ? 'bg-indigo-500/25 text-indigo-900 dark:text-white font-medium'
                              : isMatchedBySearch
                              ? 'bg-amber-100/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                          }`}
                          title={`${tab.title}\n(Drag to move to another group)`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <GripVertical className="w-2.5 h-2.5 text-slate-400/60 opacity-0 group-hover/tab:opacity-100 transition-opacity shrink-0" />
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isNewlyMerged
                                  ? 'bg-emerald-500 dark:bg-emerald-400'
                                  : 'bg-slate-400 dark:bg-slate-500'
                              }`}
                            />
                            <span className="truncate">{tab.title}</span>
                          </div>
                          {isNewlyMerged && (
                            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                              +new
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
