import React from 'react';
import { PrismThemeId } from '../../engine/types';
import { THEME_LIST } from '../themes';
import { Check, Palette } from 'lucide-react';

interface ThemeSelectorProps {
  currentTheme: PrismThemeId;
  onSelectTheme: (theme: PrismThemeId) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-prism-surface p-3 space-y-2.5 animate-fade-in shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Palette className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Interface Color Themes</span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          {THEME_LIST.length} Themes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {THEME_LIST.map((theme) => {
          const isSelected = (currentTheme || 'prism-deep') === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`flex flex-col text-left p-2 rounded-xl border transition-all duration-150 relative ${
                isSelected
                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/15 shadow-sm ring-1 ring-indigo-500/50'
                  : 'border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs select-none">{theme.emoji}</span>
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-200 truncate">
                    {theme.name}
                  </span>
                </div>
                {isSelected && (
                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                  </div>
                )}
              </div>

              <div className="text-[9px] text-slate-600 dark:text-slate-400 truncate mt-1">
                {theme.tagline}
              </div>

              {/* Theme Color Preview Dots */}
              <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/50">
                {theme.colors.previewDots.map((dotHex, idx) => (
                  <span
                    key={idx}
                    className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0 shadow-inner"
                    style={{ backgroundColor: dotHex }}
                  />
                ))}
                <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-auto uppercase font-mono tracking-wider font-semibold">
                  {theme.mode}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
