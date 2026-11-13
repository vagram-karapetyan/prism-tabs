import {
  CHROME_TAB_GROUP_COLORS,
  type ExistingTabGroup,
  type MaxTabsPerGroup,
  type SanitizedTabPayload,
} from '../../domain/types';

export const GEMINI_GROUPING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    groups: {
      type: 'ARRAY',
      description: 'Semantic tab groups covering the provided open tabs.',
      items: {
        type: 'OBJECT',
        properties: {
          groupName: {
            type: 'STRING',
            description:
              'Concise group title (1 to 3 words, max 22 characters). Do not include the emoji here.',
          },
          emoji: {
            type: 'STRING',
            description: 'A single relevant emoji representing the group intent.',
          },
          color: {
            type: 'STRING',
            enum: [...CHROME_TAB_GROUP_COLORS],
            description: 'Native Chrome Tab Group color.',
          },
          tabIds: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            description: 'List of tabId integers belonging to this semantic group.',
          },
          existingGroupId: {
            type: 'INTEGER',
            description:
              'Optional: exact existingGroupId when assigning tabs to an existing group.',
          },
        },
        required: ['groupName', 'emoji', 'color', 'tabIds'],
      },
    },
  },
  required: ['groups'],
} as const;

export function directiveRequestsFullRebuild(customDirective?: string): boolean {
  if (!customDirective) return false;
  return /(ungroup all|rebuild from scratch|ignore existing|reset groups|dissolve existing|с нуля|расформировать|пересобрать все)/i.test(
    customDirective,
  );
}

export function buildSemanticSystemPrompt(
  customDirective?: string,
  existingGroups: readonly ExistingTabGroup[] = [],
  maxTabsPerGroup: MaxTabsPerGroup = 8,
): string {
  const trimmedDirective = customDirective?.trim();
  const limitRule =
    maxTabsPerGroup !== null && maxTabsPerGroup >= 2
      ? `5. COMPACT GROUPS (maxTabsPerGroup = ${maxTabsPerGroup}): Every group MUST contain at most ${maxTabsPerGroup} tabs. Never dump 10+ tabs into one broad bucket; split large topics (especially YouTube or docs) into focused, narrow subtopic groups of <= ${maxTabsPerGroup} tabs.`
      : '5. DYNAMIC GROUP COUNT: Create as many cohesive groups as needed for genuine clusters (minimum 2 tabs per group, plus catch-all groups for leftovers).';

  const baseInstructions = [
    'You are Prism, an elite AI tab-clustering engine for Chromium browsers.',
    'Organize open tabs by genuine task and topic intent so the tab strip stays clean and scannable.',
    '',
    'CORE GROUPING RULES:',
    '1. CROSS-DOMAIN TASK INTENT: Group related tabs across domains by workflow context (GitHub PR + ticket + preview + Figma spec together).',
    '2. CONTEXT SEPARATION: Strictly separate work/coding, research/reading, shopping, finance, and entertainment.',
    '3. YOUTUBE ISOLATION & SUBTOPIC CLUSTERING:',
    '   - YouTube tabs must NEVER be mixed with non-YouTube web pages.',
    '   - Split YouTube videos into tight, specific subtopic groups of 2+ videos (e.g., "🎮 YT Elden Ring", "🤖 YT AI Agents", "💼 YT Interviews") rather than one giant YouTube bucket.',
    '   - Place unrelated singleton YouTube videos into one fallback group: "🎬 YouTube Разное" (for Russian) or "🎬 YouTube Misc" (for English).',
    '4. SINGLETON SUPPRESSION (NO 1-TAB CLUTTER):',
    '   - Avoid creating multiple unrelated 1-tab groups.',
    '   - Combine unrelated standalone web tabs into one fallback group: "🌐 Разное" (for Russian) or "🌐 Miscellaneous" (for English).',
    limitRule,
    '6. NON-DESTRUCTIVE SMART MERGING: When <EXISTING_TAB_GROUPS> is present, assign matching tabs to existing groups using `existingGroupId` and create new groups only for remaining tabs.',
    '7. NATURAL & CONCISE TITLES:',
    '   - Keep `groupName` short (1-3 words, max 22 chars, WITHOUT emoji inside `groupName`).',
    '   - Match the primary language of the tabs (Russian titles for Russian tabs, English for English).',
    '8. EXPRESSIVE EMOJI & NATIVE COLORS:',
    '   - Provide one accurate `emoji` per group.',
    `   - Choose a Chrome \`color\` from: ${CHROME_TAB_GROUP_COLORS.join(', ')}.`,
    '9. INTEGRITY: Every input `tabId` must appear in exactly one group. Return valid JSON only.',
    '',
    'Return ONLY a compact JSON object matching this schema:',
    '{"groups":[{"groupName":"string","emoji":"✨","color":"blue","tabIds":[101,102],"existingGroupId":1}]}',
  ];

  if (existingGroups.length > 0 && !directiveRequestsFullRebuild(trimmedDirective)) {
    const formattedExisting = existingGroups
      .map(
        (eg) =>
          `- existingGroupId=${eg.id} | title="${eg.cleanTitle || eg.title}" | color=${eg.color} (${eg.tabIds.length} tabs)`,
      )
      .join('\n');

    baseInstructions.push('', '<EXISTING_TAB_GROUPS>', formattedExisting, '</EXISTING_TAB_GROUPS>');
  }

  if (trimmedDirective) {
    baseInstructions.push(
      '',
      '<USER_SORTING_DIRECTIVES>',
      `"""${trimmedDirective}"""`,
      '</USER_SORTING_DIRECTIVES>',
    );
  }

  return baseInstructions.join('\n');
}

export function buildSemanticUserPayload(
  sanitizedTabs: readonly SanitizedTabPayload[],
  customDirective?: string,
  existingGroups: readonly ExistingTabGroup[] = [],
  maxTabsPerGroup: MaxTabsPerGroup = 8,
): string {
  const directiveNote = customDirective?.trim()
    ? `Apply user sorting directive: "${customDirective.trim()}"\n\n`
    : '';

  const sizeNote =
    maxTabsPerGroup !== null && maxTabsPerGroup >= 2
      ? `Strict size cap: max ${maxTabsPerGroup} tabs per group.\n\n`
      : '';

  const existingSummary =
    existingGroups.length > 0 && !directiveRequestsFullRebuild(customDirective)
      ? `Existing active groups in window:\n${JSON.stringify(
          existingGroups.map((eg) => ({
            existingGroupId: eg.id,
            groupName: eg.cleanTitle || eg.title,
            color: eg.color,
            existingTabCount: eg.tabIds.length,
          })),
          null,
          2,
        )}\n\n`
      : '';

  const serializedTabs =
    sanitizedTabs.length > 15
      ? `[${sanitizedTabs
          .map((t) =>
            JSON.stringify({
              tabId: t.tabId,
              hostname: t.hostname,
              cleanPath: t.cleanPath === '/' ? undefined : t.cleanPath,
              title: t.title.slice(0, 52),
            }),
          )
          .join(',\n')}]`
      : JSON.stringify(sanitizedTabs, null, 2);

  return `${directiveNote}${sizeNote}${existingSummary}Cluster these ${sanitizedTabs.length} tabs into JSON \`{"groups":[...]}\`:\n${serializedTabs}`;
}
