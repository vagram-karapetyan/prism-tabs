import React from 'react';
import {
  EngineMode,
  ProposedTabGroup,
  SortChoreographyProgress,
  TabStripOrientation,
} from '../../engine/types';
import { CHROME_COLOR_STYLES } from '../colorPalette';
import { Columns, Rows } from 'lucide-react';

interface PrismRefractionBarProps {
  isSorting: boolean;
  mode: EngineMode;
  providerLabel?: string;
  orientation: TabStripOrientation;
  onToggleOrientation: (next: TabStripOrientation) => void;
  tabCount: number;
  groups: ProposedTabGroup[];
  choreography: SortChoreographyProgress | null;
}

const SPECTRAL_BANDS = [
  { color: '#F28B82', label: 'red' },
  { color: '#FCAD70', label: 'orange' },
  { color: '#FDD663', label: 'yellow' },
  { color: '#81C995', label: 'green' },
  { color: '#78D9EC', label: 'cyan' },
  { color: '#8AB4F8', label: 'blue' },
  { color: '#C58AF9', label: 'purple' },
  { color: '#FF8BCB', label: 'pink' },
];

export const PrismRefractionBar: React.FC<PrismRefractionBarProps> = ({
  isSorting,
  mode,
  providerLabel = 'Groq',
  orientation,
  onToggleOrientation,
  tabCount,
  groups,
  choreography,
}) => {
  const isChoreographing =
    Boolean(choreography) && choreography?.phase !== 'idle';
  const activeBeam = isSorting || isChoreographing;
  const mergedExistingCount = groups.filter(
    (g) =>
      typeof g.existingGroupId === 'number' && (g.addedTabIds?.length ?? 0) > 0
  ).length;

  const progressPercent = isChoreographing
    ? Math.max(8, Math.round((choreography?.progressRatio ?? 0) * 100))
    : isSorting
    ? 65
    : 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-950 via-[#0E1320] to-slate-950 px-3.5 py-2.5 shadow-inner space-y-2">
      {/* Laser Light-Beam Progress Track */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-900/90 overflow-hidden">
        <div
          style={{ width: `${progressPercent}%` }}
          className={`h-full transition-all duration-300 ${
            activeBeam
              ? 'prism-spectral-bar-active shadow-[0_0_10px_rgba(255,255,255,0.8)]'
              : 'prism-spectral-bar opacity-60'
          }`}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Left: Incoming White Light Beam + Crystalline Prism */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex items-center w-24 h-7 select-none shrink-0">
            {/* Incoming coherent white beam */}
            <div
              className={`h-[2.5px] rounded-full bg-gradient-to-r from-transparent via-slate-200 to-white transition-all duration-300 ${
                activeBeam
                  ? 'w-9 shadow-[0_0_12px_rgba(255,255,255,0.95)] scale-y-125'
                  : 'w-7 opacity-80'
              }`}
            />

            {/* Prism SVG */}
            <svg
              viewBox="0 0 36 36"
              className={`w-6 h-6 -mx-1 z-10 transition-transform duration-500 ${
                activeBeam
                  ? 'scale-110 drop-shadow-[0_0_10px_rgba(165,180,252,0.75)]'
                  : ''
              }`}
              fill="none"
            >
              <polygon
                points="18,4 4,31 32,31"
                fill="rgba(226, 232, 240, 0.12)"
                stroke="#E2E8F0"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <polygon
                points="18,9 9,28 27,28"
                fill="rgba(99, 102, 241, 0.14)"
              />
            </svg>

            {/* Refracted Spectral Rays */}
            <div className="flex flex-col justify-center gap-[1.5px] flex-1 pl-0.5">
              {SPECTRAL_BANDS.map((band, idx) => (
                <div
                  key={band.label}
                  style={{
                    backgroundColor: band.color,
                    transitionDelay: `${idx * 20}ms`,
                  }}
                  className={`h-[2px] rounded-r-full transition-all duration-300 ${
                    activeBeam
                      ? 'w-full opacity-100 shadow-[0_0_6px_currentColor] translate-x-0.5'
                      : 'w-8 opacity-75'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-slate-200 truncate">
                {isChoreographing
                  ? choreography?.phase === 'merging'
                    ? 'Merging into Existing Groups…'
                    : 'Choreographing Tab Strip…'
                  : isSorting
                  ? mode === 'meaning'
                    ? 'Refracting by Meaning…'
                    : 'Refracting by Logic…'
                  : mergedExistingCount > 0
                  ? `Smart Merge (+${mergedExistingCount} existing)`
                  : 'Spectrum Synchronized'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {tabCount} {tabCount === 1 ? 'tab' : 'tabs'} →{' '}
              <span className="text-slate-200 font-medium">
                {groups.length} {groups.length === 1 ? 'group' : 'groups'}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Orientation Switcher (Horizontal vs Vertical Tab Strip) + Engine Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5"
            title="Switch Tab Strip Choreography Layout (Horizontal Top Bar vs. Vertical Side Panel)"
          >
            <button
              type="button"
              onClick={() => onToggleOrientation('horizontal')}
              className={`p-1 rounded-md transition-colors ${
                orientation === 'horizontal'
                  ? 'bg-slate-800 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Horizontal Tab Strip Mode"
              aria-label="Horizontal Tab Strip Mode"
            >
              <Columns className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onToggleOrientation('vertical')}
              className={`p-1 rounded-md transition-colors ${
                orientation === 'vertical'
                  ? 'bg-slate-800 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Vertical Tab Tree Mode (Side Panel / Brave / Edge)"
              aria-label="Vertical Tab Tree Mode"
            >
              <Rows className="w-3 h-3" />
            </button>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              mode === 'meaning'
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeBeam
                  ? 'animate-ping bg-white'
                  : mode === 'meaning'
                  ? 'bg-indigo-400'
                  : 'bg-emerald-400'
              }`}
            />
            {mode === 'meaning' ? providerLabel : '0ms'}
          </span>
        </div>
      </div>

      {/* Live Layout-Aware Miniature Tab Strip Visualizer */}
      {groups.length > 0 && (
        <div
          className={
            orientation === 'horizontal'
              ? 'flex items-center gap-1 pt-0.5 overflow-x-auto no-scrollbar'
              : 'grid grid-cols-3 gap-1 pt-0.5'
          }
          aria-label={`Tab strip preview (${orientation})`}
        >
          {groups.map((g, idx) => {
            const meta = CHROME_COLOR_STYLES[g.color] ?? CHROME_COLOR_STYLES.grey;
            const isGroupActive = choreography?.activeGroupId === g.id;
            const isGroupDone =
              choreography?.completedGroupIds.includes(g.id) ?? false;
            const isExisting = typeof g.existingGroupId === 'number';

            return (
              <div
                key={g.id}
                style={{
                  animationDelay: `${idx * 35}ms`,
                  borderColor: isGroupActive ? meta.hex : undefined,
                }}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] transition-all duration-200 ${
                  orientation === 'horizontal'
                    ? 'animate-tab-glide-h shrink-0'
                    : 'animate-tab-glide-v truncate'
                } ${
                  isGroupActive
                    ? 'bg-white/10 ring-1 ring-white/60 scale-105 shadow-sm'
                    : isGroupDone
                    ? `${meta.bgClass} ${meta.borderClass} opacity-100`
                    : `${meta.bgClass} ${meta.borderClass} opacity-85`
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isGroupActive ? 'animate-ping' : ''
                  }`}
                  style={{ backgroundColor: meta.hex }}
                />
                <span className="truncate max-w-[68px] font-medium text-slate-200">
                  {g.emoji} {g.groupName}
                </span>
                {isExisting && (g.addedTabIds?.length ?? 0) > 0 && (
                  <span className="text-[8px] font-bold text-emerald-300">
                    +{g.addedTabIds?.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
