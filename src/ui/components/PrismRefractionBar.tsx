import React from 'react';
import {
  EngineMode,
  ProposedTabGroup,
  SortChoreographyProgress,
} from '../../engine/types';

interface PrismRefractionBarProps {
  isSorting: boolean;
  mode: EngineMode;
  providerLabel?: string;
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
  tabCount,
  groups,
  choreography,
}) => {
  const isChoreographing =
    Boolean(choreography) && choreography?.phase !== 'idle';
  const activeBeam = isSorting || isChoreographing;

  const progressPercent = isChoreographing
    ? Math.max(8, Math.round((choreography?.progressRatio ?? 0) * 100))
    : isSorting
    ? 65
    : 100;

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-gradient-to-r from-slate-950 via-[#0E1320] to-slate-950 px-3.5 py-2.5 shadow-inner">
      {/* Laser Light-Beam Progress Track */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900/90 overflow-hidden">
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
          <div className="relative flex items-center w-20 h-6 select-none shrink-0">
            {/* Incoming coherent white beam */}
            <div
              className={`h-[2px] rounded-full bg-gradient-to-r from-transparent via-slate-200 to-white transition-all duration-300 ${
                activeBeam
                  ? 'w-7 shadow-[0_0_12px_rgba(255,255,255,0.95)] scale-y-125'
                  : 'w-6 opacity-80'
              }`}
            />

            {/* Prism SVG */}
            <svg
              viewBox="0 0 36 36"
              className={`w-5 h-5 -mx-1 z-10 transition-transform duration-500 ${
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
                  className={`h-[1.5px] rounded-r-full transition-all duration-300 ${
                    activeBeam
                      ? 'w-full opacity-100 shadow-[0_0_6px_currentColor] translate-x-0.5'
                      : 'w-7 opacity-75'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-semibold leading-snug tracking-tight text-slate-200 truncate">
              {activeBeam
                ? mode === 'meaning'
                  ? 'Clustering by Meaning…'
                  : 'Grouping Tabs…'
                : `${tabCount} ${tabCount === 1 ? 'tab' : 'tabs'} → ${
                    groups.length
                  } ${groups.length === 1 ? 'group' : 'groups'}`}
            </div>
          </div>
        </div>

        {/* Right: Clean Engine Status Pill */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium border shrink-0 ${
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
          {mode === 'meaning' ? providerLabel : 'Offline'}
        </span>
      </div>
    </div>
  );
};
