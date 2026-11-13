import {
  CHROME_TAB_GROUP_COLORS,
  type ChromeTabGroupColor,
  type ProposedGroup,
} from '../../domain/types';

/**
 * Deterministically maps a string key to one of the 9 Chrome Tab Group colors via 32-bit FNV-1a.
 */
export function deterministicColorForKey(key: string): ChromeTabGroupColor {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % CHROME_TAB_GROUP_COLORS.length;
  return CHROME_TAB_GROUP_COLORS[index] ?? 'blue';
}

/**
 * Preserves existing group colors untouched while guaranteeing newly created groups
 * do not collide with adjacent groups and spread across all 9 Chrome colors before repeating.
 */
export function allocateHarmoniousColors(groups: readonly ProposedGroup[]): ProposedGroup[] {
  if (groups.length <= 1) return [...groups];

  const palette = CHROME_TAB_GROUP_COLORS;
  const usedInCurrentCycle = new Set<ChromeTabGroupColor>();
  const result: ProposedGroup[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!group) continue;

    if (typeof group.existingGroupId === 'number') {
      usedInCurrentCycle.add(group.color);
      result.push(group);
      continue;
    }

    const prevColor = result.length > 0 ? (result[result.length - 1]?.color ?? null) : null;
    const nextGroup = groups[i + 1];
    const nextExistingColor =
      nextGroup && typeof nextGroup.existingGroupId === 'number' ? nextGroup.color : null;

    if (usedInCurrentCycle.size >= palette.length) {
      usedInCurrentCycle.clear();
    }

    const baseColor = group.color;
    const baseIdx = Math.max(0, palette.indexOf(baseColor));
    let chosenColor: ChromeTabGroupColor = baseColor;

    if (
      baseColor === prevColor ||
      baseColor === nextExistingColor ||
      usedInCurrentCycle.has(baseColor)
    ) {
      let foundUnusedNonAdjacent: ChromeTabGroupColor | null = null;
      let foundAnyNonAdjacent: ChromeTabGroupColor | null = null;

      for (let offset = 1; offset < palette.length; offset++) {
        const candidate = palette[(baseIdx + offset) % palette.length];
        if (!candidate) continue;
        if (candidate !== prevColor && candidate !== nextExistingColor) {
          if (!foundAnyNonAdjacent) {
            foundAnyNonAdjacent = candidate;
          }
          if (!usedInCurrentCycle.has(candidate)) {
            foundUnusedNonAdjacent = candidate;
            break;
          }
        }
      }

      chosenColor = foundUnusedNonAdjacent ?? foundAnyNonAdjacent ?? baseColor;
    }

    usedInCurrentCycle.add(chosenColor);
    result.push({
      ...group,
      color: chosenColor,
    });
  }

  return result;
}
