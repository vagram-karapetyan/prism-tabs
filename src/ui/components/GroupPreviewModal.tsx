import React, { useState } from 'react';
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
  Trash2,
  GitMerge,
} from 'lucide-react';

interface GroupPreviewListProps {
  plan: GroupingPlan | null;
  tabsById: Map<number, TabMetadata>;
  isLoading: boolean;
  choreography: SortChoreographyProgress | null;
  onUpdateGroup: (groupId: string, updates: Partial<ProposedTabGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
}

export const GroupPreviewList: React.FC<GroupPreviewListProps> = ({
  plan,
  tabsById,
  isLoading,
  choreography,
  onUpdateGroup,
  onRemoveGroup,
}) => {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [colorPickerGroupId, setColorPickerGroupId] = useState<string | null>(
    null
  );

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

  if (isLoading) {
    return (
      <div
        className="space-y-1.5 py-0.5 animate-fade-in"
        aria-label="Sorting tabs"
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-slate-800/80 bg-prism-surface/90 px-3 py-2.5 flex items-center justify-between"
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
      <div className="rounded-xl border border-slate-800/70 bg-prism-surface/60 p-5 text-center">
        <p className="text-xs text-slate-400">
          No groupable web tabs found in this window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[195px] overflow-y-auto pr-0.5 animate-fade-in">
      {plan.groups.map((group) => {
        const colorStyle =
          CHROME_COLOR_STYLES[group.color] ?? CHROME_COLOR_STYLES.grey;
        const isExpanded = expandedGroupIds.has(group.id);
        const isColorPickerOpen = colorPickerGroupId === group.id;
        const isExistingGroup = typeof group.existingGroupId === 'number';
        const addedCount = group.addedTabIds?.length ?? 0;
        const addedSet = new Set(group.addedTabIds ?? []);

        const isChoreoActive = choreography?.activeGroupId === group.id;
        const isChoreoCompleted =
          choreography?.completedGroupIds.includes(group.id) ?? false;

        return (
          <div
            key={group.id}
            className={`rounded-xl border transition-all duration-200 bg-prism-card/90 ${
              isChoreoActive
                ? 'ring-1 ring-indigo-400/80 border-white/40 shadow-sm'
                : isChoreoCompleted
                ? `${colorStyle.borderClass} bg-emerald-950/15`
                : `${colorStyle.borderClass} hover:border-slate-600/80`
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              {/* Left: Expand toggle + Color dot + Emoji + Editable Group Name */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleExpand(group.id)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
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
                  className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 rounded px-1 py-0.5 min-w-0 flex-1 truncate"
                  aria-label="Group name"
                />
              </div>

              {/* Right: Merge counter (only when new tabs added) + Tab count + Remove button */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isExistingGroup && addedCount > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300"
                    title={`Merged +${addedCount} tabs into "${group.groupName}"`}
                  >
                    <GitMerge className="w-2.5 h-2.5" />
                    <span>+{addedCount}</span>
                  </span>
                )}

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colorStyle.bgClass} ${colorStyle.textClass}`}
                >
                  {group.tabIds.length}
                </span>

                {!isExistingGroup && (
                  <button
                    type="button"
                    onClick={() => onRemoveGroup(group.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded"
                    title="Remove group from preview"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Inline Chrome Tab Group Color Swatch Bar */}
            {isColorPickerOpen && (
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/60">
                <span className="text-[10px] text-slate-400">Group color:</span>
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
                            ? 'scale-125 ring-2 ring-white'
                            : 'opacity-75 hover:opacity-100 hover:scale-110'
                        }`}
                        title={meta.label}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expanded Tab List */}
            {isExpanded && (
              <div className="px-3 pb-2 pt-1 border-t border-slate-800/60 space-y-1 bg-slate-950/30">
                {group.reasoning && (
                  <p className="text-[10px] text-slate-400 italic">
                    {group.reasoning}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.tabIds.map((tabId) => {
                    const tab = tabsById.get(tabId);
                    if (!tab) return null;
                    const isNewlyMerged =
                      isExistingGroup && addedSet.has(tabId);
                    const isTabGliding = choreography?.activeTabId === tabId;

                    return (
                      <li
                        key={tabId}
                        className={`flex items-center justify-between gap-2 text-[11px] truncate rounded px-1 py-0.5 ${
                          isTabGliding
                            ? 'bg-indigo-500/25 text-white font-medium'
                            : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isNewlyMerged
                                ? 'bg-emerald-400'
                                : 'bg-slate-500'
                            }`}
                          />
                          <span className="truncate" title={tab.title}>
                            {tab.title}
                          </span>
                        </div>
                        {isNewlyMerged && (
                          <span className="text-[9px] font-semibold text-emerald-300 shrink-0">
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
      })}
    </div>
  );
};
