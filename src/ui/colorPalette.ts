import { ChromeTabGroupColor } from '../engine/types';

export interface ColorStyleMeta {
  label: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

export const CHROME_COLOR_STYLES: Record<ChromeTabGroupColor, ColorStyleMeta> = {
  grey: {
    label: 'Grey',
    hex: '#9AA0A6',
    bgClass: 'bg-slate-500/15',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-500/40',
    dotClass: 'bg-slate-400',
  },
  blue: {
    label: 'Blue',
    hex: '#8AB4F8',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  red: {
    label: 'Red',
    hex: '#F28B82',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-300',
    borderClass: 'border-red-500/40',
    dotClass: 'bg-red-400',
  },
  yellow: {
    label: 'Yellow',
    hex: '#FDD663',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  green: {
    label: 'Green',
    hex: '#81C995',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  pink: {
    label: 'Pink',
    hex: '#FF8BCB',
    bgClass: 'bg-pink-500/15',
    textClass: 'text-pink-300',
    borderClass: 'border-pink-500/40',
    dotClass: 'bg-pink-400',
  },
  purple: {
    label: 'Purple',
    hex: '#C58AF9',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-300',
    borderClass: 'border-purple-500/40',
    dotClass: 'bg-purple-400',
  },
  cyan: {
    label: 'Cyan',
    hex: '#78D9EC',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    dotClass: 'bg-cyan-400',
  },
  orange: {
    label: 'Orange',
    hex: '#FCAD70',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-300',
    borderClass: 'border-orange-500/40',
    dotClass: 'bg-orange-400',
  },
};
