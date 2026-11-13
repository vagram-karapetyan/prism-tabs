import { describe, expect, it } from 'vitest';
import { DEFAULT_DETERMINISTIC_OPTIONS } from '../src/domain/defaults';
import type { ExistingTabGroup, ProposedGroup, TabMetadata } from '../src/domain/types';
import { runLogicGrouping } from '../src/engine/logic/logic-engine';
import { splitOversizedGroups } from '../src/engine/shared/group-splitter';

function ytTab(id: number, title: string): TabMetadata {
  return {
    id,
    index: id - 1,
    url: `https://www.youtube.com/watch?v=vid${id}`,
    title: `${title} - YouTube`,
  };
}

describe('group-splitter (maxTabsPerGroup post-splitter)', () => {
  it('splits 22 mixed-topic YouTube tabs into compact subtopic groups <= maxTabsPerGroup (8)', () => {
    const tabs: TabMetadata[] = [
      // AI / Agents (6)
      ytTab(1, 'Building AI Agents with LangGraph'),
      ytTab(2, 'LLM Agents Memory Architecture Explained'),
      ytTab(3, 'AI Coding Agents Benchmark'),
      ytTab(4, 'Claude AI Agents Tool Use Tutorial'),
      ytTab(5, 'Multi Agent AI Workflows Deep Dive'),
      ytTab(6, 'OpenAI Agents SDK Crash Course'),
      // Career / Interviews (6)
      ytTab(7, 'System Design Interview Rate Limiter'),
      ytTab(8, 'Senior Engineer Career Roadmap'),
      ytTab(9, 'Frontend System Design Interview Prep'),
      ytTab(10, 'Staff Engineer Interview Tips Salary'),
      ytTab(11, 'Tech Career Growth Without Management'),
      ytTab(12, 'Distributed Systems Interview Questions'),
      // Gaming (5)
      ytTab(13, 'Elden Ring Shadow Erdtree Boss Guide'),
      ytTab(14, 'Elden Ring Best Bleed Build Patch'),
      ytTab(15, 'Baldurs Gate Honor Mode Boss Guide'),
      ytTab(16, 'Elden Ring Lore Explained Complete'),
      ytTab(17, 'Elden RingDLC Weapons Tier Guide'),
      // Music / Focus (5)
      ytTab(18, 'Lo-fi Hip Hop Beats Study'),
      ytTab(19, 'Synthwave Radio Chill Beats Mix'),
      ytTab(20, 'Ambient Focus Music Deep Work'),
      ytTab(21, 'Jazz Piano Focus Mix Hours'),
      ytTab(22, 'Chill Synthwave Beats Playlist'),
    ];

    const plan = runLogicGrouping({
      tabs,
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });

    // Must split into multiple groups rather than one 22-tab mega-group
    expect(plan.groups.length).toBeGreaterThanOrEqual(4);

    // Every group respects maxTabsPerGroup = 8
    for (const group of plan.groups) {
      expect(group.tabIds.length).toBeLessThanOrEqual(8);
    }

    // Zero lost or duplicated tabs
    const allGroupedIds = plan.groups.flatMap((g) => g.tabIds);
    expect(new Set(allGroupedIds).size).toBe(22);
    expect(allGroupedIds).toHaveLength(22);

    // Subtopic labels reflect distinct topics with concise names <= 22 chars and no "Media & Audio ·" prefix
    for (const group of plan.groups) {
      expect(group.groupName.length).toBeLessThanOrEqual(22);
      expect(group.groupName).not.toContain('Media & Audio ·');
    }
    const groupNames = plan.groups.map((g) => g.groupName.toLowerCase());
    expect(groupNames.some((n) => n.includes('agents'))).toBe(true);
    expect(groupNames.some((n) => n.includes('elden') || n.includes('guide'))).toBe(true);
  });

  it('keeps Huang/NVIDIA, Mobile Legends, and unrelated RU videos strictly separated without chaining', () => {
    const baseTime = 1_763_057_000_000;
    const tabs: TabMetadata[] = [
      // Jensen Huang / NVIDIA cluster (adjacent timestamps & indices + filler words)
      {
        id: 1,
        index: 0,
        lastAccessed: baseTime,
        url: 'https://www.youtube.com/watch?v=nv1',
        title: 'Дженсен Хуанг про будущее NVIDIA новый выпуск - YouTube',
      },
      {
        id: 2,
        index: 1,
        lastAccessed: baseTime + 5_000,
        url: 'https://www.youtube.com/watch?v=nv2',
        title: 'NVIDIA Rubin и Хуанг реакция и обзор - YouTube',
      },
      {
        id: 3,
        index: 2,
        lastAccessed: baseTime + 10_000,
        url: 'https://www.youtube.com/watch?v=nv3',
        title: 'Почему Хуанг строит NVIDIA AI Factory стрим - YouTube',
      },
      // Mobile Legends cluster right next to NVIDIA tabs with overlapping filler words ("обзор", "новый", "реакция")
      {
        id: 4,
        index: 3,
        lastAccessed: baseTime + 12_000,
        url: 'https://www.youtube.com/watch?v=ml1',
        title: 'Mobile Legends новый герой обзор - YouTube',
      },
      {
        id: 5,
        index: 4,
        lastAccessed: baseTime + 15_000,
        url: 'https://www.youtube.com/watch?v=ml2',
        title: 'Mobile Legends гайд на мид полное видео - YouTube',
      },
      {
        id: 6,
        index: 5,
        lastAccessed: baseTime + 18_000,
        url: 'https://www.youtube.com/watch?v=ml3',
        title: 'Mobile Legends турнир реакция на финал - YouTube',
      },
      // Unrelated Russian singleton videos
      {
        id: 7,
        index: 6,
        lastAccessed: baseTime + 20_000,
        url: 'https://www.youtube.com/watch?v=ru1',
        title: 'Как приготовить настоящий том ям дома - YouTube',
      },
      {
        id: 8,
        index: 7,
        lastAccessed: baseTime + 22_000,
        url: 'https://www.youtube.com/watch?v=ru2',
        title: 'Обзор квартиры в центре Токио - YouTube',
      },
      {
        id: 9,
        index: 8,
        lastAccessed: baseTime + 24_000,
        url: 'https://www.youtube.com/watch?v=ru3',
        title: 'Телескоп Уэбба снимки далёких галактик - YouTube',
      },
    ];

    const plan = runLogicGrouping({
      tabs,
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 6,
    });

    const huangIds = new Set([1, 2, 3]);
    const mobileIds = new Set([4, 5, 6]);
    const unrelatedIds = new Set([7, 8, 9]);

    for (const group of plan.groups) {
      expect(group.groupName.length).toBeLessThanOrEqual(22);
      expect(group.groupName).not.toContain('Media & Audio ·');

      const hasHuang = group.tabIds.some((id) => huangIds.has(id));
      const hasMobile = group.tabIds.some((id) => mobileIds.has(id));
      const hasUnrelated = group.tabIds.some((id) => unrelatedIds.has(id));

      // None of these distinct topics may ever bleed into the same group
      expect(Number(hasHuang) + Number(hasMobile) + Number(hasUnrelated)).toBeLessThanOrEqual(1);
    }

    const huangGroup = plan.groups.find((g) => g.tabIds.includes(1));
    const mobileGroup = plan.groups.find((g) => g.tabIds.includes(4));
    expect(huangGroup?.tabIds).toEqual([1, 2, 3]);
    expect(mobileGroup?.tabIds).toEqual([4, 5, 6]);
    expect(mobileGroup?.groupName.toLowerCase()).toContain('mobile legends');
  });

  it('chunks disjoint oversized groups into balanced numbered parts when no subtopics exist', () => {
    const tabs: TabMetadata[] = Array.from({ length: 19 }, (_, idx) => ({
      id: idx + 1,
      url: `https://news.ycombinator.com/item?id=${1000 + idx}`,
      title: `UniqueWord${idx}XYZ`,
    }));

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: 8 });

    expect(plan.groups).toHaveLength(3);
    expect(plan.groups.map((g) => g.groupName)).toEqual([
      'Hacker News (1)',
      'Hacker News (2)',
      'Hacker News (3)',
    ]);
    // Balanced 7 + 6 + 6 instead of 8 + 8 + 3
    expect(plan.groups.map((g) => g.tabIds.length)).toEqual([7, 6, 6]);
    // Adjacent chunks receive distinct harmonious colors
    expect(plan.groups[0]?.color).not.toBe(plan.groups[1]?.color);
    expect(plan.groups[1]?.color).not.toBe(plan.groups[2]?.color);
  });

  it('leaves oversized groups intact when maxTabsPerGroup is null (unlimited)', () => {
    const tabs: TabMetadata[] = Array.from({ length: 15 }, (_, i) =>
      ytTab(i + 1, `Video ${i + 1}`),
    );

    const plan = runLogicGrouping({ tabs, maxTabsPerGroup: null });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.tabIds).toHaveLength(15);
  });

  it('preserves existing tabs during Smart Merge and splits only overflow added tabs', () => {
    const existing: ExistingTabGroup[] = [
      {
        id: 10,
        title: '🎧 Media & Audio',
        cleanTitle: 'Media & Audio',
        emoji: '🎧',
        color: 'red',
        collapsed: false,
        tabIds: [1, 2, 3, 4, 5, 6],
      },
    ];

    const tabs: TabMetadata[] = [
      ...Array.from({ length: 6 }, (_, i) => ytTab(i + 1, `Saved Video ${i + 1}`)).map((t) => ({
        ...t,
        groupId: 10,
      })),
      ...Array.from({ length: 5 }, (_, i) => ytTab(i + 7, `New Video ${i + 7}`)),
    ];

    const plan = runLogicGrouping({
      tabs,
      existingGroups: existing,
      options: { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: true },
      maxTabsPerGroup: 8,
    });

    const existingGroup = plan.groups.find((g) => g.existingGroupId === 10);
    expect(existingGroup?.tabIds).toHaveLength(8);
    expect(existingGroup?.existingTabIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(existingGroup?.addedTabIds).toEqual([7, 8]);

    const overflowGroups = plan.groups.filter((g) => g.existingGroupId === undefined);
    const overflowCount = overflowGroups.reduce((acc, g) => acc + g.tabIds.length, 0);
    expect(overflowCount).toBe(3);
  });

  it('works identically as a standalone post-processor on Meaning-style ProposedGroups', () => {
    const tabsById = new Map<number, TabMetadata>(
      Array.from({ length: 10 }, (_, i) => [i + 1, ytTab(i + 1, `Unique Clip ${i + 1}`)]),
    );
    const meaningGroup: ProposedGroup = {
      id: 'semantic-1',
      groupName: 'YouTube Watchlist',
      emoji: '🎬',
      color: 'red',
      tabIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      source: 'semantic',
    };

    const split = splitOversizedGroups([meaningGroup], tabsById, 6);
    expect(split).toHaveLength(2);
    expect(split.map((g) => g.tabIds.length)).toEqual([5, 5]);
    expect(split.map((g) => g.groupName)).toEqual([
      'YouTube Watchlist (1)',
      'YouTube Watchlist (2)',
    ]);
  });

  it('never emits dangling middle dots or "YouTube · (N)" when splitting prefixed YouTube concept groups', () => {
    const cookingTabs: TabMetadata[] = [
      ytTab(1, 'Борщ с говядиной рецепт'),
      ytTab(2, 'Том ям дома за 20 минут'),
      ytTab(3, 'Выпечка хлеба на закваске'),
      ytTab(4, 'Шоколадный торт без духовки'),
      ytTab(5, 'Соус песто итальянский'),
      ytTab(6, 'Пицца неаполитанская в духовке'),
      ytTab(7, 'Ужин за 15 минут кухня'),
      ytTab(8, 'Кофе эспрессо бариста'),
      ytTab(9, 'Рыба в духовке сочный ужин'),
      ytTab(10, 'Стейк идеальная прожарка'),
    ];

    const aiTabs: TabMetadata[] = [
      ytTab(11, 'DeepSeek R1 против Claude 3.7 Sonnet'),
      ytTab(12, 'Нейросети на пальцах разбор'),
      ytTab(13, 'Нейросети и трансформеры внутри'),
      ytTab(14, 'MCP Server для Claude Code'),
      ytTab(15, 'How Transformers Actually Work'),
      ytTab(16, 'Ollama и Qwen 32B запуск'),
      ytTab(17, 'AI Agents с нуля Python'),
      ytTab(18, 'Vibe Coding с Cursor и Claude'),
      ytTab(19, 'Fine-tuning LoRA моделей'),
      ytTab(20, 'OpenAI o3 reasoning бенчмарки'),
      ytTab(21, 'Multi Agent системы нейросети'),
    ];

    const plan = runLogicGrouping({
      tabs: [...cookingTabs, ...aiTabs],
      options: DEFAULT_DETERMINISTIC_OPTIONS,
      maxTabsPerGroup: 8,
    });

    const allPlaced = plan.groups.flatMap((g) => g.tabIds);
    expect(new Set(allPlaced).size).toBe(21);

    for (const group of plan.groups) {
      expect(group.tabIds.length).toBeLessThanOrEqual(8);
      expect(group.groupName.length).toBeLessThanOrEqual(22);
      expect(group.groupName).toMatch(/^(YouTube|YT)(\s*·|$)/);
      expect(group.groupName).not.toContain('Кулинария · Другое');
      expect(group.groupName).not.toContain('Духовки');
      expect(group.groupName).not.toMatch(/ИИ и нейросети/i);
      expect(group.groupName).not.toMatch(/[·:|/\-–—]\s*$/u);
      expect(group.groupName).not.toMatch(/^YouTube\s*·\s*\(\d+\)$/i);
      expect(group.groupName).not.toMatch(/·\s*\(\d+\)$/u);
    }

    // Also test direct splitter path on numbered prefixed groups
    const directTabsById = new Map<number, TabMetadata>(
      Array.from({ length: 10 }, (_, idx) => [idx + 1, ytTab(idx + 1, `Уникальное видео №${idx + 1}`)]),
    );
    const prefixedGroup: ProposedGroup = {
      id: 'logic-yt-concept-cooking',
      groupName: 'YouTube · Кулинария',
      emoji: '🍳',
      color: 'orange',
      tabIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      source: 'platform',
    };

    const directSplit = splitOversizedGroups([prefixedGroup], directTabsById, 8);
    expect(directSplit).toHaveLength(2);
    for (const part of directSplit) {
      expect(part.groupName).toMatch(/^(YouTube|YT)\s*·\s*/);
      expect(part.groupName).not.toMatch(/^YouTube\s*·\s*\(\d+\)$/i);
      expect(part.groupName).not.toMatch(/[·:]\s*\(\d+\)$/u);
      expect(part.groupName).toContain('Кулинария');
    }
  });

  it('preserves window concept priors inside splitOversizedGroups and keeps distinguishing sub-labels under 22 chars', () => {
    const webTab = (id: number, url: string, title: string): TabMetadata => ({
      id,
      index: id - 1,
      url,
      title,
    });
    const parentTabs: TabMetadata[] = [
      webTab(1, 'https://example.org/a1', 'React Hooks Performance'),
      webTab(2, 'https://example.org/a2', 'React Hooks Reference'),
      webTab(3, 'https://example.org/b1', 'Docker Compose Setup'),
      webTab(4, 'https://example.org/b2', 'Docker Compose Networking'),
      webTab(5, 'https://example.org/c1', 'Kubernetes Ingress Guide'),
      webTab(6, 'https://example.org/c2', 'Kubernetes Ingress TLS'),
    ];
    const parentGroup: ProposedGroup = {
      id: 'logic-nlp-concept-dev',
      groupName: 'Разработка и код',
      emoji: '💻',
      color: 'blue',
      tabIds: [1, 2, 3, 4, 5, 6],
      source: 'title-nlp',
    };
    const tabsById = new Map(parentTabs.map((t) => [t.id, t]));
    const split = splitOversizedGroups([parentGroup], tabsById, 3);
    const splitNames = split.map((g) => g.groupName);

    expect(splitNames.some((n) => n.includes('React Hooks'))).toBe(true);
    expect(splitNames.some((n) => n.includes('Docker'))).toBe(true);
    for (const n of splitNames) {
      expect(n.length).toBeLessThanOrEqual(22);
      expect(n).not.toMatch(/·\s*$/);
      expect(n).not.toContain('Разра ·');
    }

    // Tied math+neural YouTube tab inside a direct split preserves window science priors
    const scienceYtTabs: TabMetadata[] = [
      ytTab(101, 'Квантовая физика без формул'),
      ytTab(102, 'Астрофизика чёрных дыр'),
      ytTab(103, 'Как работают нейросети: математика на пальцах'),
      ytTab(104, 'Рецепт пасты карбонара дома'),
      ytTab(105, 'Как приготовить пиццу дома'),
    ];
    const watchGroup: ProposedGroup = {
      id: 'semantic-watch',
      groupName: 'YouTube',
      emoji: '🎬',
      color: 'red',
      tabIds: scienceYtTabs.map((t) => t.id),
      source: 'semantic',
    };
    const ytSplit = splitOversizedGroups(
      [watchGroup],
      new Map(scienceYtTabs.map((t) => [t.id, t])),
      3,
    );
    const sciencePart = ytSplit.find((g) => g.tabIds.includes(101) && g.tabIds.includes(102));
    expect(sciencePart?.tabIds).toContain(103);
  });
});
