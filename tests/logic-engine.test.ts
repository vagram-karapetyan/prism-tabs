import { describe, expect, it } from 'vitest';
import { DEFAULT_DETERMINISTIC_OPTIONS } from '../src/domain/defaults';
import type { DeterministicRule, ExistingTabGroup, TabMetadata } from '../src/domain/types';
import { runLogicGrouping } from '../src/engine/logic/logic-engine';
import {
  computeContextualAffinityScore,
  extractTicketIdentifiers,
} from '../src/engine/logic/nlp-scorer';
import { classifyTabConcept } from '../src/engine/logic/topic-taxonomy';
import { allocateHarmoniousColors } from '../src/engine/shared/color-allocator';
import { parseExistingGroupTitle } from '../src/engine/shared/emoji-parser';
import {
  extractDomainInfo,
  isDisposableTab,
  isEmptyBrowserTab,
  isYouTubeHomeTab,
} from '../src/engine/shared/url-classifier';

function tab(partial: Partial<TabMetadata> & { id: number; url: string }): TabMetadata {
  return {
    title: partial.title ?? partial.url,
    ...partial,
  };
}

describe('URL classifier & disposable tab predicates', () => {
  it('handles internal URLs, compound TLDs, localhost/IP, and noise path prefixes', () => {
    expect(extractDomainInfo('chrome://extensions/').isInternalBrowserUrl).toBe(true);
    expect(extractDomainInfo('edge://settings/').isInternalBrowserUrl).toBe(true);
    expect(extractDomainInfo('about:blank').isInternalBrowserUrl).toBe(true);
    expect(extractDomainInfo('file:///C:/docs/index.html').isInternalBrowserUrl).toBe(true);

    const bbc = extractDomainInfo('https://www.news.bbc.co.uk/en/v2/world/tech');
    expect(bbc.isInternalBrowserUrl).toBe(false);
    expect(bbc.hostname).toBe('news.bbc.co.uk');
    expect(bbc.rootDomain).toBe('bbc.co.uk');
    expect(bbc.subdomain).toBe('news');
    expect(bbc.meaningfulPathSegments).toEqual(['world', 'tech']);

    const local = extractDomainInfo('http://localhost:5173/app/dashboard');
    expect(local.rootDomain).toBe('localhost');
    expect(local.meaningfulPathSegments).toEqual(['dashboard']);

    const ipv4 = extractDomainInfo('http://127.0.0.1:8080/ru-ru/api');
    expect(ipv4.rootDomain).toBe('127.0.0.1');
    expect(ipv4.meaningfulPathSegments).toEqual(['api']);
  });

  it('detects empty New Tab pages across Chrome, Edge, Brave, and Russian titles without touching pinned tabs', () => {
    expect(isEmptyBrowserTab({ url: 'chrome://newtab/' })).toBe(true);
    expect(isEmptyBrowserTab({ url: 'edge://newtab/' })).toBe(true);
    expect(isEmptyBrowserTab({ url: 'brave://newtab/' })).toBe(true);
    expect(isEmptyBrowserTab({ url: 'about:blank' })).toBe(true);
    expect(isEmptyBrowserTab({ url: '', title: 'Новая вкладка' })).toBe(true);
    expect(isEmptyBrowserTab({ url: 'chrome://newtab/', pinned: true })).toBe(false);
    expect(isEmptyBrowserTab({ url: 'https://github.com' })).toBe(false);
  });

  it('detects only root YouTube homepage tabs and never closes videos, shorts, or playlists', () => {
    expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/' })).toBe(true);
    expect(isYouTubeHomeTab({ url: 'https://m.youtube.com' })).toBe(true);
    expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/', pinned: true })).toBe(false);
    expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe(false);
    expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/shorts/abc123' })).toBe(false);
    expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/results?search_query=ai' })).toBe(
      false,
    );
    expect(isDisposableTab({ url: 'https://music.youtube.com/' }, { closeYouTubeHomeTabs: true })).toBe(
      false,
    );
  });
});

describe('Emoji parser & ColorAllocator', () => {
  it('parses ZWJ compound emojis even without whitespace', () => {
    expect(parseExistingGroupTitle('👨‍💻Work')).toEqual({ emoji: '👨‍💻', cleanTitle: 'Work' });
    expect(parseExistingGroupTitle('🏳️‍🌈Pride')).toEqual({ emoji: '🏳️‍🌈', cleanTitle: 'Pride' });
    expect(parseExistingGroupTitle('📁')).toEqual({ emoji: '📁', cleanTitle: '📁' });
    expect(parseExistingGroupTitle('Plain Group')).toEqual({ cleanTitle: 'Plain Group' });
  });

  it('preserves existing group colors and prevents adjacent collisions across 9 colors', () => {
    const groups = Array.from({ length: 10 }, (_, idx) => ({
      id: `g-${idx}`,
      groupName: `Group ${idx}`,
      emoji: '🌐',
      color: 'blue' as const,
      tabIds: [idx + 1],
      source: 'domain' as const,
      ...(idx === 0 ? { existingGroupId: 99 } : {}),
    }));

    const allocated = allocateHarmoniousColors(groups);
    expect(allocated[0]?.color).toBe('blue');
    for (let i = 1; i < allocated.length; i++) {
      expect(allocated[i]?.color).not.toBe(allocated[i - 1]?.color);
    }
    const distinctFirstNine = new Set(allocated.slice(0, 9).map((g) => g.color));
    expect(distinctFirstNine.size).toBe(9);
  });
});

describe('Logic Mode clustering, rules, Smart Merge, and RU/EN heuristics', () => {
  it('clusters Search, Media, Google Workspace, and GitHub/GitLab repositories cleanly', () => {
    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.google.com/search?q=preact+signals', title: 'preact signals - Google Search' }),
      tab({ id: 2, url: 'https://ya.ru/search/?text=vite+mv3', title: 'vite mv3 - Яндекс' }),
      tab({ id: 3, url: 'https://docs.google.com/document/d/123/edit', title: 'Architecture Spec' }),
      tab({ id: 4, url: 'https://docs.google.com/spreadsheets/d/456/edit', title: 'Budget 2026' }),
      tab({ id: 5, url: 'https://github.com/preactjs/signals/issues/10', title: 'Signals Issue #10' }),
      tab({ id: 6, url: 'https://github.com/preactjs/signals.git', title: 'preactjs/signals' }),
      tab({ id: 7, url: 'https://github.com/settings/profile', title: 'GitHub Settings' }),
    ];

    // Under default minTabsPerGroup: 2, Docs (1) + Sheets (1) unify into Google Workspace (2)
    // and standalone /settings/profile does NOT emit a 1-tab noise group
    const plan = runLogicGrouping({ tabs, options: DEFAULT_DETERMINISTIC_OPTIONS });

    const names = plan.groups.map((g) => g.groupName);
    expect(names).toContain('Research & Search');
    expect(names).toContain('Google Workspace');
    expect(names).toContain('GitHub: preactjs/signals');
    expect(names).not.toContain('GitHub: settings/profile');
    expect(plan.ungroupedTabIds).toContain(7);

    // When 2+ Docs and 2+ Sheets tabs exist, they stay as separate sub-tool groups
    const splitWorkspacePlan = runLogicGrouping({
      tabs: [
        ...tabs,
        tab({ id: 8, url: 'https://docs.google.com/document/d/789/edit', title: 'Release Notes' }),
        tab({ id: 9, url: 'https://docs.google.com/spreadsheets/d/999/edit', title: 'KPIs 2026' }),
      ],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
    });
    const splitNames = splitWorkspacePlan.groups.map((g) => g.groupName);
    expect(splitNames).toContain('Docs');
    expect(splitNames).toContain('Sheets');
  });

  it('evaluates priority < 10 rules before platforms, priority >= 10 after, and ignores broken regexes', () => {
    const rules: DeterministicRule[] = [
      {
        id: 'high-yt',
        name: 'AI Videos',
        emoji: '🤖',
        color: 'cyan',
        matchTarget: 'title',
        pattern: 'LLM, GPT',
        isRegex: false,
        priority: 5,
        enabled: true,
      },
      {
        id: 'broken',
        name: 'Broken',
        emoji: '❌',
        color: 'red',
        matchTarget: 'url',
        pattern: '[unclosed-regex(',
        isRegex: true,
        priority: 1,
        enabled: true,
      },
      {
        id: 'std-yt',
        name: 'Should Not Override Platform',
        emoji: '📺',
        color: 'grey',
        matchTarget: 'hostname',
        pattern: 'youtube.com',
        isRegex: false,
        priority: 20,
        enabled: true,
      },
    ];

    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.youtube.com/watch?v=1', title: 'LLM Agents Deep Dive' }),
      tab({ id: 2, url: 'https://www.youtube.com/watch?v=2', title: 'Cat Compilation' }),
    ];

    // Under default minTabsPerGroup: 2, explicit rule keeps [1], single leftover YT stays ungrouped (no 1-tab noise)
    const plan = runLogicGrouping({ tabs, rules });
    const aiGroup = plan.groups.find((g) => g.groupName === 'AI Videos');
    expect(aiGroup?.tabIds).toEqual([1]);
    expect(plan.groups.some((g) => g.groupName === 'Should Not Override Platform')).toBe(false);
    expect(plan.ungroupedTabIds).toContain(2);

    // When minTabsPerGroup: 1 is requested, platform still wins over priority >= 10 rule
    const minOnePlan = runLogicGrouping({
      tabs,
      rules,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, minTabsPerGroup: 1 },
    });
    const ytGroup = minOnePlan.groups.find((g) => g.groupName === 'YouTube');
    expect(ytGroup?.tabIds).toEqual([2]);
  });

  it('handles Smart Merge with openerTabId cycle protection and Clean Slate rebuild', () => {
    const existing: ExistingTabGroup[] = [
      {
        id: 50,
        title: '🐙GitHub: acme/core',
        cleanTitle: 'GitHub: acme/core',
        emoji: '🐙',
        color: 'purple',
        collapsed: false,
        tabIds: [1],
      },
    ];

    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://github.com/acme/core/pull/42', title: 'PR #42 PRISM-101', groupId: 50 }),
      // Cyclic opener chain between 2 and 3, plus ticket match on 4
      tab({ id: 2, url: 'https://example.org/spec', title: 'Design Spec', openerTabId: 3 }),
      tab({ id: 3, url: 'https://example.org/notes', title: 'Notes', openerTabId: 2 }),
      tab({ id: 4, url: 'https://linear.app/acme/issue/PRISM-101', title: 'PRISM-101 Fix merge' }),
      tab({ id: 5, url: 'https://github.com/acme/core/issues/99', title: 'Issue #99' }),
    ];

    const mergedPlan = runLogicGrouping({
      tabs,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: true },
      existingGroups: existing,
    });

    const merged = mergedPlan.groups.find((g) => g.existingGroupId === 50);
    expect(merged?.existingTabIds).toEqual([1]);
    expect(merged?.addedTabIds).toEqual(expect.arrayContaining([4, 5]));
    expect(merged?.color).toBe('purple');

    const cleanPlan = runLogicGrouping({
      tabs,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: false },
      existingGroups: existing,
    });
    expect(cleanPlan.groups.some((g) => g.existingGroupId === 50)).toBe(false);
  });

  it('supports RU/EN brands, ticket/contextual affinity, and language-aware Misc/Разное fallback', () => {
    expect(extractTicketIdentifiers('Fix PRISM-89 and PR #412')).toEqual(['PRISM-89', '#412']);

    const affinity = computeContextualAffinityScore(
      tab({
        id: 1,
        url: 'https://google.com/search?q=webgpu+shaders',
        title: 'webgpu shaders guide',
        index: 0,
        lastAccessed: 100_000,
      }),
      tab({
        id: 2,
        url: 'https://habr.com/ru/articles/1/',
        title: 'Пишем webgpu shaders с нуля',
        openerTabId: 1,
        index: 1,
        lastAccessed: 110_000,
      }),
    );
    expect(affinity).toBeGreaterThan(0.8);

    const ruTabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://habr.com/ru/post/1', title: 'Архитектура микросервисов' }),
      tab({ id: 2, url: 'https://ozon.ru/product/1', title: 'Клавиатура механическая' }),
    ];

    const ruPlan = runLogicGrouping({
      tabs: ruTabs,
      options: {
        ...DEFAULT_DETERMINISTIC_OPTIONS,
        minTabsPerGroup: 2,
        groupSingletonsIntoMisc: true,
      },
    });
    expect(ruPlan.groups).toHaveLength(1);
    expect(ruPlan.groups[0]?.groupName).toBe('Разное');
    expect(ruPlan.groups[0]?.emoji).toBe('🌐');

    const enPlan = runLogicGrouping({
      tabs: [
        tab({ id: 10, url: 'https://alpha.example.org/a', title: 'Quantum Optics Notes' }),
        tab({ id: 11, url: 'https://beta.example.net/b', title: 'Sourdough Baking Recipe' }),
      ],
      options: {
        ...DEFAULT_DETERMINISTIC_OPTIONS,
        minTabsPerGroup: 2,
        groupSingletonsIntoMisc: true,
      },
    });
    expect(enPlan.groups[0]?.groupName).toBe('Misc');
    expect(enPlan.groups[0]?.emoji).toBe('🗂️');
  });

  it('benchmarks 60+ mixed tabs in under 10 ms offline', () => {
    const tabs: TabMetadata[] = Array.from({ length: 64 }, (_, i) =>
      tab({
        id: i + 1,
        index: i,
        url:
          i % 4 === 0
            ? `https://github.com/org/repo-${i % 3}/issues/${i}`
            : i % 4 === 1
              ? `https://www.youtube.com/watch?v=vid${i}`
              : i % 4 === 2
                ? `https://habr.com/ru/articles/${i}/`
                : `https://docs.example.org/topic-${i % 5}/page-${i}`,
        title: `Topic ${i % 5} Item ${i}`,
        lastAccessed: 1_000_000 + i * 1_000,
      }),
    );

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: 8 });
    expect(plan.latencyMs).toBeLessThan(10);
    const totalPlaced =
      plan.groups.reduce((acc, g) => acc + g.tabIds.length, 0) + plan.ungroupedTabIds.length;
    expect(totalPlaced).toBe(64);
  });

  it('produces zero junk topics, zero 1-tab noise groups, semantic RU/EN clustering, and contiguous YouTube ordering on realistic mixed tabs', () => {
    const yt = (id: number, title: string, idx: number): TabMetadata =>
      tab({ id, index: idx, url: `https://www.youtube.com/watch?v=real${id}`, title: `${title} - YouTube` });

    const tabs: TabMetadata[] = [
      // Interleaved trap titles containing banned/filler Russian words ("лет", "больше", "русском", "вас", "через", "года")
      yt(1, 'Что будет с миром через 10 лет прогнозы', 0),
      tab({ id: 2, index: 1, url: 'https://console.groq.com/playground', title: 'GroqCloud Playground' }),
      yt(3, 'Почему через 5 лет всё сильно изменится', 2),
      tab({ id: 4, index: 3, url: 'https://github.com/vercel/next.js/issues/1', title: 'App Router bug #501' }),
      yt(5, 'Больше не делайте это по утрам советы', 4),
      tab({ id: 6, index: 5, url: 'https://www.ozon.ru/product/monitor-123', title: 'Монитор 4K купить на Ozon' }),
      yt(7, 'Видео на русском для вас бесплатно полностью', 6),
      tab({ id: 8, index: 7, url: 'https://chatgpt.com/c/abc', title: 'Prompt architecture chat - ChatGPT' }),
      yt(9, 'Вас обманывали про это 20 лет подряд', 8),
      tab({ id: 10, index: 9, url: 'https://github.com/vercel/next.js/pull/2', title: 'Fix RSC caching PR #502' }),
      yt(11, 'Через 3 года эти навыки устареют', 10),
      tab({ id: 12, index: 11, url: 'https://www.wildberries.ru/catalog/999/detail.aspx', title: 'Механическая клавиатура на Wildberries' }),
      yt(13, 'Как говорить больше и увереннее на русском', 12),

      // Mixed AI YouTube videos (RU + EN)
      yt(14, 'Claude Code для разработки архитектуры обзор', 13),
      yt(15, 'DeepSeek R1 против OpenAI o3 разбор нейросети', 14),
      yt(16, 'LLM Agents и MCP протокол на практике', 15),
      yt(17, 'Как локально запустить нейросеть на GPU', 16),

      // Mixed Gaming YouTube videos (RU + EN)
      yt(18, 'Elden Ring Shadow of the Erdtree билд на босса', 17),
      yt(19, 'Cyberpunk 2077 новый патч и графика разбор', 18),
      yt(20, 'Baldur’s Gate 3 прохождение на доблести', 19),

      // Music & Cooking YouTube videos
      yt(21, 'Lo-fi Hip Hop Beats музыка для фокуса и работы', 20),
      yt(22, 'Synthwave chill mix плейлист для кода', 21),
      yt(23, 'Как приготовить настоящий том ям дома рецепт', 22),
      yt(24, 'Идеальная паста карбонара классический рецепт', 23),

      // AI workspace tool + Career + Search + Dev
      tab({ id: 25, index: 24, url: 'https://claude.ai/chat/111', title: 'Refactor TS module - Claude' }),
      tab({ id: 26, index: 25, url: 'https://www.google.com/search?q=vite+chrome+extension', title: 'vite chrome extension - Google Search' }),
      tab({ id: 27, index: 26, url: 'https://ya.ru/search/?text=manifest+v3+service+worker', title: 'manifest v3 service worker - Яндекс' }),
      tab({ id: 28, index: 27, url: 'https://hh.ru/vacancy/98765', title: 'Вакансия Senior TypeScript Developer — hh.ru' }),
      tab({ id: 29, index: 28, url: 'https://career.habr.com/vacancies/123', title: 'Frontend Team Lead резюме и зарплата — Хабр Карьера' }),
      tab({ id: 30, index: 29, url: 'https://en.wikipedia.org/wiki/Tectonic_plate', title: 'Plate tectonics - Wikipedia' }),
      tab({ id: 31, index: 30, url: 'https://stackoverflow.com/questions/444/ts-infer', title: 'typescript - How infer works in conditional types' }),
      tab({ id: 32, index: 31, url: 'https://react.dev/reference/react/useMemo', title: 'useMemo – React' }),
      tab({ id: 33, index: 32, url: 'https://docs.python.org/3/library/asyncio.html', title: 'asyncio — Asynchronous I/O Python docs' }),
      tab({ id: 34, index: 33, url: 'chrome://extensions/', title: 'Extensions' }),
    ];

    const plan = runLogicGrouping({
      tabs,
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });

    // 1. Forbidden / junk group titles MUST NEVER appear
    const bannedTitles = new Set([
      'лет', 'больше', 'русском', 'вас', 'через', 'года', 'через года',
      'focus cluster', 'работа', 'жизнь', 'люди', 'новый', 'обзор',
      'extra', 'item', 'topic', 'groq',
    ]);
    for (const g of plan.groups) {
      expect(bannedTitles.has(g.groupName.toLowerCase().trim())).toBe(false);
      // Zero 1-tab noise groups under default minTabsPerGroup: 2
      expect(g.tabIds.length).toBeGreaterThanOrEqual(2);
      // Max cap respected
      expect(g.tabIds.length).toBeLessThanOrEqual(8);
    }

    // 2. Groq merged cleanly with ChatGPT & Claude into an AI cluster instead of a 1-tab "Groq" group
    const aiToolGroup = plan.groups.find((g) => g.tabIds.includes(2));
    expect(aiToolGroup).toBeDefined();
    expect(aiToolGroup?.tabIds).toEqual(expect.arrayContaining([2, 8, 25]));

    // 3. Semantic YouTube groups formed clearly (AI, Gaming, Music, Cooking) + at most 1 compact YouTube · Другое
    const ytOtherGroups = plan.groups.filter((g) => g.groupName.startsWith('YouTube · Другое'));
    expect(ytOtherGroups.length).toBeLessThanOrEqual(1);

    const ytAiGroup = plan.groups.find((g) => g.tabIds.includes(14) && g.tabIds.includes(15));
    const ytGamingGroup = plan.groups.find((g) => g.tabIds.includes(18) && g.tabIds.includes(19));
    const ytCookingGroup = plan.groups.find((g) => g.tabIds.includes(23) && g.tabIds.includes(24));
    expect(ytAiGroup).toBeDefined();
    expect(ytGamingGroup).toBeDefined();
    expect(ytCookingGroup).toBeDefined();

    // Cross-domain Shopping (Ozon + Wildberries) and Career (hh.ru + Хабр Карьера) united semantically
    const shoppingGroup = plan.groups.find((g) => g.tabIds.includes(6) && g.tabIds.includes(12));
    const careerGroup = plan.groups.find((g) => g.tabIds.includes(28) && g.tabIds.includes(29));
    expect(shoppingGroup).toBeDefined();
    expect(careerGroup).toBeDefined();

    // 4. All YouTube groups occupy one contiguous slice in plan.groups order (never scattered!)
    const ytIndices = plan.groups
      .map((g, idx) => (g.id.startsWith('logic-yt-') || g.groupName.startsWith('YouTube') ? idx : -1))
      .filter((idx) => idx >= 0);
    expect(ytIndices.length).toBeGreaterThanOrEqual(3);
    for (let k = 1; k < ytIndices.length; k++) {
      expect(ytIndices[k]).toBe((ytIndices[k - 1] ?? 0) + 1);
    }

    // 5. Chrome internal tab + lone ungrouped Wikipedia tab not lost
    expect(plan.ungroupedTabIds).toContain(34);
    const totalAccounted =
      plan.groups.reduce((sum, g) => sum + g.tabIds.length, 0) + plan.ungroupedTabIds.length;
    expect(totalAccounted).toBe(tabs.length);
  });

  it('never forms a 1-tab "Groq" singleton group and guards openerTabId against feed homepages & topic clashes', () => {
    const soloGroqTabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://console.groq.com/docs', title: 'Groq API Documentation' }),
      tab({ id: 2, url: 'https://www.ozon.ru/product/1', title: 'Чайник электрический' }),
      tab({ id: 3, url: 'https://en.wikipedia.org/wiki/Moon', title: 'Moon - Wikipedia' }),
      tab({ id: 4, url: 'https://www.youtube.com/', title: 'YouTube' }),
      tab({ id: 5, url: 'https://www.youtube.com/watch?v=cook1', title: 'Борщ рецепт - YouTube', openerTabId: 4 }),
      tab({ id: 6, url: 'https://typescriptlang.org/docs', title: 'TypeScript Handbook', openerTabId: 4 }),
    ];

    const plan = runLogicGrouping({ tabs: soloGroqTabs });
    expect(plan.groups.some((g) => g.groupName.toLowerCase() === 'groq')).toBe(false);
    // Conflicting cooking video & TS docs opened from YT homepage must NOT be glued into one group
    const groupWith5 = plan.groups.find((g) => g.tabIds.includes(5));
    expect(groupWith5?.tabIds.includes(6)).toBeFalsy();
  });

  it('handles empty tab list and all-internal tabs gracefully', () => {
    const emptyPlan = runLogicGrouping({ tabs: [] });
    expect(emptyPlan.groups).toEqual([]);
    expect(emptyPlan.ungroupedTabIds).toEqual([]);

    const internalPlan = runLogicGrouping({
      tabs: [
        tab({ id: 1, url: 'chrome://settings/', title: 'Settings' }),
        tab({ id: 2, url: 'about:blank', title: 'about:blank' }),
        tab({ id: 3, url: 'edge://newtab/', title: 'New Tab' }),
      ],
    });
    expect(internalPlan.groups).toEqual([]);
    expect(internalPlan.ungroupedTabIds).toEqual([1, 2, 3]);
  });

  it('prevents Smart Merge cross-contamination on YouTube topic groups and GitHub repos while supporting Workspace merge', () => {
    const existing: ExistingTabGroup[] = [
      {
        id: 77,
        title: '🎮 YouTube · Игры',
        cleanTitle: 'YouTube · Игры',
        emoji: '🎮',
        color: 'purple',
        collapsed: false,
        tabIds: [201, 202],
      },
      {
        id: 88,
        title: '🐙GitHub: facebook/react',
        cleanTitle: 'GitHub: facebook/react',
        emoji: '🐙',
        color: 'purple',
        collapsed: false,
        tabIds: [210],
      },
      {
        id: 99,
        title: '📄 Google Workspace',
        cleanTitle: 'Google Workspace',
        emoji: '📄',
        color: 'blue',
        collapsed: false,
        tabIds: [220],
      },
    ];

    const tabs: TabMetadata[] = [
      tab({ id: 201, url: 'https://www.youtube.com/watch?v=g1', title: 'Elden Ring Boss Guide - YouTube', groupId: 77 }),
      tab({ id: 202, url: 'https://www.youtube.com/watch?v=g2', title: 'Hollow Knight Silksong - YouTube', groupId: 77 }),
      tab({ id: 203, url: 'https://www.youtube.com/watch?v=ai1', title: 'Claude Code AI Agents - YouTube' }),
      tab({ id: 204, url: 'https://www.youtube.com/watch?v=ai2', title: 'OpenAI Agents SDK - YouTube' }),
      tab({ id: 205, url: 'https://www.youtube.com/watch?v=ck1', title: 'Борщ классический рецепт - YouTube' }),
      tab({ id: 206, url: 'https://www.youtube.com/watch?v=g3', title: 'Baldur’s Gate 3 билд на мага - YouTube', openerTabId: 201 }),
      tab({ id: 207, url: 'https://www.youtube.com/watch?v=ai_from_g', title: 'DeepSeek R1 нейросеть - YouTube', openerTabId: 201 }),
      tab({ id: 210, url: 'https://github.com/facebook/react/issues/5', title: 'Bug #5', groupId: 88 }),
      tab({ id: 211, url: 'https://github.com/torvalds/linux/issues/9', title: 'Scheduler patch' }),
      tab({ id: 220, url: 'https://docs.google.com/document/d/1/edit', title: 'Design Doc', groupId: 99 }),
      tab({ id: 221, url: 'https://sheets.google.com/spreadsheets/d/2/edit', title: 'Q4 Sheet' }),
    ];

    const plan = runLogicGrouping({
      tabs,
      existingGroups: existing,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: true },
      maxTabsPerGroup: 8,
    });

    const ytGaming = plan.groups.find((g) => g.existingGroupId === 77);
    expect(ytGaming?.addedTabIds).toEqual([206]);

    const ytAi = plan.groups.find((g) => g.tabIds.includes(203) && g.tabIds.includes(204));
    expect(ytAi).toBeDefined();
    expect(ytAi?.tabIds).toContain(207);

    const ghReact = plan.groups.find((g) => g.existingGroupId === 88);
    expect(ghReact?.tabIds).toEqual([210]);
    expect(plan.ungroupedTabIds).toEqual(expect.arrayContaining([205, 211]));

    const workspace = plan.groups.find((g) => g.existingGroupId === 99);
    expect(workspace?.addedTabIds).toEqual([221]);
  });

  it('blocks mid-word false positives, clickbait news hijacking, and unites singletons across matching brand domains', () => {
    const yt = (id: number, title: string, idx: number): TabMetadata =>
      tab({ id, index: idx, url: `https://www.youtube.com/watch?v=adv${id}`, title: `${title} - YouTube` });

    const tabs: TabMetadata[] = [
      // Clickbait traps ("Правда", "Работают Нейросети", "Новости")
      yt(1, 'Вся правда о том почему так вышло', 0),
      yt(2, 'Вся правда про них больше не молчат', 1),
      yt(3, 'Только правда для вас без купюр', 2),
      yt(4, 'Как работают нейросети на пальцах простыми словами', 3),
      yt(5, 'Как работают нейросети и трансформеры внутри', 4),
      yt(6, 'Hollow Knight Silksong все новости и дата выхода', 5),
      yt(7, 'Baldur’s Gate 3 секретные концовки', 6),
      yt(8, 'Hans Zimmer - Interstellar Live Concert Orchestra', 7),
      yt(9, 'Кино - Группа крови (Remastered)', 8),
      // Substring traps ("под[готовк]а", "а[налог]", "[манга]л", "по[мощн]ик", "хо[тело]сь", "за[город]ный")
      tab({ id: 10, index: 9, url: 'https://habr.com/ru/articles/999/', title: 'Подготовка к системному дизайну — аналог HighLoad' }),
      tab({ id: 11, index: 10, url: 'https://habr.com/ru/articles/888/', title: 'Мангал хотелось бы как помощник? Нет, TypeScript типы' }),
      yt(12, 'Загородный дом как помощник для души', 11),
      // Brand group (2) + cross-domain singleton (1) -> must unify into semantic concept!
      tab({ id: 13, index: 12, url: 'https://www.ozon.ru/product/1', title: 'Клавиатура Ozon' }),
      tab({ id: 14, index: 13, url: 'https://www.ozon.ru/product/2', title: 'Мышка Ozon' }),
      tab({ id: 15, index: 14, url: 'https://www.wildberries.ru/catalog/3/detail.aspx', title: 'Монитор Wildberries' }),
      tab({ id: 16, index: 15, url: 'https://chatgpt.com/c/1', title: 'ChatGPT Debug' }),
      tab({ id: 17, index: 16, url: 'https://chatgpt.com/c/2', title: 'ChatGPT Architecture' }),
      tab({ id: 18, index: 17, url: 'https://console.groq.com/playground', title: 'Groq Console' }),
      tab({ id: 19, index: 18, url: 'https://hh.ru/vacancy/1', title: 'Senior Frontend Developer — hh.ru' }),
      tab({ id: 20, index: 19, url: 'https://career.habr.com/vacancies/2', title: 'Staff Engineer — Хабр Карьера' }),
    ];

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: 8 });
    const forbiddenNames = new Set(['правда', 'работают нейросети', 'новости', 'youtube · новости', 'youtube · другое ·']);
    for (const g of plan.groups) {
      expect(forbiddenNames.has(g.groupName.toLowerCase().trim())).toBe(false);
    }

    // Hollow Knight новости + Baldur’s Gate 3 belong to Gaming, never News or Другое
    const gaming = plan.groups.find((g) => g.tabIds.includes(6) && g.tabIds.includes(7));
    expect(gaming).toBeDefined();

    // Hans Zimmer + Кино belong to Music, never Cinema
    const music = plan.groups.find((g) => g.tabIds.includes(8) && g.tabIds.includes(9));
    expect(music).toBeDefined();

    // Habr system design & TS types go together cleanly under Dev (not Design/Cooking/Cinema)
    const devGroup = plan.groups.find((g) => g.tabIds.includes(10) && g.tabIds.includes(11));
    expect(devGroup).toBeDefined();

    // Cross-domain Ozon + Wildberries, ChatGPT + Groq, hh.ru + career.habr.com absorb orphans completely
    expect(plan.groups.find((g) => g.tabIds.includes(13) && g.tabIds.includes(15))).toBeDefined();
    expect(plan.groups.find((g) => g.tabIds.includes(16) && g.tabIds.includes(18))).toBeDefined();
    expect(plan.groups.find((g) => g.tabIds.includes(19) && g.tabIds.includes(20))).toBeDefined();

    // Standalone Загородный дом & clickbait traps stay out of Travel/News
    const houseGroup = plan.groups.find((g) => g.tabIds.includes(12));
    expect(houseGroup?.groupName).not.toMatch(/поездк|travel|новост|news/i);
  });

  it('resolves ambiguous taxonomy ties, consolidates multi-tab brand groups, orders YT contiguously by concept, and suppresses unseen clickbait/modifiers', () => {
    const yt = (id: number, title: string, idx: number): TabMetadata =>
      tab({
        id,
        index: idx,
        url: `https://www.youtube.com/watch?v=real${id}`,
        title: `${title} - YouTube`,
      });

    const tabs: TabMetadata[] = [
      // Multi-tab brand groups that should consolidate cleanly when sum <= maxTabsPerGroup (8)
      tab({ id: 1, index: 0, url: 'https://chatgpt.com/c/101', title: 'ChatGPT Code Review' }),
      tab({ id: 2, index: 1, url: 'https://chatgpt.com/c/102', title: 'ChatGPT Prompting' }),
      tab({ id: 3, index: 2, url: 'https://claude.ai/chat/1', title: 'Claude 3.7 Planning' }),
      tab({ id: 4, index: 3, url: 'https://claude.ai/chat/2', title: 'Claude Code Refactor' }),
      tab({ id: 5, index: 4, url: 'https://console.groq.com/docs', title: 'Groq Console API' }),
      // Ozon (2) + Wildberries (2) -> Покупки (4)
      tab({ id: 6, index: 5, url: 'https://www.ozon.ru/product/11', title: 'Коврик для мыши Ozon' }),
      tab({ id: 7, index: 6, url: 'https://www.ozon.ru/product/12', title: 'Кронштейн Ozon' }),
      tab({ id: 8, index: 7, url: 'https://www.wildberries.ru/catalog/21/detail.aspx', title: 'USB хаб Wildberries' }),
      tab({ id: 9, index: 8, url: 'https://www.wildberries.ru/catalog/22/detail.aspx', title: 'Лампа настольная' }),
      // Dev GitHub platform group
      tab({ id: 10, index: 9, url: 'https://github.com/org/app/pull/1', title: 'PR #12' }),
      tab({ id: 11, index: 10, url: 'https://github.com/org/app/issues/2', title: 'Fix TS types' }),
      // 9+ YouTube AI tabs (including tie-loss "математика на пальцах", Karpathy, and an AI Agents entity cluster)
      yt(12, 'Как работают нейросети: математика на пальцах', 11),
      yt(13, 'Andrej Karpathy: Neural Networks Zero to Hero', 12),
      yt(14, 'AI Agents with LangGraph Architecture', 13),
      yt(15, 'AI Agents Tool Use Tutorial', 14),
      yt(16, 'Building Multi AI Agents SDK', 15),
      yt(17, 'Fine-tuning Qwen 32B модели', 16),
      yt(18, 'DeepSeek R1 против Claude benchmarks', 17),
      yt(19, 'Ollama локальный запуск LLM', 18),
      yt(20, 'Prompt Engineering для Cursor', 19),
      // YouTube Cooking (5 tabs - larger than YT AI Agents (3), must NOT wedge between YT AI groups!)
      yt(21, 'Пицца неаполитанская в духовке', 20),
      yt(22, 'Рыба в духовке простой ужин', 21),
      yt(23, 'Курица в духовке рецепт дома', 22),
      yt(24, 'Борщ классический рецепт', 23),
      yt(25, 'Соус песто дома', 24),
      // YouTube Gaming (4 tabs)
      yt(26, 'Elden Ring Shadow Erdtree боссы', 25),
      yt(27, 'Baldur’s Gate 3 лучшая сборка', 26),
      yt(28, 'Hades 2 прохождение без урона', 27),
      yt(29, 'Hollow Knight Silksong трейлер', 28),
      // YouTube Dev + Career + Cinema
      yt(30, 'Вся правда о том, почему программисты уходят из IT', 29),
      yt(31, 'Архитектура высоконагруженных бэкенд систем', 30),
      yt(32, 'Техническое интервью сеньора: системный дизайн', 31),
      yt(33, 'Карьерный рост до Staff Engineer', 32),
      yt(34, 'Дюна 3: разбор трейлера и сюжетных линий', 33),
      yt(35, 'Интерстеллар: скрытый смысл финала фильма', 34),
      // Unseen clickbait predicates -> must all settle cleanly in at most 1 YouTube · Другое
      yt(36, 'Как устроен мир: ученые десятилетиями молчали', 35),
      yt(37, 'Почему об этом скрывают и не говорят вслух', 36),
      yt(38, 'Что произошло с ними никто не догадывался', 37),
      yt(39, 'Тайна раскрыта без слов', 38),
      // Lone unrelated wiki tab
      tab({ id: 40, index: 39, url: 'https://en.wikipedia.org/wiki/Jupiter', title: 'Jupiter' }),
    ];

    const plan = runLogicGrouping({
      tabs,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, groupSingletonsIntoMisc: false },
      maxTabsPerGroup: 8,
    });

    expect(plan.latencyMs).toBeLessThan(20);

    // 1. ChatGPT (2) + Claude (2) + Groq (1) consolidated into ONE 5-tab AI group
    const aiMergedGroup = plan.groups.find(
      (g) => g.tabIds.includes(1) && g.tabIds.includes(3) && g.tabIds.includes(5),
    );
    expect(aiMergedGroup).toBeDefined();
    expect(aiMergedGroup?.tabIds).toHaveLength(5);

    // 2. Ozon (2) + Wildberries (2) consolidated into ONE 4-tab Shopping group
    const shoppingMerged = plan.groups.find((g) => g.tabIds.includes(6) && g.tabIds.includes(8));
    expect(shoppingMerged).toBeDefined();
    expect(shoppingMerged?.tabIds).toHaveLength(4);

    // 3. Previously missed classifications resolve cleanly instead of landing in YouTube · Другое
    const ytOther = plan.groups.find((g) => g.id.startsWith('logic-yt-other'));
    for (const classifiedId of [12, 13, 30, 32, 34]) {
      expect(ytOther?.tabIds.includes(classifiedId)).toBeFalsy();
    }
    expect(plan.groups.find((g) => g.tabIds.includes(12) && g.tabIds.includes(13))).toBeDefined();
    expect(plan.groups.find((g) => g.tabIds.includes(30) && g.tabIds.includes(31))).toBeDefined();
    expect(plan.groups.find((g) => g.tabIds.includes(32) && g.tabIds.includes(33))).toBeDefined();
    expect(plan.groups.find((g) => g.tabIds.includes(34) && g.tabIds.includes(35))).toBeDefined();

    // 4. Every YouTube group retains YouTube/YT visual prefix and has zero bogus modifier/clickbait names
    const ytGroups = plan.groups.filter(
      (g) => g.id.startsWith('logic-yt-') || g.id.includes('media-youtube'),
    );
    for (const g of ytGroups) {
      expect(g.groupName).toMatch(/^(YouTube|YT)(\s*·|$)/);
    }

    const forbiddenLower = new Set([
      'духовки', 'yt · духовки', 'устроен', 'молчали', 'скрывают',
      'догадывался', 'десятилетиями', 'вслух', 'произошло', 'groq', 'кулинария · другое',
    ]);
    for (const g of plan.groups) {
      expect(forbiddenLower.has(g.groupName.toLowerCase().trim())).toBe(false);
      expect(g.tabIds.length).toBeGreaterThanOrEqual(2);
      expect(g.tabIds.length).toBeLessThanOrEqual(8);
    }

    // 5. All YouTube groups occupy ONE contiguous slice AND same-concept YT groups (AI + AI Agents) sit adjacent!
    const ytIndices = plan.groups
      .map((g, idx) => (g.id.startsWith('logic-yt-') ? idx : -1))
      .filter((idx) => idx >= 0);
    for (let i = 1; i < ytIndices.length; i++) {
      expect(ytIndices[i]).toBe((ytIndices[i - 1] ?? 0) + 1);
    }
    const ytAiIndices = plan.groups
      .map((g, idx) =>
        g.tabIds.some((id) => id >= 12 && id <= 20) ? idx : -1,
      )
      .filter((idx) => idx >= 0);
    expect(ytAiIndices.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < ytAiIndices.length; i++) {
      expect(ytAiIndices[i]).toBe((ytAiIndices[i - 1] ?? 0) + 1);
    }

    // Lone Wikipedia stays ungrouped when groupSingletonsIntoMisc is false
    expect(plan.ungroupedTabIds).toContain(40);
  });

  it('keeps large dedicated brand buckets separate when threshold or maxTabsPerGroup is exceeded, and honors groupByFirstPathSegment', () => {
    // 5 Ozon + 4 Wildberries (> 8 total, both meet dedicated threshold 5 or > maxTabsPerGroup) -> stay Ozon & Wildberries
    const brandTabs: TabMetadata[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        tab({ id: i + 1, url: `https://www.ozon.ru/product/${i + 1}`, title: `Товар Ozon ${i + 1}` }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        tab({ id: i + 10, url: `https://www.wildberries.ru/catalog/${i + 1}`, title: `Товар WB ${i + 1}` }),
      ),
    ];
    const brandPlan = runLogicGrouping({ tabs: brandTabs, maxTabsPerGroup: 8 });
    expect(brandPlan.groups.map((g) => g.groupName)).toEqual(
      expect.arrayContaining(['Ozon', 'Wildberries']),
    );

    // Same root domain with groupByFirstPathSegment: true stays partitioned by path segment
    const pathTabs: TabMetadata[] = [
      tab({ id: 21, url: 'https://docs.rs/tokio/latest/tokio/', title: 'tokio docs' }),
      tab({ id: 22, url: 'https://docs.rs/tokio/latest/tokio/sync/', title: 'tokio sync docs' }),
      tab({ id: 23, url: 'https://docs.rs/serde/latest/serde/', title: 'serde docs' }),
      tab({ id: 24, url: 'https://docs.rs/serde/latest/serde/de/', title: 'serde de docs' }),
    ];
    const pathPlan = runLogicGrouping({
      tabs: pathTabs,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, groupByFirstPathSegment: true },
      maxTabsPerGroup: 8,
    });
    expect(pathPlan.groups).toHaveLength(2);
    expect(pathPlan.groups.map((g) => g.groupName).join(' ').toLowerCase()).toContain('tokio');
    expect(pathPlan.groups.map((g) => g.groupName).join(' ').toLowerCase()).toContain('serde');
  });

  it('uses window concept context symmetrically to disambiguate tied science vs ai titles', () => {
    const scienceWindow: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.youtube.com/watch?v=s1', title: 'Квантовая физика без формул - YouTube' }),
      tab({ id: 2, url: 'https://www.youtube.com/watch?v=s2', title: 'Астрофизика чёрных дыр - YouTube' }),
      tab({ id: 3, url: 'https://www.youtube.com/watch?v=tie', title: 'Как работают нейросети: математика на пальцах - YouTube' }),
    ];
    const plan = runLogicGrouping({ tabs: scienceWindow, maxTabsPerGroup: 8 });
    // Pure physics/science window resolves the tied mathematics+neural title into Science instead of splitting it away
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.groupName).toMatch(/Наука|Science/i);
    expect(plan.groups[0]?.tabIds).toEqual([1, 2, 3]);
  });

  it('blocks ALL-CAPS, TitleCase, and inflected clickbait verbs while keeping real proper-noun entities intact', () => {
    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.youtube.com/watch?v=c1', title: 'ПОЧЕМУ ОНИ ЗАПРЕТИЛИ ЭТО ДЕЛАТЬ В ЕВРОПЕ - YouTube' }),
      tab({ id: 2, url: 'https://www.youtube.com/watch?v=c2', title: 'ЧТО ОНИ ЗАПРЕТИЛИ ДЕЛАТЬ ВЧЕРА - YouTube' }),
      tab({ id: 3, url: 'https://example.org/p1', title: 'Почему они запретили это делать в городе' }),
      tab({ id: 4, url: 'https://example.net/p2', title: 'Что они запретили делать всем вчера' }),
      tab({ id: 5, url: 'https://www.youtube.com/watch?v=c3', title: 'Stopped Using Chrome Extensions Forever - YouTube' }),
      tab({ id: 6, url: 'https://www.youtube.com/watch?v=c4', title: 'Stopped Using Chrome Today Forever - YouTube' }),
      tab({ id: 7, url: 'https://www.youtube.com/watch?v=g1', title: 'ELDEN RING: ПОЛНЫЙ ГАЙД ПО БОССАМ - YouTube' }),
      tab({ id: 8, url: 'https://www.youtube.com/watch?v=g2', title: 'ELDEN RING ПРОХОЖДЕНИЕ СЕКРЕТОВ - YouTube' }),
    ];

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: 8 });
    const names = plan.groups.map((g) => g.groupName.toLowerCase());
    expect(names.some((n) => n.includes('запретили') || n.includes('stopped') || n.includes('chrome'))).toBe(false);

    const eldenGroup = plan.groups.find((g) => g.tabIds.includes(7) && g.tabIds.includes(8));
    expect(eldenGroup).toBeDefined();
    expect(eldenGroup?.groupName).toMatch(/Elden|Игры|Gaming/i);
  });

  it('prevents false-positive taxonomy collisions and keeps unrelated multi-topic host singletons out of dev', () => {
    const check = (url: string, title: string) =>
      classifyTabConcept(tab({ id: 1, url, title }), extractDomainInfo(url), {
        ignoreHostPrior: url.includes('youtube.com'),
      })?.conceptId ?? null;

    expect(check('https://www.youtube.com/watch?v=1', 'Python с нуля за 2 часа - YouTube')).toBe('dev');
    expect(check('https://www.youtube.com/watch?v=2', 'React с нуля за 1 час - YouTube')).toBe('dev');
    expect(check('https://www.youtube.com/watch?v=3', 'Жизнь в деревне своими руками - YouTube')).toBeNull();
    expect(check('https://www.youtube.com/watch?v=4', 'Плейлист для работы - YouTube')).toBe('music');
    expect(check('https://www.youtube.com/watch?v=5', 'Музыка для работы и учебы - YouTube')).toBe('music');
    expect(check('https://www.youtube.com/watch?v=6', 'House of the Dragon Season 2 Trailer - YouTube')).toBe('cinema');
    expect(check('https://www.youtube.com/watch?v=7', 'Потратил миллион на эксперимент - YouTube')).toBeNull();
    expect(check('https://www.youtube.com/watch?v=8', 'Дефицит железа: причины и симптомы - YouTube')).toBeNull();

    const mixedWindow: TabMetadata[] = [
      tab({ id: 10, url: 'https://stackoverflow.com/questions/1', title: 'TypeScript generics constraint' }),
      tab({ id: 11, url: 'https://stackoverflow.com/questions/2', title: 'Node.js stream backpressure' }),
      tab({ id: 12, url: 'https://habr.com/ru/articles/999/', title: 'Как варить вкусный кофе дома - Хабр' }),
    ];
    const plan = runLogicGrouping({ tabs: mixedWindow, maxTabsPerGroup: 8 });
    const devGroup = plan.groups.find((g) => g.tabIds.includes(10));
    expect(devGroup?.tabIds).not.toContain(12);

    // Even a 2-tab mixed Habr bucket (1 IT + 1 Coffee) must not be dragged into Coding & Dev via static brand prior
    const twoHabrMixed = [
      ...mixedWindow,
      tab({ id: 13, url: 'https://habr.com/ru/articles/1000/', title: 'Почему опытные программисты уходят из IT - Хабр' }),
    ];
    const mixedHabrPlan = runLogicGrouping({ tabs: twoHabrMixed, maxTabsPerGroup: 8 });
    const devGroup2 = mixedHabrPlan.groups.find((g) => g.tabIds.includes(10));
    expect(devGroup2?.tabIds).not.toContain(12);
  });

  it('disambiguates duplicate Stage 8.5 concept packs and preserves groupByFirstPathSegment under Stage 7.5', () => {
    const aiBrandTabs: TabMetadata[] = [
      ...Array.from({ length: 3 }, (_, i) =>
        tab({ id: i + 1, url: `https://chatgpt.com/c/${i}`, title: `ChatGPT Thread ${i}` }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        tab({ id: i + 10, url: `https://claude.ai/chat/${i}`, title: `Claude Chat ${i}` }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        tab({ id: i + 20, url: `https://deepseek.com/chat/${i}`, title: `DeepSeek ${i}` }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        tab({ id: i + 30, url: `https://gemini.google.com/app/${i}`, title: `Gemini ${i}` }),
      ),
    ];

    const aiPlan = runLogicGrouping({ tabs: aiBrandTabs, maxTabsPerGroup: 8 });
    const aiNames = aiPlan.groups.map((g) => g.groupName);
    expect(new Set(aiNames).size).toBe(aiNames.length);
    for (const g of aiPlan.groups) {
      expect(g.groupName.length).toBeLessThanOrEqual(22);
      expect(g.tabIds.length).toBeLessThanOrEqual(8);
    }

    const docsTabs: TabMetadata[] = [
      tab({ id: 50, url: 'https://docs.rs/tokio/latest/tokio/', title: 'tokio - Rust' }),
      tab({ id: 51, url: 'https://docs.rs/tokio/latest/tokio/sync/', title: 'tokio::sync - Rust' }),
      tab({ id: 52, url: 'https://docs.rs/anyhow/latest/anyhow/', title: 'anyhow - Rust' }),
    ];
    const docsPlan = runLogicGrouping({
      tabs: docsTabs,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, groupByFirstPathSegment: true },
      maxTabsPerGroup: 8,
    });
    expect(docsPlan.groups).toHaveLength(1);
    expect(docsPlan.groups[0]?.tabIds).toEqual([50, 51]);
    expect(docsPlan.ungroupedTabIds).toContain(52);
  });

  it('prevents tautological YT concept splits, premature orphan folding, multi-tenant host merges, and 50% ties', () => {
    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.youtube.com/watch?v=l1', title: 'Английский язык за 30 дней - YouTube' }),
      tab({ id: 2, url: 'https://www.youtube.com/watch?v=l2', title: 'Испанский язык с нуля уроки - YouTube' }),
      ...Array.from({ length: 8 }, (_, i) =>
        tab({ id: 10 + i, url: `https://www.youtube.com/watch?v=n${i}`, title: `Нейросети и обучение моделей часть ${i + 1} - YouTube` }),
      ),
      tab({ id: 20, url: 'https://www.youtube.com/watch?v=cc1', title: 'Claude Code MCP серверы - YouTube' }),
      tab({ id: 21, url: 'https://www.youtube.com/watch?v=cc2', title: 'Claude Code правила работы - YouTube' }),
      tab({ id: 22, url: 'https://www.youtube.com/watch?v=k1', title: 'Andrej Karpathy: Neural Networks Zero to Hero - YouTube' }),
      tab({ id: 30, url: 'https://alice.github.io/ml/', title: 'Machine Learning Notes' }),
      tab({ id: 31, url: 'https://bob.github.io/bread/', title: 'Sourdough Bread Recipe' }),
      tab({ id: 40, url: 'https://blog.example.com/1', title: 'ChatGPT Prompt Engineering' }),
      tab({ id: 41, url: 'https://travel.example.com/1', title: 'Tokyo Cherry Blossom Guide' }),
      tab({ id: 42, url: 'https://openrouter.ai/models', title: 'OpenRouter Models' }),
    ];

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: 8 });
    const langGroup = plan.groups.find((g) => g.tabIds.includes(1) && g.tabIds.includes(2));
    expect(langGroup?.groupName).toBe('YouTube · Языки');

    for (const g of plan.groups) {
      expect(g.groupName).not.toMatch(/Нейросети/i);
    }

    const claudeGroup = plan.groups.find((g) => g.tabIds.includes(20) && g.tabIds.includes(21));
    expect(claudeGroup?.tabIds).not.toContain(22);

    const ghIoMerged = plan.groups.find((g) => g.tabIds.includes(30) && g.tabIds.includes(31));
    expect(ghIoMerged).toBeUndefined();

    // 50/50 split root-domain group (`blog.example.com` AI + `travel.example.com` Travel) stays "Example"
    // and never claims `ai` dominant concept to hijack unrelated AI singletons like openrouter.ai
    const exampleGroup = plan.groups.find((g) => g.tabIds.includes(40) && g.tabIds.includes(41));
    expect(exampleGroup?.groupName).toBe('Example');
    expect(exampleGroup?.tabIds).not.toContain(42);
  });

  it('keeps Smart Merge topic isolation from YouTube · Другое and attaches matching tabs to concept groups', () => {
    const existingGroups: ExistingTabGroup[] = [
      { id: 100, title: '🎬 YouTube · Другое', cleanTitle: 'YouTube · Другое', emoji: '🎬', color: 'red', collapsed: false, tabIds: [1, 2] },
      { id: 101, title: '🤖 AI & LLM', cleanTitle: 'AI & LLM', emoji: '🤖', color: 'blue', collapsed: false, tabIds: [3, 4] },
    ];
    const tabs: TabMetadata[] = [
      tab({ id: 1, url: 'https://www.youtube.com/watch?v=m1', title: 'Vlog day in life - YouTube', groupId: 100 }),
      tab({ id: 2, url: 'https://www.youtube.com/watch?v=m2', title: 'Random unboxing - YouTube', groupId: 100 }),
      tab({ id: 3, url: 'https://chatgpt.com/c/1', title: 'ChatGPT', groupId: 101 }),
      tab({ id: 4, url: 'https://groq.com/playground', title: 'Groq', groupId: 101 }),
      tab({ id: 5, url: 'https://www.youtube.com/watch?v=ai1', title: 'Claude Code Agents - YouTube' }),
      tab({ id: 6, url: 'https://www.youtube.com/watch?v=ai2', title: 'DeepSeek R1 LLM - YouTube' }),
      tab({ id: 7, url: 'https://claude.ai/chat/new', title: 'Claude' }),
    ];

    const plan = runLogicGrouping({
      tabs,
      existingGroups,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: true },
      maxTabsPerGroup: 8,
    });

    const otherGroup = plan.groups.find((g) => g.existingGroupId === 100);
    expect(otherGroup?.tabIds).toEqual([1, 2]);

    const newYtAiGroup = plan.groups.find((g) => g.tabIds.includes(5) && g.tabIds.includes(6));
    expect(newYtAiGroup).toBeDefined();
    expect(newYtAiGroup?.existingGroupId).toBeUndefined();

    const aiGroup = plan.groups.find((g) => g.existingGroupId === 101);
    expect(aiGroup?.tabIds).toContain(7);
  });

  it('unifies single-tab repos and general/service pages for GitHub and GitLab without emitting duplicate (1)/(2) groups while keeping multi-tab repo groups separate', () => {
    // 1. >= 2 single-tab repos + >= 2 general/service pages -> single unified GitHub & GitLab groups + separate >= 2-tab repo groups
    const mixedPlan = runLogicGrouping({
      tabs: [
        // GitHub general/service pages
        tab({ id: 1, url: 'https://github.com/', title: 'GitHub Dashboard' }),
        tab({ id: 2, url: 'https://github.com/settings/profile', title: 'Your Profile' }),
        tab({ id: 3, url: 'https://github.com/notifications', title: 'Notifications' }),
        tab({ id: 4, url: 'https://github.com/trending', title: 'Trending repositories' }),
        // GitHub single-tab repos
        tab({ id: 5, url: 'https://github.com/preactjs/signals', title: 'preactjs/signals' }),
        tab({ id: 6, url: 'https://github.com/vitejs/vite/issues/1', title: 'Vite issue' }),
        // GitHub multi-tab repo (must stay dedicated!)
        tab({ id: 7, url: 'https://github.com/acme/core/pull/10', title: 'PR #10' }),
        tab({ id: 8, url: 'https://github.com/acme/core/issues/11', title: 'Issue #11' }),
        // GitLab general/service pages
        tab({ id: 11, url: 'https://gitlab.com/', title: 'GitLab Home' }),
        tab({ id: 12, url: 'https://gitlab.com/-/profile', title: 'User Settings' }),
        tab({ id: 13, url: 'https://gitlab.com/dashboard/projects', title: 'Projects' }),
        // GitLab single-tab repos
        tab({ id: 14, url: 'https://gitlab.com/org/alpha', title: 'org/alpha' }),
        tab({ id: 15, url: 'https://gitlab.com/org/beta/issues/5', title: 'Beta issue' }),
        // GitLab multi-tab repo (must stay dedicated!)
        tab({ id: 16, url: 'https://gitlab.com/team/app/merge_requests/1', title: 'MR !1' }),
        tab({ id: 17, url: 'https://gitlab.com/team/app/pipelines/9', title: 'Pipeline #9' }),
      ],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });

    const ghGroups = mixedPlan.groups.filter((g) => g.groupName.startsWith('GitHub'));
    expect(ghGroups.map((g) => g.groupName)).toEqual(
      expect.arrayContaining(['GitHub', 'GitHub: acme/core']),
    );
    expect(ghGroups).toHaveLength(2);
    expect(mixedPlan.groups.some((g) => /^GitHub \(\d+\)$/.test(g.groupName))).toBe(false);

    const unifiedGh = mixedPlan.groups.find((g) => g.groupName === 'GitHub');
    expect(unifiedGh?.tabIds).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    const dedicatedGhRepo = mixedPlan.groups.find((g) => g.groupName === 'GitHub: acme/core');
    expect(dedicatedGhRepo?.tabIds).toEqual([7, 8]);

    const glGroups = mixedPlan.groups.filter((g) => g.groupName.startsWith('GitLab'));
    expect(glGroups.map((g) => g.groupName)).toEqual(
      expect.arrayContaining(['GitLab', 'GitLab: team/app']),
    );
    expect(glGroups).toHaveLength(2);
    expect(mixedPlan.groups.some((g) => /^GitLab \(\d+\)$/.test(g.groupName))).toBe(false);

    const unifiedGl = mixedPlan.groups.find((g) => g.groupName === 'GitLab');
    expect(unifiedGl?.tabIds).toEqual(expect.arrayContaining([11, 12, 13, 14, 15]));
    const dedicatedGlRepo = mixedPlan.groups.find((g) => g.groupName === 'GitLab: team/app');
    expect(dedicatedGlRepo?.tabIds).toEqual([16, 17]);

    // 2. Boundary case: 1 single-tab repo + 1 general/service page -> unified into one group (not dropped!)
    const onePlusOnePlan = runLogicGrouping({
      tabs: [
        tab({ id: 21, url: 'https://github.com/facebook/react', title: 'facebook/react' }),
        tab({ id: 22, url: 'https://github.com/settings/profile', title: 'GitHub Settings' }),
        tab({ id: 23, url: 'https://gitlab.com/group/service', title: 'group/service' }),
        tab({ id: 24, url: 'https://gitlab.com/explore', title: 'Explore GitLab' }),
      ],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });

    expect(onePlusOnePlan.ungroupedTabIds).toEqual([]);
    const ghOnePlusOne = onePlusOnePlan.groups.find((g) => g.groupName === 'GitHub');
    expect(ghOnePlusOne?.tabIds).toEqual(expect.arrayContaining([21, 22]));
    const glOnePlusOne = onePlusOnePlan.groups.find((g) => g.groupName === 'GitLab');
    expect(glOnePlusOne?.tabIds).toEqual(expect.arrayContaining([23, 24]));

    // 3. Dedicated multi-tab repo stays isolated and does NOT absorb a lone general/service page when no other general/single-repo pair exists
    const dedicatedOnlyPlan = runLogicGrouping({
      tabs: [
        tab({ id: 31, url: 'https://github.com/preactjs/signals/issues/1', title: 'Issue 1' }),
        tab({ id: 32, url: 'https://github.com/preactjs/signals/pull/2', title: 'PR 2' }),
        tab({ id: 33, url: 'https://github.com/notifications', title: 'Notifications' }),
      ],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });
    expect(dedicatedOnlyPlan.groups.map((g) => g.groupName)).toEqual(['GitHub: preactjs/signals']);
    expect(dedicatedOnlyPlan.ungroupedTabIds).toEqual([33]);

    // 4. When unified GitHub tabs exceed maxTabsPerGroup, group-splitter still splits cleanly into numbered parts
    const oversizedPlan = runLogicGrouping({
      tabs: [
        tab({ id: 41, url: 'https://github.com/', title: 'GitHub' }),
        tab({ id: 42, url: 'https://github.com/settings/profile', title: 'Profile' }),
        tab({ id: 43, url: 'https://github.com/notifications', title: 'Notifications' }),
        tab({ id: 44, url: 'https://github.com/org/repo-a', title: 'repo-a' }),
        tab({ id: 45, url: 'https://github.com/org/repo-b', title: 'repo-b' }),
        tab({ id: 46, url: 'https://github.com/org/repo-c', title: 'repo-c' }),
      ],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 4,
    });
    expect(oversizedPlan.ungroupedTabIds).toEqual([]);
    expect(oversizedPlan.groups.length).toBeGreaterThanOrEqual(2);
    for (const g of oversizedPlan.groups) {
      expect(g.tabIds.length).toBeLessThanOrEqual(4);
    }
  });
});
