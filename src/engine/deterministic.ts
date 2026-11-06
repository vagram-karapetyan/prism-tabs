import {
  CHROME_TAB_GROUP_COLORS,
  ChromeTabGroupColor,
  DeterministicOptions,
  DeterministicRule,
  ExistingTabGroup,
  GroupingPlan,
  ProposedTabGroup,
  TabMetadata,
} from './types';

const MULTI_PART_TLDS = new Set([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.jp',
  'ne.jp',
  'or.jp',
  'co.nz',
  'com.br',
  'com.mx',
  'co.in',
  'com.sg',
  'co.za',
]);

/**
 * Technical and locale path prefixes that carry no semantic grouping value.
 */
const NOISE_PATH_PREFIXES = new Set([
  'en',
  'ru',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'zh',
  'ja',
  'ko',
  'en-us',
  'en-gb',
  'ru-ru',
  'v1',
  'v2',
  'v3',
  'v4',
  'app',
  'web',
]);

/**
 * Reserved non-repository first-level paths on GitHub and GitLab.
 */
const GIT_RESERVED_ROOT_PATHS = new Set([
  'settings',
  'notifications',
  'pulls',
  'issues',
  'explore',
  'orgs',
  'organizations',
  'marketplace',
  'search',
  'login',
  'signup',
  'codespaces',
  'sponsors',
  'dashboard',
  'users',
  'groups',
  'projects',
  'topics',
  'trending',
  'collections',
  'events',
  'about',
  'pricing',
  'features',
  'security',
  '-',
]);

const SEARCH_ENGINE_ROOT_DOMAINS = new Set([
  'duckduckgo.com',
  'ecosia.org',
  'perplexity.ai',
  'kagi.com',
  'qwant.com',
  'search.brave.com',
]);

/**
 * Multimedia, video, streaming, and audio domains unified into `🎧 Media & Audio`.
 */
const MEDIA_AND_AUDIO_DOMAINS = new Set([
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'open.spotify.com',
  'spotify.com',
  'soundcloud.com',
  'twitch.tv',
  'vimeo.com',
  'netflix.com',
  'podcasts.apple.com',
  'music.apple.com',
  'deezer.com',
  'music.yandex.ru',
  'bandcamp.com',
  'tidal.com',
]);

/**
 * Stop words excluded during Zero-AI NLP title tokenization (English + Russian + common web suffixes).
 */
const TITLE_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'nor',
  'but',
  'yet',
  'so',
  'how',
  'to',
  'in',
  'on',
  'of',
  'with',
  'by',
  'from',
  'at',
  'as',
  'into',
  'like',
  'through',
  'after',
  'over',
  'between',
  'out',
  'against',
  'during',
  'without',
  'before',
  'under',
  'around',
  'among',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'can',
  'could',
  'may',
  'might',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'where',
  'when',
  'why',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'new',
  'page',
  'home',
  'tab',
  'web',
  'site',
  'com',
  'org',
  'net',
  'io',
  'dev',
  'app',
  'github',
  'gitlab',
  'google',
  'search',
  'perplexity',
  'duckduckgo',
  'bing',
  'youtube',
  'linear',
  'jira',
  'figma',
  'notion',
  'medium',
  'reddit',
  'stackoverflow',
  'pull',
  'request',
  'issue',
  'issues',
  // Russian stop words
  'и',
  'в',
  'во',
  'не',
  'что',
  'он',
  'на',
  'я',
  'с',
  'со',
  'как',
  'а',
  'то',
  'все',
  'она',
  'так',
  'его',
  'но',
  'да',
  'ты',
  'к',
  'у',
  'же',
  'вы',
  'за',
  'бы',
  'по',
  'только',
  'ее',
  'мне',
  'было',
  'вот',
  'от',
  'меня',
  'еще',
  'нет',
  'о',
  'из',
  'ему',
  'для',
  'при',
  'или',
]);

const KNOWN_BRAND_NAMES: Record<
  string,
  { label: string; emoji: string; color: ChromeTabGroupColor }
> = {
  'github.com': { label: 'GitHub', emoji: '🐙', color: 'purple' },
  'gitlab.com': { label: 'GitLab', emoji: '🦊', color: 'orange' },
  'stackoverflow.com': { label: 'Stack Overflow', emoji: '🥞', color: 'orange' },
  'google.com': { label: 'Google', emoji: '🔍', color: 'blue' },
  'youtube.com': { label: 'Media & Audio', emoji: '🎧', color: 'red' },
  'open.spotify.com': { label: 'Media & Audio', emoji: '🎧', color: 'green' },
  'reddit.com': { label: 'Reddit', emoji: '👽', color: 'orange' },
  'news.ycombinator.com': { label: 'Hacker News', emoji: '🟧', color: 'orange' },
  'figma.com': { label: 'Figma', emoji: '🎨', color: 'pink' },
  'notion.so': { label: 'Notion', emoji: '📓', color: 'grey' },
  'linear.app': { label: 'Linear', emoji: '📐', color: 'purple' },
  'slack.com': { label: 'Slack', emoji: '💬', color: 'pink' },
  'discord.com': { label: 'Discord', emoji: '🎮', color: 'purple' },
  'amazon.com': { label: 'Amazon', emoji: '📦', color: 'yellow' },
  'wikipedia.org': { label: 'Wikipedia', emoji: '📚', color: 'grey' },
  'vercel.com': { label: 'Vercel', emoji: '▲', color: 'cyan' },
  'aws.amazon.com': { label: 'AWS', emoji: '☁️', color: 'orange' },
  'console.cloud.google.com': { label: 'GCP', emoji: '☁️', color: 'blue' },
  'x.com': { label: 'X (Twitter)', emoji: '🐦', color: 'blue' },
  'twitter.com': { label: 'X (Twitter)', emoji: '🐦', color: 'blue' },
  'chatgpt.com': { label: 'ChatGPT', emoji: '🤖', color: 'green' },
  'chat.openai.com': { label: 'ChatGPT', emoji: '🤖', color: 'green' },
  'claude.ai': { label: 'Claude', emoji: '🧡', color: 'orange' },
  'telegram.org': { label: 'Telegram', emoji: '✈️', color: 'cyan' },
  'web.telegram.org': { label: 'Telegram', emoji: '✈️', color: 'cyan' },
  'medium.com': { label: 'Medium', emoji: '📝', color: 'grey' },
  'habr.com': { label: 'Habr', emoji: '🤓', color: 'cyan' },
  'vk.com': { label: 'VK', emoji: '🔵', color: 'blue' },
  'wildberries.ru': { label: 'Shopping', emoji: '🛍️', color: 'purple' },
  'ozon.ru': { label: 'Shopping', emoji: '🛍️', color: 'blue' },
  'aliexpress.com': { label: 'AliExpress', emoji: '🛍️', color: 'orange' },
  'aliexpress.ru': { label: 'AliExpress', emoji: '🛍️', color: 'orange' },
  localhost: { label: 'Local Dev', emoji: '🛠️', color: 'green' },
  '127.0.0.1': { label: 'Local Dev', emoji: '🛠️', color: 'green' },
};

export interface ExtractedDomainInfo {
  protocol: string;
  hostname: string;
  rootDomain: string;
  subdomain: string;
  pathSegments: string[];
  /** Path segments with leading noise/locale/version prefixes removed */
  meaningfulPathSegments: string[];
  pathname: string;
  isInternalBrowserUrl: boolean;
}

export interface PlatformClusterMatch {
  bucketKey: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  reasoning: string;
}

export const DEFAULT_DETERMINISTIC_OPTIONS: DeterministicOptions = {
  mergeSubdomains: true,
  groupByFirstPathSegment: false,
  minTabsPerGroup: 1,
  groupSingletonsIntoMisc: false,
  ignorePinnedTabs: true,
  preserveExistingGroups: true,
};

/**
 * Optional preset rules available in the Rules Drawer.
 * Disabled (`enabled: false`) by default so Logic Mode produces a strictly dynamic
 * number of groups (from 1 to N) based on actual repositories, platforms, tickets,
 * contextual chains, titles, and domains.
 */
export const DEFAULT_DETERMINISTIC_RULES: DeterministicRule[] = [
  {
    id: 'rule-dev-code',
    name: 'Code & Dev',
    emoji: '💻',
    color: 'purple',
    matchTarget: 'hostname',
    pattern: 'bitbucket.org, stackoverflow.com, localhost, 127.0.0.1',
    isRegex: false,
    priority: 20,
    enabled: false,
  },
  {
    id: 'rule-docs-workspace',
    name: 'Docs & Notes',
    emoji: '📄',
    color: 'blue',
    matchTarget: 'url',
    pattern: '(notion\\.so|confluence|readthedocs|developer\\.mozilla\\.org)',
    isRegex: true,
    priority: 30,
    enabled: false,
  },
  {
    id: 'rule-design-product',
    name: 'Design & Tasks',
    emoji: '🎨',
    color: 'pink',
    matchTarget: 'hostname',
    pattern: 'figma.com, linear.app, jira.atlassian.com, trello.com, miro.com',
    isRegex: false,
    priority: 40,
    enabled: false,
  },
  {
    id: 'rule-media-video',
    name: 'Media & Audio',
    emoji: '🎧',
    color: 'red',
    matchTarget: 'hostname',
    pattern: 'youtube.com, twitch.tv, netflix.com, open.spotify.com, soundcloud.com',
    isRegex: false,
    priority: 50,
    enabled: false,
  },
];

/**
 * Strips leading emoji characters from a Chrome Tab Group title so we can match
 * existing group titles cleanly against domain/platform/rule names.
 */
export function parseExistingGroupTitle(rawTitle: string): {
  emoji?: string;
  cleanTitle: string;
} {
  const trimmed = (rawTitle || '').trim();
  if (!trimmed) {
    return { cleanTitle: '' };
  }
  const match =
    /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u.exec(
      trimmed
    );
  if (match) {
    const clean = match[2].trim();
    return {
      emoji: match[1],
      cleanTitle: clean || match[1],
    };
  }
  return { cleanTitle: trimmed };
}

/**
 * Strips leading technical/locale prefixes (`/en/`, `/ru/`, `/v1/`, `/app/`)
 * so path-based grouping focuses on meaningful resource segments.
 */
export function stripNoisePathPrefixes(segments: string[]): string[] {
  let idx = 0;
  while (
    idx < segments.length &&
    NOISE_PATH_PREFIXES.has(segments[idx].toLowerCase())
  ) {
    idx++;
  }
  return segments.slice(idx);
}

/**
 * Extracts structured domain, subdomain, and path information from a URL string.
 */
export function extractDomainInfo(urlStr: string): ExtractedDomainInfo {
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();

    if (
      protocol === 'chrome' ||
      protocol === 'chrome-extension' ||
      protocol === 'edge' ||
      protocol === 'about' ||
      protocol === 'file'
    ) {
      const rawSegments = parsed.pathname.split('/').filter(Boolean);
      return {
        protocol,
        hostname: parsed.hostname || protocol,
        rootDomain: parsed.hostname || protocol,
        subdomain: '',
        pathSegments: rawSegments,
        meaningfulPathSegments: stripNoisePathPrefixes(rawSegments),
        pathname: parsed.pathname,
        isInternalBrowserUrl: true,
      };
    }

    const rawHostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const meaningfulPathSegments = stripNoisePathPrefixes(pathSegments);

    if (
      rawHostname === 'localhost' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(rawHostname) ||
      rawHostname.startsWith('[')
    ) {
      return {
        protocol,
        hostname: rawHostname,
        rootDomain: rawHostname,
        subdomain: '',
        pathSegments,
        meaningfulPathSegments,
        pathname: parsed.pathname,
        isInternalBrowserUrl: false,
      };
    }

    const parts = rawHostname.split('.');
    if (parts.length <= 2) {
      return {
        protocol,
        hostname: rawHostname,
        rootDomain: rawHostname,
        subdomain: '',
        pathSegments,
        meaningfulPathSegments,
        pathname: parsed.pathname,
        isInternalBrowserUrl: false,
      };
    }

    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    const rootPartsCount = MULTI_PART_TLDS.has(lastTwo) ? 3 : 2;
    const rootDomain = parts.slice(-rootPartsCount).join('.');
    const subdomain = parts.slice(0, -rootPartsCount).join('.');

    return {
      protocol,
      hostname: rawHostname,
      rootDomain,
      subdomain,
      pathSegments,
      meaningfulPathSegments,
      pathname: parsed.pathname,
      isInternalBrowserUrl: false,
    };
  } catch {
    return {
      protocol: 'unknown',
      hostname: 'unknown',
      rootDomain: 'unknown',
      subdomain: '',
      pathSegments: [],
      meaningfulPathSegments: [],
      pathname: '/',
      isInternalBrowserUrl: true,
    };
  }
}

/**
 * Deterministically maps a string key to one of the 9 native Chrome Tab Group colors
 * using 32-bit FNV-1a hashing.
 */
export function deterministicColorForKey(key: string): ChromeTabGroupColor {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % CHROME_TAB_GROUP_COLORS.length;
  return CHROME_TAB_GROUP_COLORS[index];
}

/**
 * Platform-Aware Path Parser:
 * 1. Search Engines (Google Search, Bing, DuckDuckGo, Ecosia, Perplexity) -> `🔍 Research & Search`
 * 2. Multimedia & Streaming (YouTube, Spotify, SoundCloud, Twitch, etc.) -> `🎧 Media & Audio`
 * 3. Google Workspace (`docs.google.com`) -> `Docs`, `Sheets`, `Slides`, `Forms`
 * 4. GitHub / GitLab -> `GitHub: owner/repo` / `GitLab: owner/repo`
 */
export function extractPlatformCluster(
  domainInfo: ExtractedDomainInfo
): PlatformClusterMatch | null {
  if (domainInfo.isInternalBrowserUrl) return null;

  const { hostname, rootDomain, pathSegments } = domainInfo;

  // 1. Search Engines -> unified `Research & Search` cluster
  const isGoogleSearch =
    (rootDomain === 'google.com' ||
      rootDomain.startsWith('google.') ||
      hostname.startsWith('google.')) &&
    (pathSegments[0]?.toLowerCase() === 'search' ||
      domainInfo.pathname.startsWith('/search'));

  const isBingSearch =
    rootDomain === 'bing.com' &&
    (pathSegments.length === 0 || pathSegments[0]?.toLowerCase() === 'search');

  const isYandexSearch =
    (rootDomain === 'yandex.ru' ||
      rootDomain === 'yandex.com' ||
      rootDomain === 'ya.ru') &&
    (hostname === 'ya.ru' ||
      ((hostname === 'yandex.ru' || hostname === 'yandex.com') &&
        (pathSegments[0]?.toLowerCase() === 'search' ||
          domainInfo.pathname.startsWith('/search'))));

  const isDedicatedSearchEngine =
    SEARCH_ENGINE_ROOT_DOMAINS.has(rootDomain) ||
    SEARCH_ENGINE_ROOT_DOMAINS.has(hostname);

  if (isGoogleSearch || isBingSearch || isYandexSearch || isDedicatedSearchEngine) {
    return {
      bucketKey: 'platform:search:research-and-search',
      groupName: 'Research & Search',
      emoji: '🔍',
      color: 'cyan',
      reasoning:
        'Unified search & research queries (Google, Bing, DuckDuckGo, Ecosia, Perplexity)',
    };
  }

  // 2. Multimedia, Video & Audio Platforms -> unified `🎧 Media & Audio`
  if (
    MEDIA_AND_AUDIO_DOMAINS.has(hostname) ||
    MEDIA_AND_AUDIO_DOMAINS.has(rootDomain)
  ) {
    return {
      bucketKey: 'platform:media:media-and-audio',
      groupName: 'Media & Audio',
      emoji: '🎧',
      color: 'red',
      reasoning:
        'Multimedia, video, and audio streaming tabs (YouTube, Spotify, Twitch, SoundCloud)',
    };
  }

  // 3. Google Workspace (`docs.google.com`) -> split by document artifact type
  if (hostname === 'docs.google.com') {
    const docType = pathSegments[0]?.toLowerCase();
    if (docType === 'document') {
      return {
        bucketKey: 'platform:gworkspace:document',
        groupName: 'Docs',
        emoji: '📄',
        color: 'blue',
        reasoning: 'Google Workspace Documents (docs.google.com/document)',
      };
    }
    if (docType === 'spreadsheets') {
      return {
        bucketKey: 'platform:gworkspace:spreadsheets',
        groupName: 'Sheets',
        emoji: '📊',
        color: 'green',
        reasoning: 'Google Workspace Spreadsheets (docs.google.com/spreadsheets)',
      };
    }
    if (docType === 'presentation') {
      return {
        bucketKey: 'platform:gworkspace:presentation',
        groupName: 'Slides',
        emoji: '📽️',
        color: 'yellow',
        reasoning: 'Google Workspace Presentations (docs.google.com/presentation)',
      };
    }
    if (docType === 'forms') {
      return {
        bucketKey: 'platform:gworkspace:forms',
        groupName: 'Forms',
        emoji: '📝',
        color: 'purple',
        reasoning: 'Google Workspace Forms (docs.google.com/forms)',
      };
    }
  }

  // 4. GitHub & GitLab -> repository-level clustering (`owner/repo`)
  if (hostname === 'github.com' || hostname === 'gitlab.com') {
    if (pathSegments.length >= 2) {
      const owner = pathSegments[0];
      const rawRepo = pathSegments[1].replace(/\.git$/i, '');
      if (
        !GIT_RESERVED_ROOT_PATHS.has(owner.toLowerCase()) &&
        !GIT_RESERVED_ROOT_PATHS.has(rawRepo.toLowerCase())
      ) {
        const repoKey = `${owner.toLowerCase()}/${rawRepo.toLowerCase()}`;
        const platformLabel = hostname === 'gitlab.com' ? 'GitLab' : 'GitHub';
        const emoji = hostname === 'gitlab.com' ? '🦊' : '🐙';
        return {
          bucketKey: `platform:${hostname}:${repoKey}`,
          groupName: `${platformLabel}: ${owner}/${rawRepo}`,
          emoji,
          color: deterministicColorForKey(`${hostname}:${repoKey}`),
          reasoning: `Repository cluster for ${platformLabel} ${owner}/${rawRepo}`,
        };
      }
    }
  }

  return null;
}

/**
 * Formats a domain key into a clean, human-readable group title and emoji.
 */
export function formatDomainGroupMeta(
  domainKey: string,
  firstPathSegment?: string
): { groupName: string; emoji: string; color: ChromeTabGroupColor } {
  const known = KNOWN_BRAND_NAMES[domainKey];
  const baseLabel = known
    ? known.label
    : domainKey
        .split('.')[0]
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const groupName = firstPathSegment
    ? `${baseLabel} / ${firstPathSegment.slice(0, 16)}`
    : baseLabel || 'Web';

  const emoji = known?.emoji ?? inferEmojiFromDomain(domainKey);
  const color = known?.color ?? deterministicColorForKey(domainKey);

  return { groupName, emoji, color };
}

function inferEmojiFromDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes('mail') || d.includes('inbox')) return '✉️';
  if (d.includes('doc') || d.includes('wiki') || d.includes('read')) return '📘';
  if (d.includes('shop') || d.includes('store') || d.includes('cart') || d.includes('buy'))
    return '🛍️';
  if (d.includes('cloud') || d.includes('aws') || d.includes('azure')) return '☁️';
  if (d.includes('ai') || d.includes('chat') || d.includes('claude') || d.includes('openai'))
    return '🤖';
  if (d.includes('news') || d.includes('blog') || d.includes('medium')) return '📰';
  if (d.includes('dev') || d.includes('code') || d.includes('git')) return '💻';
  if (d.includes('music') || d.includes('audio') || d.includes('video')) return '🎧';
  return '🌐';
}

function inferHarmoniousEmojiForTopic(words: string[]): string {
  const joined = words.join(' ').toLowerCase();
  if (/(shader|webgpu|gpu|render|graphics|canvas|шейдер|графика)/i.test(joined)) return '⚡';
  if (/(auth|oauth|jwt|security|token|login|безопасность|авторизация|пароль)/i.test(joined)) return '🔐';
  if (/(kubernetes|docker|deploy|aws|cloud|infra|ingress|terraform|сервер|деплой|инфраструктура)/i.test(joined))
    return '☁️';
  if (/(react|vite|typescript|rust|python|node|api|code|bug|разработка|код|программирование|ошибка)/i.test(joined))
    return '🛠️';
  if (/(research|guide|benchmark|paper|study|docs|spec|статья|гайд|документация|исследование|руководство)/i.test(joined)) return '📘';
  if (/(design|figma|ui|ux|css|animation|layout|дизайн|верстка|анимация|макет)/i.test(joined)) return '🎨';
  if (/(buy|price|review|keyboard|gift|shop|купить|цена|скидки|заказ|магазин|корзина)/i.test(joined)) return '🛍️';
  if (/(music|video|podcast|stream|song|музыка|видео|клип|фильм|трек|песня|подкаст)/i.test(joined)) return '🎧';
  if (/(game|gaming|steam|play|игра|игры|гейминг)/i.test(joined)) return '🎮';
  return '✨';
}

/**
 * Synthesizes a natural, human-friendly group title and harmonious emoji from
 * the shared semantic tokens of a group's member tabs instead of raw hostnames.
 */
export function synthesizeHumanGroupTitle(
  memberTabs: TabMetadata[],
  fallbackDomainKey?: string
): { groupName: string; emoji: string } {
  const tokenFreq = new Map<string, number>();
  for (const tab of memberTabs) {
    const tokens = tokenizeTitle(tab.title);
    for (const token of tokens) {
      tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
    }
  }

  // Find tokens shared by at least 2 tabs (or top tokens if 2+ tabs share them)
  const sharedTokens = [...tokenFreq.entries()]
    .filter(([, count]) => count >= Math.min(2, memberTabs.length))
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, 3);

  if (sharedTokens.length > 0) {
    const humanTitle = sharedTokens
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 24);
    const emoji = inferHarmoniousEmojiForTopic(sharedTokens);
    return { groupName: humanTitle, emoji };
  }

  if (fallbackDomainKey) {
    const meta = formatDomainGroupMeta(fallbackDomainKey);
    return { groupName: meta.groupName, emoji: meta.emoji };
  }

  return { groupName: 'Focus Cluster', emoji: '✨' };
}

/**
 * Evaluates whether a single tab matches a user-defined or preset DeterministicRule.
 */
export function matchesRule(tab: TabMetadata, rule: DeterministicRule): boolean {
  if (!rule.enabled || !rule.pattern.trim()) {
    return false;
  }

  const domainInfo = extractDomainInfo(tab.url);
  let targetValue = '';

  switch (rule.matchTarget) {
    case 'hostname':
      targetValue = domainInfo.hostname;
      break;
    case 'path':
      targetValue = domainInfo.pathname;
      break;
    case 'title':
      targetValue = tab.title || '';
      break;
    case 'url':
    default:
      targetValue = tab.url || '';
      break;
  }

  if (rule.isRegex) {
    try {
      const regex = new RegExp(rule.pattern.trim(), 'i');
      return regex.test(targetValue);
    } catch {
      return false;
    }
  }

  const tokens = rule.pattern
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const lowerTarget = targetValue.toLowerCase();

  return tokens.some((token) => {
    if (rule.matchTarget === 'hostname') {
      return lowerTarget === token || lowerTarget.endsWith(`.${token}`);
    }
    return lowerTarget.includes(token);
  });
}

/**
 * Extracts issue / ticket / PR identifiers from a tab title or URL.
 * Matches patterns like:
 * - `JIRA-123`, `PRISM-89`, `ENG-404` (`[A-Z]{2,10}-\d+`)
 * - `PR #412`, `PR 412`, `#412`
 */
export function extractTicketIdentifiers(title: string): string[] {
  if (!title) return [];
  const results = new Set<string>();

  const jiraRegex = /\b([A-Z]{2,10}-\d{1,7})\b/g;
  let match: RegExpExecArray | null;
  while ((match = jiraRegex.exec(title)) !== null) {
    results.add(match[1].toUpperCase());
  }

  const prHashRegex = /(?:\bPR\s*#?|\B#)(\d{2,7})\b/gi;
  while ((match = prHashRegex.exec(title)) !== null) {
    results.add(`#${match[1]}`);
  }

  return [...results];
}

/**
 * Tokenizes a tab title into meaningful lowercase words, stripping stop words and punctuation.
 */
export function tokenizeTitle(title: string): string[] {
  if (!title) return [];
  const rawTokens = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const seen = new Set<string>();
  const filtered: string[] = [];

  for (const token of rawTokens) {
    if (token.length < 3) continue;
    if (/^\d+$/.test(token)) continue;
    if (TITLE_STOP_WORDS.has(token)) continue;
    if (!seen.has(token)) {
      seen.add(token);
      filtered.push(token);
    }
  }

  return filtered;
}

/**
 * Computes Jaccard similarity between two sets of tokens: |A ∩ B| / |A ∪ B|.
 */
export function computeJaccardSimilarity(
  tokensA: readonly string[],
  tokensB: readonly string[]
): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Multi-Dimensional Contextual Affinity Score between two tabs (`0.0` to `1.0+`):
 * Combines:
 * 1. Parent-child `openerTabId` or sibling lineage (`+0.55` / `+0.40`)
 * 2. Temporal proximity (`lastAccessed` within 3 minutes -> up to `+0.22`)
 * 3. Positional tab-strip proximity (`index` or `id` adjacency -> up to `+0.15`)
 * 4. Semantic title token Jaccard & overlap coefficient
 */
export function computeContextualAffinityScore(
  tabA: TabMetadata,
  tabB: TabMetadata,
  tokensA?: readonly string[],
  tokensB?: readonly string[]
): number {
  const tA = tokensA ?? tokenizeTitle(tabA.title);
  const tB = tokensB ?? tokenizeTitle(tabB.title);

  const jaccard = computeJaccardSimilarity(tA, tB);

  // Overlap coefficient: |A ∩ B| / min(|A|, |B|) — catches short search queries matching longer article titles
  let sharedCount = 0;
  const setB = new Set(tB);
  for (const w of tA) {
    if (setB.has(w)) sharedCount++;
  }
  const minLen = Math.min(tA.length, tB.length);
  const overlapCoeff = minLen > 0 ? sharedCount / minLen : 0;

  let score = Math.max(jaccard, overlapCoeff * 0.65);

  // Parent-child or sibling openerTabId boost
  if (tabA.openerTabId === tabB.id || tabB.openerTabId === tabA.id) {
    score += 0.55;
  } else if (
    typeof tabA.openerTabId === 'number' &&
    tabA.openerTabId === tabB.openerTabId
  ) {
    score += 0.4;
  }

  // Temporal proximity boost (when tabs were accessed/opened within 3 minutes of each other)
  if (
    typeof tabA.lastAccessed === 'number' &&
    typeof tabB.lastAccessed === 'number'
  ) {
    const deltaMs = Math.abs(tabA.lastAccessed - tabB.lastAccessed);
    if (deltaMs <= 180_000 && sharedCount >= 1) {
      score += 0.22 * (1 - deltaMs / 180_000);
    }
  }

  // Tab strip positional adjacency boost (only when at least 1 semantic keyword is shared)
  if (sharedCount >= 1) {
    const posA = tabA.index ?? tabA.id;
    const posB = tabB.index ?? tabB.id;
    const posDist = Math.abs(posA - posB);
    if (posDist <= 2) {
      score += 0.15 * (1 - (posDist - 1) * 0.4);
    }
  }

  return Number(score.toFixed(3));
}

/**
 * Zero-AI NLP & Multi-Dimensional Contextual Title Clustering:
 * Clusters tabs across different domains that share:
 * 1. Common ticket/issue IDs (`[A-Z]+-\d+`, `#\d+`, `PR \d+`), OR
 * 2. Jaccard title token similarity > `jaccardThreshold` (default `0.45`), OR
 * 3. Multi-dimensional contextual affinity score > `0.52` (combining opener, temporal proximity, and title tokens).
 */
export function clusterTabsByTitleNlp(
  candidateTabs: TabMetadata[],
  jaccardThreshold: number = 0.45
): {
  nlpGroups: ProposedTabGroup[];
  clusteredTabIds: Set<number>;
} {
  const nlpGroups: ProposedTabGroup[] = [];
  const clusteredTabIds = new Set<number>();

  if (candidateTabs.length < 2) {
    return { nlpGroups, clusteredTabIds };
  }

  // Pass 1: Group by shared Ticket / Issue IDs ([A-Z]+-\d+, #\d+, PR \d+)
  const ticketBuckets = new Map<string, number[]>();
  for (const tab of candidateTabs) {
    const tickets = extractTicketIdentifiers(tab.title);
    for (const ticket of tickets) {
      const list = ticketBuckets.get(ticket) ?? [];
      list.push(tab.id);
      ticketBuckets.set(ticket, list);
    }
  }

  const sortedTickets = [...ticketBuckets.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [ticketId, memberIds] of sortedTickets) {
    const availableIds = memberIds.filter((id) => !clusteredTabIds.has(id));
    if (availableIds.length >= 2) {
      availableIds.forEach((id) => clusteredTabIds.add(id));
      nlpGroups.push({
        id: `logic-nlp-ticket-${ticketId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        groupName: ticketId,
        emoji: '🏷️',
        color: deterministicColorForKey(ticketId),
        tabIds: availableIds,
        source: 'title-nlp',
        reasoning: `Shared task/ticket identifier "${ticketId}" in page titles`,
      });
    }
  }

  // Pass 2: Jaccard Similarity (> 0.45) or Multi-Dimensional Contextual Score (> 0.52)
  const remainingTabs = candidateTabs.filter((t) => !clusteredTabIds.has(t.id));
  if (remainingTabs.length < 2) {
    return { nlpGroups, clusteredTabIds };
  }

  const tokensByTabId = new Map<number, string[]>();
  for (const tab of remainingTabs) {
    tokensByTabId.set(tab.id, tokenizeTitle(tab.title));
  }

  const visited = new Set<number>();
  for (let i = 0; i < remainingTabs.length; i++) {
    const seedTab = remainingTabs[i];
    if (visited.has(seedTab.id)) continue;

    const seedTokens = tokensByTabId.get(seedTab.id) ?? [];
    if (seedTokens.length === 0) continue;

    const clusterTabs: TabMetadata[] = [seedTab];
    let commonTokens = new Set(seedTokens);

    for (let j = i + 1; j < remainingTabs.length; j++) {
      const otherTab = remainingTabs[j];
      if (visited.has(otherTab.id)) continue;

      const otherTokens = tokensByTabId.get(otherTab.id) ?? [];
      const jaccard = computeJaccardSimilarity(seedTokens, otherTokens);
      const contextualScore = computeContextualAffinityScore(
        seedTab,
        otherTab,
        seedTokens,
        otherTokens
      );

      if (jaccard > jaccardThreshold || contextualScore >= 0.52) {
        clusterTabs.push(otherTab);
        const nextCommon = new Set<string>();
        for (const t of otherTokens) {
          if (commonTokens.has(t)) {
            nextCommon.add(t);
          }
        }
        if (nextCommon.size > 0) {
          commonTokens = nextCommon;
        }
      }
    }

    if (clusterTabs.length >= 2) {
      const clusterTabIds = clusterTabs.map((t) => t.id);
      clusterTabIds.forEach((id) => {
        visited.add(id);
        clusteredTabIds.add(id);
      });

      const { groupName, emoji } = synthesizeHumanGroupTitle(clusterTabs);

      nlpGroups.push({
        id: `logic-nlp-jaccard-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        groupName,
        emoji,
        color: deterministicColorForKey(groupName),
        tabIds: clusterTabIds,
        source: 'title-nlp',
        reasoning: `Contextual & title token affinity (${groupName})`,
      });
    }
  }

  return { nlpGroups, clusteredTabIds };
}

/**
 * Greedy Color Harmony Allocator:
 * Starts from each group's preferred/FNV-1a base color and guarantees:
 * 1. Existing groups (`existingGroupId` present) keep their exact native color untouched.
 * 2. Newly created groups never share the same color with adjacent groups (`groups[i].color !== groups[i - 1].color`).
 * 3. Colors are distributed across all 9 Chrome Tab Group colors before repeating.
 */
export function allocateHarmoniousColors(
  groups: ProposedTabGroup[]
): ProposedTabGroup[] {
  if (groups.length <= 1) return groups;

  const palette = CHROME_TAB_GROUP_COLORS;
  const usedInCurrentCycle = new Set<ChromeTabGroupColor>();
  const result: ProposedTabGroup[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    if (typeof group.existingGroupId === 'number') {
      usedInCurrentCycle.add(group.color);
      result.push(group);
      continue;
    }

    const prevColor = i > 0 ? result[i - 1].color : null;
    const nextExistingColor =
      i + 1 < groups.length && typeof groups[i + 1].existingGroupId === 'number'
        ? groups[i + 1].color
        : null;

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

      chosenColor =
        foundUnusedNonAdjacent ?? foundAnyNonAdjacent ?? baseColor;
    }

    usedInCurrentCycle.add(chosenColor);
    result.push({
      ...group,
      color: chosenColor,
    });
  }

  return result;
}

interface PendingBucket {
  id: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  tabIds: number[];
  source: ProposedTabGroup['source'];
  reasoning: string;
  isExplicitRule: boolean;
  domainKey?: string;
}

interface AnalyzedExistingGroup {
  group: ExistingTabGroup;
  normalizedTitle: string;
  titleTokens: string[];
  ticketIds: Set<string>;
  platformBucketKeys: Set<string>;
  rootDomains: Set<string>;
  memberTabIds: Set<number>;
  addedTabIds: number[];
}

function buildExistingGroupProfiles(
  existingGroups: ExistingTabGroup[],
  tabsById: Map<number, TabMetadata>
): AnalyzedExistingGroup[] {
  return existingGroups.map((eg) => {
    const parsed = parseExistingGroupTitle(eg.title || eg.cleanTitle);
    const cleanTitle = eg.cleanTitle || parsed.cleanTitle || 'Group';
    const normalizedTitle = cleanTitle.toLowerCase().trim();
    const titleTokens = tokenizeTitle(cleanTitle);
    const ticketIds = new Set<string>(extractTicketIdentifiers(cleanTitle));
    const platformBucketKeys = new Set<string>();
    const rootDomains = new Set<string>();
    const memberTabIds = new Set<number>(eg.tabIds);

    for (const tabId of eg.tabIds) {
      const tab = tabsById.get(tabId);
      if (!tab) continue;
      for (const tk of extractTicketIdentifiers(tab.title)) {
        ticketIds.add(tk);
      }
      const dInfo = extractDomainInfo(tab.url);
      if (!dInfo.isInternalBrowserUrl) {
        rootDomains.add(dInfo.rootDomain);
        const pMatch = extractPlatformCluster(dInfo);
        if (pMatch) {
          platformBucketKeys.add(pMatch.bucketKey);
        }
      }
    }

    return {
      group: {
        ...eg,
        cleanTitle,
        emoji: eg.emoji ?? parsed.emoji,
      },
      normalizedTitle,
      titleTokens,
      ticketIds,
      platformBucketKeys,
      rootDomains,
      memberTabIds,
      addedTabIds: [],
    };
  });
}

/**
 * Checks whether an ungrouped tab belongs to one of the user's existing Chrome Tab Groups.
 */
function findMatchingExistingGroupProfile(
  tab: TabMetadata,
  domainInfo: ExtractedDomainInfo,
  platformMatch: PlatformClusterMatch | null,
  matchedRule: DeterministicRule | undefined,
  profiles: AnalyzedExistingGroup[],
  tabsById: Map<number, TabMetadata>
): AnalyzedExistingGroup | undefined {
  if (profiles.length === 0) return undefined;

  // 1. Check openerTabId lineage
  let current: TabMetadata | undefined = tab;
  const visitedOpeners = new Set<number>([tab.id]);
  while (current && typeof current.openerTabId === 'number') {
    const parentId = current.openerTabId;
    if (visitedOpeners.has(parentId)) break;
    visitedOpeners.add(parentId);
    const matchingByOpener = profiles.find(
      (p) => p.memberTabIds.has(parentId) || p.addedTabIds.includes(parentId)
    );
    if (matchingByOpener) {
      return matchingByOpener;
    }
    current = tabsById.get(parentId);
  }

  // 2. Check shared Ticket / Issue IDs ([A-Z]+-\d+, #\d+, PR \d+)
  const tabTickets = extractTicketIdentifiers(tab.title);
  if (tabTickets.length > 0) {
    const matchingByTicket = profiles.find((p) =>
      tabTickets.some((tk) => p.ticketIds.has(tk))
    );
    if (matchingByTicket) {
      return matchingByTicket;
    }
  }

  // 3. Check explicit Rule name match against existing group title
  if (matchedRule) {
    const ruleNameLower = matchedRule.name.toLowerCase().trim();
    const matchingByRuleTitle = profiles.find(
      (p) => p.normalizedTitle === ruleNameLower
    );
    if (matchingByRuleTitle) {
      return matchingByRuleTitle;
    }
  }

  // 4. Check Platform Cluster match
  if (platformMatch) {
    const platformTitleLower = platformMatch.groupName.toLowerCase().trim();
    const exactPlatformMatch = profiles.find(
      (p) =>
        p.platformBucketKeys.has(platformMatch.bucketKey) ||
        p.normalizedTitle === platformTitleLower
    );
    if (exactPlatformMatch) {
      return exactPlatformMatch;
    }
  }

  // 5. Check Domain / Brand Name match against existing group title or homogeneous domain group
  const domainMeta = formatDomainGroupMeta(domainInfo.rootDomain);
  const brandLower = domainMeta.groupName.toLowerCase().trim();
  const rootDomainLower = domainInfo.rootDomain.toLowerCase();
  const domainShortLower = domainInfo.rootDomain.split('.')[0].toLowerCase();

  for (const profile of profiles) {
    if (
      profile.normalizedTitle === brandLower ||
      profile.normalizedTitle === rootDomainLower ||
      profile.normalizedTitle === domainShortLower
    ) {
      return profile;
    }

    if (
      profile.rootDomains.size === 1 &&
      profile.rootDomains.has(domainInfo.rootDomain)
    ) {
      if (platformMatch && profile.platformBucketKeys.size > 0) {
        if (profile.platformBucketKeys.has(platformMatch.bucketKey)) {
          return profile;
        }
      } else {
        return profile;
      }
    }
  }

  // 6. Check Title NLP Jaccard similarity (> 0.45) against existing group title
  const tabTokens = tokenizeTitle(tab.title);
  if (tabTokens.length > 0) {
    for (const profile of profiles) {
      if (
        profile.titleTokens.length > 0 &&
        computeJaccardSimilarity(tabTokens, profile.titleTokens) > 0.45
      ) {
        return profile;
      }
    }
  }

  return undefined;
}

/**
 * Resolves the root/ancestor tab ID via `openerTabId` chains (with cycle protection).
 */
function findEffectiveOpenerGroup(
  tabId: number,
  tabsById: Map<number, TabMetadata>,
  tabToGroupMap: Map<number, ProposedTabGroup>
): ProposedTabGroup | undefined {
  const visited = new Set<number>([tabId]);
  let current = tabsById.get(tabId);

  while (current && typeof current.openerTabId === 'number') {
    const parentId = current.openerTabId;
    if (visited.has(parentId)) break;
    visited.add(parentId);

    const parentGroup = tabToGroupMap.get(parentId);
    if (parentGroup) {
      return parentGroup;
    }
    current = tabsById.get(parentId);
  }

  return undefined;
}

/**
 * Executes the enhanced Deterministic ("Logic Mode") grouping engine:
 * - Respects `options.preserveExistingGroups`:
 *   - When `true` (default): Non-Destructive Smart Merging into `existingGroups`.
 *   - When `false` (Clean Slate Mode): Reorganizes all tabs in the window from scratch.
 * - Multi-Dimensional Contextual Scoring (openerTabId + temporal proximity + title NLP)
 * - Contextual Research Chains (linking articles to search/research clusters)
 * - Multimedia & Audio unification (`🎧 Media & Audio`)
 * - Human-friendly title generation & Color Harmony Allocator
 */
export function runDeterministicGrouping(
  tabs: TabMetadata[],
  rules: DeterministicRule[] = DEFAULT_DETERMINISTIC_RULES,
  options: DeterministicOptions = DEFAULT_DETERMINISTIC_OPTIONS,
  existingGroups: ExistingTabGroup[] = []
): GroupingPlan {
  const startTime = performance.now();

  const tabsById = new Map<number, TabMetadata>();
  for (const t of tabs) {
    tabsById.set(t.id, t);
  }

  const shouldPreserveExisting =
    options.preserveExistingGroups !== false && existingGroups.length > 0;

  const existingProfiles = shouldPreserveExisting
    ? buildExistingGroupProfiles(existingGroups, tabsById)
    : [];

  const lockedGroupedTabIds = new Set<number>();
  if (shouldPreserveExisting) {
    for (const profile of existingProfiles) {
      for (const id of profile.group.tabIds) {
        lockedGroupedTabIds.add(id);
      }
    }
  }

  const activeRules = [...rules]
    .filter((r) => r.enabled && r.pattern.trim().length > 0)
    .sort((a, b) => a.priority - b.priority);

  const highPriorityRules = activeRules.filter((r) => r.priority < 10);
  const standardPriorityRules = activeRules.filter((r) => r.priority >= 10);

  const buckets = new Map<string, PendingBucket>();
  const ungroupedTabIds: number[] = [];

  for (const tab of tabs) {
    if (lockedGroupedTabIds.has(tab.id)) {
      continue;
    }

    if (options.ignorePinnedTabs && tab.pinned) {
      ungroupedTabIds.push(tab.id);
      continue;
    }

    const domainInfo = extractDomainInfo(tab.url);
    if (domainInfo.isInternalBrowserUrl) {
      ungroupedTabIds.push(tab.id);
      continue;
    }

    const highRule = highPriorityRules.find((r) => matchesRule(tab, r));
    const platformMatch = extractPlatformCluster(domainInfo);
    const stdRule = standardPriorityRules.find((r) => matchesRule(tab, r));

    // Stage 0: Non-Destructive Smart Merge into Existing Tab Groups (when preserveExistingGroups is ON)
    if (shouldPreserveExisting) {
      const matchedExisting = findMatchingExistingGroupProfile(
        tab,
        domainInfo,
        platformMatch,
        highRule ?? stdRule,
        existingProfiles,
        tabsById
      );

      if (matchedExisting) {
        matchedExisting.addedTabIds.push(tab.id);
        for (const tk of extractTicketIdentifiers(tab.title)) {
          matchedExisting.ticketIds.add(tk);
        }
        continue;
      }
    }

    // Stage 1: Check high-priority custom user rules (priority < 10)
    if (highRule) {
      const key = `rule:${highRule.id}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(key, {
          id: `logic-rule-${highRule.id}`,
          groupName: highRule.name,
          emoji: highRule.emoji || '📁',
          color: highRule.color,
          tabIds: [tab.id],
          source: 'rule',
          reasoning: `Matched high-priority rule "${highRule.name}"`,
          isExplicitRule: true,
        });
      }
      continue;
    }

    // Stage 2: Platform-Aware Path Parsing (Search, Media & Audio, Google Workspace, GitHub/GitLab owner/repo)
    if (platformMatch) {
      const existing = buckets.get(platformMatch.bucketKey);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(platformMatch.bucketKey, {
          id: `logic-${platformMatch.bucketKey.replace(/[^a-z0-9-]+/gi, '-')}`,
          groupName: platformMatch.groupName,
          emoji: platformMatch.emoji,
          color: platformMatch.color,
          tabIds: [tab.id],
          source: 'platform',
          reasoning: platformMatch.reasoning,
          isExplicitRule: false,
        });
      }
      continue;
    }

    // Stage 3: Check standard priority rules (priority >= 10)
    if (stdRule) {
      const key = `rule:${stdRule.id}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(key, {
          id: `logic-rule-${stdRule.id}`,
          groupName: stdRule.name,
          emoji: stdRule.emoji || '📁',
          color: stdRule.color,
          tabIds: [tab.id],
          source: 'rule',
          reasoning: `Matched rule "${stdRule.name}" (${stdRule.matchTarget}: ${stdRule.pattern})`,
          isExplicitRule: true,
        });
      }
      continue;
    }

    // Stage 4: Domain / Subdomain / Meaningful Path Segment clustering
    const domainKey = options.mergeSubdomains
      ? domainInfo.rootDomain
      : domainInfo.hostname;

    const firstMeaningfulSegment =
      options.groupByFirstPathSegment &&
      domainInfo.meaningfulPathSegments.length > 0
        ? domainInfo.meaningfulPathSegments[0].toLowerCase()
        : undefined;

    const bucketKey = firstMeaningfulSegment
      ? `domain:${domainKey}/${firstMeaningfulSegment}`
      : `domain:${domainKey}`;

    const existingDomain = buckets.get(bucketKey);
    if (existingDomain) {
      existingDomain.tabIds.push(tab.id);
    } else {
      const meta = formatDomainGroupMeta(domainKey, firstMeaningfulSegment);
      buckets.set(bucketKey, {
        id: `logic-${bucketKey.replace(/[^a-z0-9-]+/gi, '-')}`,
        groupName: meta.groupName,
        emoji: meta.emoji,
        color: meta.color,
        tabIds: [tab.id],
        source: 'domain',
        reasoning: `Grouped by ${
          options.mergeSubdomains ? 'root domain' : 'hostname'
        } (${domainKey}${firstMeaningfulSegment ? '/' + firstMeaningfulSegment : ''})`,
        isExplicitRule: false,
        domainKey,
      });
    }
  }

  // Convert preserved existing groups into ProposedTabGroup entries
  const preservedGroups: ProposedTabGroup[] = [];
  const tabToGroupMap = new Map<number, ProposedTabGroup>();

  for (const profile of existingProfiles) {
    const existingTabIds = [...profile.group.tabIds];
    const addedTabIds = [...profile.addedTabIds];
    const combinedTabIds = [...existingTabIds, ...addedTabIds];
    if (combinedTabIds.length === 0) continue;

    const groupObj: ProposedTabGroup = {
      id: `existing-group-${profile.group.id}`,
      groupName: profile.group.cleanTitle || 'Group',
      emoji: profile.group.emoji || '📌',
      color: profile.group.color,
      tabIds: combinedTabIds,
      existingGroupId: profile.group.id,
      existingTabIds,
      addedTabIds,
      source: 'existing-merge',
      reasoning:
        addedTabIds.length > 0
          ? `Preserved existing group "${profile.group.cleanTitle}" and merged +${addedTabIds.length} new ${
              addedTabIds.length === 1 ? 'tab' : 'tabs'
            }`
          : `Preserved existing group "${profile.group.cleanTitle}" intact`,
    };

    preservedGroups.push(groupObj);
    for (const id of combinedTabIds) {
      tabToGroupMap.set(id, groupObj);
    }
  }

  // Separate multi-tab buckets from single-tab candidate buckets
  const newGroups: ProposedTabGroup[] = [];
  const singletonBuckets = new Map<number, PendingBucket>();

  for (const bucket of buckets.values()) {
    if (bucket.tabIds.length >= 2) {
      // For unknown generic domains (not in KNOWN_BRAND_NAMES and not platform/rule),
      // synthesize a human-friendly title if the tabs share a strong topic!
      let finalGroupName = bucket.groupName;
      let finalEmoji = bucket.emoji;
      if (
        bucket.source === 'domain' &&
        bucket.domainKey &&
        !KNOWN_BRAND_NAMES[bucket.domainKey]
      ) {
        const memberTabs = bucket.tabIds
          .map((id) => tabsById.get(id))
          .filter((t): t is TabMetadata => Boolean(t));
        const synth = synthesizeHumanGroupTitle(memberTabs, bucket.domainKey);
        if (synth.groupName !== 'Focus Cluster') {
          finalGroupName = synth.groupName;
          finalEmoji = synth.emoji;
        }
      }

      const group: ProposedTabGroup = {
        id: bucket.id,
        groupName: finalGroupName,
        emoji: finalEmoji,
        color: bucket.color,
        tabIds: [...bucket.tabIds],
        source: bucket.source,
        reasoning: bucket.reasoning,
      };
      newGroups.push(group);
      for (const id of group.tabIds) {
        tabToGroupMap.set(id, group);
      }
    } else if (bucket.tabIds.length === 1) {
      singletonBuckets.set(bucket.tabIds[0], bucket);
    }
  }

  // Stage 5: Contextual Research Chain Linking
  // If a singleton article shares contextual affinity (openerTabId OR search query keywords + proximity)
  // with the `Research & Search` group (or an established group), attach it to that research workflow!
  const researchGroup = [...preservedGroups, ...newGroups].find(
    (g) =>
      g.id === 'logic-platform-search-research-and-search' ||
      g.groupName === 'Research & Search'
  );
  if (researchGroup) {
    const searchMemberTabs = researchGroup.tabIds
      .map((id) => tabsById.get(id))
      .filter((t): t is TabMetadata => Boolean(t));

    for (const [tabId] of [...singletonBuckets.entries()]) {
      const candidateTab = tabsById.get(tabId);
      if (!candidateTab) continue;

      const matchesResearchChain = searchMemberTabs.some(
        (searchTab) =>
          computeContextualAffinityScore(searchTab, candidateTab) >= 0.45
      );

      if (matchesResearchChain) {
        if (!researchGroup.tabIds.includes(tabId)) {
          researchGroup.tabIds.push(tabId);
        }
        if (researchGroup.addedTabIds && !researchGroup.addedTabIds.includes(tabId)) {
          researchGroup.addedTabIds.push(tabId);
        }
        researchGroup.source = 'context-chain';
        tabToGroupMap.set(tabId, researchGroup);
        singletonBuckets.delete(tabId);
      }
    }
  }

  // Stage 6: Zero-AI NLP & Multi-Dimensional Contextual Title Clustering across singleton tabs
  const establishedByTicket = new Map<string, ProposedTabGroup>();
  for (const group of [...preservedGroups, ...newGroups]) {
    for (const tabId of group.tabIds) {
      const t = tabsById.get(tabId);
      if (!t) continue;
      for (const ticket of extractTicketIdentifiers(t.title)) {
        if (!establishedByTicket.has(ticket)) {
          establishedByTicket.set(ticket, group);
        }
      }
    }
  }

  for (const [tabId] of [...singletonBuckets.entries()]) {
    const tab = tabsById.get(tabId);
    if (!tab) continue;
    const tickets = extractTicketIdentifiers(tab.title);
    const matchingExistingGroup = tickets
      .map((tk) => establishedByTicket.get(tk))
      .find(Boolean);

    if (matchingExistingGroup) {
      if (!matchingExistingGroup.tabIds.includes(tabId)) {
        matchingExistingGroup.tabIds.push(tabId);
      }
      if (matchingExistingGroup.addedTabIds && !matchingExistingGroup.addedTabIds.includes(tabId)) {
        matchingExistingGroup.addedTabIds.push(tabId);
      }
      tabToGroupMap.set(tabId, matchingExistingGroup);
      singletonBuckets.delete(tabId);
    }
  }

  const remainingSingletonTabs = [...singletonBuckets.keys()]
    .map((id) => tabsById.get(id))
    .filter((t): t is TabMetadata => Boolean(t));

  const { nlpGroups, clusteredTabIds } = clusterTabsByTitleNlp(
    remainingSingletonTabs,
    0.45
  );

  for (const nlpGroup of nlpGroups) {
    newGroups.push(nlpGroup);
    for (const id of nlpGroup.tabIds) {
      tabToGroupMap.set(id, nlpGroup);
      singletonBuckets.delete(id);
    }
  }

  // Stage 7: Parent-Child Tab Tree (`openerTabId`) attachment for remaining singletons
  for (const [tabId] of [...singletonBuckets.entries()]) {
    if (!singletonBuckets.has(tabId)) continue;
    const tab = tabsById.get(tabId);
    if (!tab || typeof tab.openerTabId !== 'number') continue;

    const parentBucket = singletonBuckets.get(tab.openerTabId);
    if (parentBucket && tab.openerTabId !== tabId) {
      const parentTab = tabsById.get(tab.openerTabId);
      const memberPair = [parentTab, tab].filter(
        (t): t is TabMetadata => Boolean(t)
      );
      const synth = synthesizeHumanGroupTitle(memberPair, parentBucket.domainKey);

      const promotedGroup: ProposedTabGroup = {
        id: parentBucket.id,
        groupName:
          parentBucket.source === 'platform' || parentBucket.isExplicitRule
            ? parentBucket.groupName
            : synth.groupName,
        emoji:
          parentBucket.source === 'platform' || parentBucket.isExplicitRule
            ? parentBucket.emoji
            : synth.emoji,
        color: parentBucket.color,
        tabIds: [...parentBucket.tabIds, tabId],
        source: 'opener',
        reasoning: `Parent tab (#${tab.openerTabId}) grouped with child tab opened via link`,
      };
      newGroups.push(promotedGroup);
      tabToGroupMap.set(tab.openerTabId, promotedGroup);
      tabToGroupMap.set(tabId, promotedGroup);
      singletonBuckets.delete(tab.openerTabId);
      singletonBuckets.delete(tabId);
    }
  }

  for (const [tabId] of [...singletonBuckets.entries()]) {
    const ancestorGroup = findEffectiveOpenerGroup(
      tabId,
      tabsById,
      tabToGroupMap
    );
    if (ancestorGroup) {
      if (!ancestorGroup.tabIds.includes(tabId)) {
        ancestorGroup.tabIds.push(tabId);
      }
      if (ancestorGroup.addedTabIds && !ancestorGroup.addedTabIds.includes(tabId)) {
        ancestorGroup.addedTabIds.push(tabId);
      }
      tabToGroupMap.set(tabId, ancestorGroup);
      singletonBuckets.delete(tabId);
    }
  }

  // Stage 8: Finalize remaining singletons according to `minTabsPerGroup` and `groupSingletonsIntoMisc`
  const leftoverSingletonIds: number[] = [];
  for (const [tabId, bucket] of singletonBuckets.entries()) {
    if (
      !clusteredTabIds.has(tabId) &&
      bucket.tabIds.length >= options.minTabsPerGroup
    ) {
      newGroups.push({
        id: bucket.id,
        groupName: bucket.groupName,
        emoji: bucket.emoji,
        color: bucket.color,
        tabIds: bucket.tabIds,
        source: bucket.source,
        reasoning: bucket.reasoning,
      });
    } else {
      leftoverSingletonIds.push(tabId);
    }
  }

  if (leftoverSingletonIds.length > 0) {
    if (options.groupSingletonsIntoMisc) {
      newGroups.push({
        id: 'logic-misc-singletons',
        groupName: 'Misc',
        emoji: '🗂️',
        color: 'grey',
        tabIds: leftoverSingletonIds,
        source: 'domain',
        reasoning: 'Single tabs combined into Misc group',
      });
    } else {
      ungroupedTabIds.push(...leftoverSingletonIds);
    }
  }

  newGroups.sort((a, b) => {
    if (a.source === 'rule' && b.source !== 'rule') return -1;
    if (a.source !== 'rule' && b.source === 'rule') return 1;
    return b.tabIds.length - a.tabIds.length;
  });

  const combinedGroups = [...preservedGroups, ...newGroups];

  // Stage 9: Run Color Harmony Allocator
  const harmonizedGroups = allocateHarmoniousColors(combinedGroups);

  const latencyMs = Math.max(
    0.1,
    Number((performance.now() - startTime).toFixed(2))
  );

  return {
    modeUsed: 'logic',
    fallbackTriggered: false,
    groups: harmonizedGroups,
    ungroupedTabIds,
    latencyMs,
  };
}
