import { describe, expect, it } from 'vitest';
import {
  allocateHarmoniousColors,
  clusterTabsByTitleNlp,
  computeContextualAffinityScore,
  computeJaccardSimilarity,
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
  deterministicColorForKey,
  extractDomainInfo,
  extractPlatformCluster,
  extractTicketIdentifiers,
  matchesRule,
  runDeterministicGrouping,
  synthesizeHumanGroupTitle,
} from '../src/engine/deterministic';
import {
  CHROME_TAB_GROUP_COLORS,
  DeterministicRule,
  ExistingTabGroup,
  ProposedTabGroup,
  TabMetadata,
} from '../src/engine/types';

describe('Deterministic Engine — Domain, Subdomain & Noise Prefix Extraction', () => {
  it('extracts rootDomain, subdomain, and strips noise path prefixes (/en/, /v1/, /app/)', () => {
    const info = extractDomainInfo('https://docs.github.com/en/v1/actions/quickstart');
    expect(info.hostname).toBe('docs.github.com');
    expect(info.rootDomain).toBe('github.com');
    expect(info.subdomain).toBe('docs');
    expect(info.pathSegments).toEqual(['en', 'v1', 'actions', 'quickstart']);
    expect(info.meaningfulPathSegments).toEqual(['actions', 'quickstart']);
    expect(info.isInternalBrowserUrl).toBe(false);
  });

  it('handles multi-part country-code TLDs (.co.uk, .com.au) accurately', () => {
    const ukInfo = extractDomainInfo('https://news.bbc.co.uk/sport/football');
    expect(ukInfo.hostname).toBe('news.bbc.co.uk');
    expect(ukInfo.rootDomain).toBe('bbc.co.uk');
    expect(ukInfo.subdomain).toBe('news');

    const auInfo = extractDomainInfo('https://portal.telstra.com.au/dashboard');
    expect(auInfo.rootDomain).toBe('telstra.com.au');
    expect(auInfo.subdomain).toBe('portal');
  });

  it('identifies internal browser protocols (chrome://, about:, edge://)', () => {
    const chromeUrl = extractDomainInfo('chrome://extensions/?id=abcdef');
    expect(chromeUrl.isInternalBrowserUrl).toBe(true);

    const aboutUrl = extractDomainInfo('about:blank');
    expect(aboutUrl.isInternalBrowserUrl).toBe(true);
  });

  it('handles localhost and IPv4 addresses cleanly', () => {
    const local = extractDomainInfo('http://localhost:5173/src/ui/App.tsx');
    expect(local.hostname).toBe('localhost');
    expect(local.rootDomain).toBe('localhost');
    expect(local.isInternalBrowserUrl).toBe(false);

    const ip = extractDomainInfo('http://127.0.0.1:8080/api/health');
    expect(ip.rootDomain).toBe('127.0.0.1');
    expect(ip.isInternalBrowserUrl).toBe(false);
  });
});

describe('Deterministic Engine — Platform-Aware Path Parsing & Media Cluster', () => {
  it('clusters GitHub and GitLab tabs by {owner}/{repo} into distinct repository groups', () => {
    const repoTabs: TabMetadata[] = [
      {
        id: 1,
        title: 'PR #10 · facebook/react',
        url: 'https://github.com/facebook/react/pull/10',
      },
      {
        id: 2,
        title: 'Issue #25 · facebook/react',
        url: 'https://github.com/facebook/react/issues/25',
      },
      {
        id: 3,
        title: 'Vite Config · vitejs/vite',
        url: 'https://github.com/vitejs/vite/blob/main/package.json',
      },
      {
        id: 4,
        title: 'Vite Releases · vitejs/vite',
        url: 'https://github.com/vitejs/vite/releases',
      },
    ];

    const plan = runDeterministicGrouping(
      repoTabs,
      DEFAULT_DETERMINISTIC_RULES,
      DEFAULT_DETERMINISTIC_OPTIONS
    );

    const reactGroup = plan.groups.find((g) => g.groupName === 'GitHub: facebook/react');
    const viteGroup = plan.groups.find((g) => g.groupName === 'GitHub: vitejs/vite');

    expect(reactGroup).toBeDefined();
    expect(reactGroup?.tabIds).toEqual([1, 2]);
    expect(reactGroup?.emoji).toBe('🐙');

    expect(viteGroup).toBeDefined();
    expect(viteGroup?.tabIds).toEqual([3, 4]);
  });

  it('splits Google Workspace (docs.google.com) into Docs, Sheets, and Slides', () => {
    const docCluster = extractPlatformCluster(
      extractDomainInfo('https://docs.google.com/document/d/12345/edit')
    );
    const sheetCluster = extractPlatformCluster(
      extractDomainInfo('https://docs.google.com/spreadsheets/d/67890/edit')
    );
    const slideCluster = extractPlatformCluster(
      extractDomainInfo('https://docs.google.com/presentation/d/abcde/edit')
    );

    expect(docCluster?.groupName).toBe('Docs');
    expect(sheetCluster?.groupName).toBe('Sheets');
    expect(slideCluster?.groupName).toBe('Slides');
  });

  it('unifies YouTube, Spotify, and SoundCloud tabs into 🎧 Media & Audio', () => {
    const mediaTabs: TabMetadata[] = [
      {
        id: 10,
        title: 'Synthwave Focus Mix - YouTube',
        url: 'https://www.youtube.com/watch?v=12345',
      },
      {
        id: 11,
        title: 'Coding Playlist - Spotify',
        url: 'https://open.spotify.com/playlist/abcdef',
      },
      {
        id: 12,
        title: 'Ambient Track - SoundCloud',
        url: 'https://soundcloud.com/artist/ambient-track',
      },
    ];

    const plan = runDeterministicGrouping(mediaTabs);
    const mediaGroup = plan.groups.find((g) => g.groupName === 'Media & Audio');

    expect(mediaGroup).toBeDefined();
    expect(mediaGroup?.emoji).toBe('🎧');
    expect(mediaGroup?.tabIds).toEqual([10, 11, 12]);
  });
});

describe('Deterministic Engine — Contextual Research Chains & Magical Heuristics', () => {
  it('links external articles into 🔍 Research & Search when opened from or matching a search query', () => {
    const now = Date.now();
    const researchTabs: TabMetadata[] = [
      {
        id: 1,
        title: 'rust async traits - Google Search',
        url: 'https://www.google.com/search?q=rust+async+traits',
        index: 0,
        lastAccessed: now,
      },
      {
        id: 2,
        title: 'async traits in Rust 2026 - Perplexity',
        url: 'https://www.perplexity.ai/search/async-traits-rust',
        index: 1,
        lastAccessed: now + 5000,
      },
      {
        // Singleton article on a custom blog sharing temporal proximity & search keywords
        id: 3,
        title: 'Deep Dive into Async Traits in Rust',
        url: 'https://smallcultfollowing.com/babysteps/blog/async-traits',
        index: 2,
        lastAccessed: now + 15000,
      },
    ];

    const plan = runDeterministicGrouping(researchTabs);
    const searchGroup = plan.groups.find((g) => g.groupName === 'Research & Search');

    expect(searchGroup).toBeDefined();
    expect(searchGroup?.source).toBe('context-chain');
    expect(searchGroup?.tabIds).toEqual([1, 2, 3]);
  });

  it('computes multi-dimensional contextual affinity score combining opener, temporal proximity, and title tokens', () => {
    const now = Date.now();
    const tabA: TabMetadata = {
      id: 10,
      title: 'WebGPU Compute Shader Pipeline Architecture',
      url: 'https://site-a.dev/webgpu',
      index: 1,
      lastAccessed: now,
    };
    const tabB: TabMetadata = {
      id: 11,
      title: 'Optimizing WebGPU Compute Shader Performance',
      url: 'https://site-b.org/shaders',
      openerTabId: 10,
      index: 2,
      lastAccessed: now + 20_000,
    };

    const score = computeContextualAffinityScore(tabA, tabB);
    expect(score).toBeGreaterThan(0.8);
  });

  it('synthesizes aesthetic human-friendly group titles and harmonious emojis from page titles', () => {
    const memberTabs: TabMetadata[] = [
      {
        id: 1,
        title: 'WebGPU Shader Pipeline Guide | Blog A',
        url: 'https://a.example.com/1',
      },
      {
        id: 2,
        title: 'WebGPU Shader Pipeline Benchmarks | Blog B',
        url: 'https://b.example.com/2',
      },
    ];

    const synth = synthesizeHumanGroupTitle(memberTabs);
    expect(synth.groupName).toBe('Webgpu Shader Pipeline');
    expect(synth.emoji).toBe('⚡');
  });
});

describe('Deterministic Engine — Preserve Existing Groups Toggle (Smart Merge vs. Clean Slate)', () => {
  const windowTabs: TabMetadata[] = [
    {
      id: 1,
      title: 'Initial PR · acme/web',
      url: 'https://github.com/acme/web/pull/1',
      groupId: 77,
    },
    {
      id: 2,
      title: 'Second PR · acme/web',
      url: 'https://github.com/acme/web/pull/2',
      groupId: -1,
    },
    {
      id: 3,
      title: 'Design System — Figma',
      url: 'https://www.figma.com/file/xyz/Design-System',
      groupId: -1,
    },
    {
      id: 4,
      title: 'Icon Kit — Figma',
      url: 'https://www.figma.com/file/abc/Icon-Kit',
      groupId: -1,
    },
  ];

  const existingGroups: ExistingTabGroup[] = [
    {
      id: 77,
      title: '🐙 GitHub',
      cleanTitle: 'GitHub',
      emoji: '🐙',
      color: 'purple',
      collapsed: false,
      tabIds: [1],
    },
  ];

  it('When preserveExistingGroups is ON (true): merges ungrouped PR into existing GitHub group (#77)', () => {
    const plan = runDeterministicGrouping(
      windowTabs,
      DEFAULT_DETERMINISTIC_RULES,
      { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: true },
      existingGroups
    );

    const existingMerged = plan.groups.find((g) => g.existingGroupId === 77);
    const newFigmaGroup = plan.groups.find((g) => g.groupName === 'Figma');

    expect(existingMerged).toBeDefined();
    expect(existingMerged?.source).toBe('existing-merge');
    expect(existingMerged?.existingTabIds).toEqual([1]);
    expect(existingMerged?.addedTabIds).toEqual([2]);
    expect(existingMerged?.tabIds).toEqual([1, 2]);

    expect(newFigmaGroup).toBeDefined();
    expect(newFigmaGroup?.existingGroupId).toBeUndefined();
    expect(newFigmaGroup?.tabIds).toEqual([3, 4]);
  });

  it('When preserveExistingGroups is OFF (false — Clean Slate Mode): rebuilds all tabs from scratch into repo-specific groups', () => {
    const plan = runDeterministicGrouping(
      windowTabs,
      DEFAULT_DETERMINISTIC_RULES,
      { ...DEFAULT_DETERMINISTIC_OPTIONS, preserveExistingGroups: false },
      existingGroups
    );

    // No group retains existingGroupId=77; instead tabs 1 & 2 form a fresh `GitHub: acme/web` group
    expect(plan.groups.every((g) => g.existingGroupId === undefined)).toBe(true);
    const freshRepoGroup = plan.groups.find(
      (g) => g.groupName === 'GitHub: acme/web'
    );
    expect(freshRepoGroup).toBeDefined();
    expect(freshRepoGroup?.tabIds).toEqual([1, 2]);
  });
});

describe('Deterministic Engine — Parent-Child Tab Tree (openerTabId)', () => {
  it('attaches a singleton child tab opened via link (openerTabId) to its parent tab group', () => {
    const tabsWithOpener: TabMetadata[] = [
      {
        id: 100,
        title: 'Feat: Shader Pipeline · acme/engine',
        url: 'https://github.com/acme/engine/pull/55',
      },
      {
        id: 101,
        title: 'Issue: Shader Pipeline · acme/engine',
        url: 'https://github.com/acme/engine/issues/50',
      },
      {
        id: 102,
        title: 'Understanding Vulkan Memory Barriers',
        url: 'https://graphics-weekly.example.com/posts/vulkan-barriers',
        openerTabId: 100,
      },
    ];

    const plan = runDeterministicGrouping(tabsWithOpener);
    const repoGroup = plan.groups.find((g) => g.groupName === 'GitHub: acme/engine');

    expect(repoGroup).toBeDefined();
    expect(repoGroup?.tabIds).toEqual([100, 101, 102]);
  });
});

describe('Deterministic Engine — Zero-AI NLP Title Clustering (Tickets & Jaccard)', () => {
  it('extracts Jira/Linear ticket IDs and PR numbers from titles', () => {
    expect(
      extractTicketIdentifiers('PRISM-89: WebGPU Shader Jank (see #412 and PR 501)')
    ).toEqual(['PRISM-89', '#412', '#501']);
  });

  it('clusters tabs from heterogeneous domains that share a ticket prefix in their title', () => {
    const crossDomainTicketTabs: TabMetadata[] = [
      {
        id: 301,
        title: '[PRISM-404] Fix OAuth token refresh race condition — Linear',
        url: 'https://linear.app/prism/issue/PRISM-404/fix-oauth',
      },
      {
        id: 302,
        title: 'PRISM-404: Staging Preview Deployment — Vercel',
        url: 'https://vercel.com/prism/oauth-preview-deployment',
      },
      {
        id: 303,
        title: 'Sentry Log for PRISM-404 in Production',
        url: 'https://sentry.io/organizations/prism/issues/99999',
      },
    ];

    const plan = runDeterministicGrouping(crossDomainTicketTabs);
    const ticketGroup = plan.groups.find((g) => g.groupName === 'PRISM-404');

    expect(ticketGroup).toBeDefined();
    expect(ticketGroup?.source).toBe('title-nlp');
    expect(ticketGroup?.tabIds).toEqual([301, 302, 303]);
  });

  it('clusters tabs across different domains when title Jaccard similarity > 0.45', () => {
    const similarTitleTabs: TabMetadata[] = [
      {
        id: 401,
        title: 'Kubernetes Ingress Controller Migration Guide',
        url: 'https://medium.com/@devops/k8s-ingress-migration',
      },
      {
        id: 402,
        title: 'Kubernetes Ingress Controller Production Guide',
        url: 'https://dev.to/cloud/k8s-ingress-production',
      },
    ];

    const { nlpGroups } = clusterTabsByTitleNlp(similarTitleTabs, 0.45);
    expect(nlpGroups).toHaveLength(1);
    expect(nlpGroups[0].tabIds).toEqual([401, 402]);
    expect(nlpGroups[0].groupName).toContain('Kubernetes Ingress');
    expect(
      computeJaccardSimilarity(
        ['kubernetes', 'ingress', 'controller', 'migration', 'guide'],
        ['kubernetes', 'ingress', 'controller', 'production', 'guide']
      )
    ).toBeCloseTo(4 / 6, 2);
  });
});

describe('Deterministic Engine — Color Harmony Allocator & Regex Rules', () => {
  it('eliminates adjacent color collisions when consecutive groups start with the same color', () => {
    const collidingGroups: ProposedTabGroup[] = [
      {
        id: 'g1',
        groupName: 'Cluster One',
        emoji: '1️⃣',
        color: 'purple',
        tabIds: [1, 2],
        source: 'domain',
      },
      {
        id: 'g2',
        groupName: 'Cluster Two',
        emoji: '2️⃣',
        color: 'purple',
        tabIds: [3, 4],
        source: 'domain',
      },
      {
        id: 'g3',
        groupName: 'Cluster Three',
        emoji: '3️⃣',
        color: 'purple',
        tabIds: [5, 6],
        source: 'domain',
      },
      {
        id: 'g4',
        groupName: 'Cluster Four',
        emoji: '4️⃣',
        color: 'purple',
        tabIds: [7, 8],
        source: 'domain',
      },
    ];

    const harmonized = allocateHarmoniousColors(collidingGroups);

    for (let i = 1; i < harmonized.length; i++) {
      expect(harmonized[i].color).not.toBe(harmonized[i - 1].color);
      expect(CHROME_TAB_GROUP_COLORS).toContain(harmonized[i].color);
    }

    const uniqueColors = new Set(harmonized.map((g) => g.color));
    expect(uniqueColors.size).toBe(4);
  });

  it('matches regex patterns and never throws on invalid user regex', () => {
    const sampleTab: TabMetadata = {
      id: 1,
      title: 'Fix race condition in worker · Pull Request #1042 · acme/core',
      url: 'https://github.com/acme/core/pull/1042',
    };

    const validRule: DeterministicRule = {
      id: 'r-pr',
      name: 'Pull Requests',
      emoji: '🔀',
      color: 'green',
      matchTarget: 'path',
      pattern: '^/[^/]+/[^/]+/pull/\\d+$',
      isRegex: true,
      priority: 1,
      enabled: true,
    };

    const invalidRule: DeterministicRule = {
      id: 'r-invalid',
      name: 'Broken Regex',
      emoji: '⚠️',
      color: 'red',
      matchTarget: 'url',
      pattern: '[unclosed-character-class(',
      isRegex: true,
      priority: 1,
      enabled: true,
    };

    expect(matchesRule(sampleTab, validRule)).toBe(true);
    expect(() => matchesRule(sampleTab, invalidRule)).not.toThrow();
    expect(matchesRule(sampleTab, invalidRule)).toBe(false);
    expect(CHROME_TAB_GROUP_COLORS).toContain(deterministicColorForKey('github.com'));
  });
});
