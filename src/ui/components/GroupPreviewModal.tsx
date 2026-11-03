import React, { useState } from 'react';
import {
  CHROME_TAB_GROUP_COLORS,
  ChromeTabGroupColor,
  GroupingPlan,
  ProposedTabGroup,
  SortChoreographyProgress,
  TabMetadata,
  TabStripOrientation,
} from '../../engine/types';
import { CHROME_COLOR_STYLES } from '../colorPalette';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trash2,
  AlertTriangle,
  Cpu,
  GitMerge,
  Lock,
} from 'lucide-react';

interface GroupPreviewListProps {
  plan: GroupingPlan | null;
  tabsById: Map<number, TabMetadata>;
  isLoading: boolean;
  orientation: TabStripOrientation;
  choreography: SortChoreographyProgress | null;
  onUpdateGroup: (groupId: string, updates: Partial<ProposedTabGroup>) => void;
  onRemoveGroup: (groupId: string) => void;
  onConfirmApply: () => void;
  isApplying: boolean;
}

export const GroupPreviewList: React.FC<GroupPreviewListProps> = ({
  plan,
  tabsById,
  isLoading,
  orientation,
  choreography,
  onUpdateGroup,
  onRemoveGroup,
  onConfirmApply,
  isApplying,
}) => {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [colorPickerGroupId, setColorPickerGroupId] = useState<string | null>(null);

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
      <div className="space-y-2.5 py-1 animate-fade-in" aria-label="Loading semantic groups">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-slate-800/80 bg-prism-surface/90 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md skeleton-shimmer" />
                <div className="w-32 h-4 rounded skeleton-shimmer" />
              </div>
              <div className="w-12 h-4 rounded-full skeleton-shimmer" />
            </div>
            <div className="w-3/4 h-3 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (!plan || plan.groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800/70 bg-prism-surface/60 p-6 text-center">
        <p className="text-xs text-slate-400">
          No groupable web tabs found in this window. Open a few tabs or adjust your minimum tab rules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Fallback Warning Banner if Meaning Mode gracefully fell back to Logic Mode */}
      {plan.fallbackTriggered && plan.fallbackReason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{plan.fallbackReason}</span>
        </div>
      )}

      {/* Header bar with latency & orientation indicator */}
      <div className="flex items-center justify-between px-0.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-300">
          {plan.modeUsed === 'meaning' ? (
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>
            {orientation === 'vertical' ? 'Vertical Tree' : 'Tab Strip'} Clusters (
            {plan.groups.length})
          </span>
        </span>
        <span>
          Computed in <strong className="text-slate-200">{plan.latencyMs}ms</strong>
        </span>
      </div>

      {/* Scrollable Group Cards (Adapts to Horizontal vs Vertical Tree styling) */}
      <div
        className={`space-y-2 max-h-[225px] overflow-y-auto pr-1 ${
          orientation === 'vertical'
            ? 'pl-2.5 border-l-2 border-indigo-500/30'
            : ''
        }`}
      >
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
              style={
                orientation === 'vertical'
                  ? { borderLeftColor: colorStyle.hex, borderLeftWidth: '3px' }
                  : undefined
              }
              className={`rounded-xl border transition-all duration-300 bg-prism-card/90 ${
                isChoreoActive
                  ? 'ring-2 ring-indigo-400/80 border-white/50 shadow-[0_0_16px_rgba(99,102,241,0.35)] scale-[1.01]'
                  : isChoreoCompleted
                  ? `${colorStyle.borderClass} bg-emerald-950/15`
                  : `${colorStyle.borderClass} hover:border-slate-600/80`
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                {/* Left: Expand toggle + Color dot + Emoji + Editable Group Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.id)}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                    title={isExpanded ? 'Collapse tabs' : 'Inspect tabs in group'}
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
                    className={`w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-prism-card transition-transform hover:scale-125 ${
                      isChoreoActive ? 'animate-ping' : ''
                    } ${colorStyle.dotClass}`}
                    style={{ backgroundColor: colorStyle.hex }}
                    title={`Color: ${colorStyle.label} (click to change)`}
                  />

                  <span className="text-sm select-none">{group.emoji}</span>

                  <input
                    type="text"
                    value={group.groupName}
                    onChange={(e) =>
                      onUpdateGroup(group.id, { groupName: e.target.value })
                    }
                    className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 rounded px-1 py-0.5 min-w-0 flex-1 truncate"
                    aria-label="Group name"
                  />
                </div>

                {/* Right: Smart Merge / Existing Status Badge + Tab count + Remove button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isChoreoActive && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/30 text-indigo-200 animate-pulse">
                      {choreography?.phase === 'merging'
                        ? 'Merging…'
                        : 'Gliding…'}
                    </span>
                  )}

                  {isExistingGroup && addedCount > 0 && !isChoreoActive && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      title={`Preserves your existing "${group.groupName}" group and merges +${addedCount} matching ungrouped tabs into it`}
                    >
                      <GitMerge className="w-2.5 h-2.5" />
                      <span>+{addedCount} Merge</span>
                    </span>
                  )}

                  {isExistingGroup && addedCount === 0 && !isChoreoActive && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-800 text-slate-400 border border-slate-700"
                      title="Existing group preserved untouched"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>Kept</span>
                    </span>
                  )}

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorStyle.bgClass} ${colorStyle.textClass}`}
                  >
                    {group.tabIds.length}{' '}
                    {group.tabIds.length === 1 ? 'tab' : 'tabs'}
                  </span>

                  {!isExistingGroup && (
                    <button
                      type="button"
                      onClick={() => onRemoveGroup(group.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-slate-800/60"
                      title="Skip this group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Chrome Tab Group Color Swatch Bar */}
              {isColorPickerOpen && (
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/60">
                  <span className="text-[10px] text-slate-400">Chrome Tab Color:</span>
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
                          className={`w-3.5 h-3.5 rounded-full transition-transform ${
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

              {/* Expanded Tab List & AI / Smart Merge Reasoning */}
              {isExpanded && (
                <div className="px-3 pb-2.5 pt-1 border-t border-slate-800/60 space-y-1.5 bg-slate-950/30">
                  {group.reasoning && (
                    <p className="text-[10px] text-slate-400 italic">
                      {group.reasoning}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {group.tabIds.map((tabId) => {
                      const tab = tabsById.get(tabId);
                      if (!tab) return null;
                      const isNewlyMerged = isExistingGroup && addedSet.has(tabId);
                      const isTabGliding = choreography?.activeTabId === tabId;

                      return (
                        <li
                          key={tabId}
                          className={`flex items-center justify-between gap-2 text-[11px] truncate rounded px-1 py-0.5 transition-colors ${
                            isTabGliding
                              ? 'bg-indigo-500/25 text-white font-medium'
                              : 'text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isNewlyMerged ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span className="truncate" title={tab.title}>
                              {tab.title}
                            </span>
                          </div>
                          {isNewlyMerged && (
                            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 rounded shrink-0">
                              +NEW
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

      {/* Confirm & Apply Button */}
      <button
        type="button"
        disabled={isApplying || plan.groups.length === 0}
        onClick={onConfirmApply}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-500 active:scale-[0.99] text-white font-semibold text-xs py-2.5 px-4 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
      >
        <Check className="w-4 h-4" />
        <span>
          {isApplying
            ? 'Choreographing Chrome Tab Strip…'
            : `Apply & Sync ${plan.groups.length} Chrome Tab ${
                plan.groups.length === 1 ? 'Group' : 'Groups'
              }`}
        </span>
      </button>
    </div>
  );
};
