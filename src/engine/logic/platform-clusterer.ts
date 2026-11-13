import type { ChromeTabGroupColor } from '../../domain/types';
import { deterministicColorForKey } from '../shared/color-allocator';
import { inferEmojiFromDomain } from '../shared/emoji-parser';
import type { ExtractedDomainInfo } from '../shared/url-classifier';
import { KNOWN_BRAND_NAMES } from './brand-catalog';
import type { ConceptId } from './topic-taxonomy';

export interface PlatformClusterMatch {
  bucketKey: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  reasoning: string;
}

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

const AUDIO_STREAMING_DOMAINS = new Set([
  'music.youtube.com',
  'open.spotify.com',
  'spotify.com',
  'soundcloud.com',
  'music.yandex.ru',
  'bandcamp.com',
  'tidal.com',
  'deezer.com',
  'podcasts.apple.com',
  'music.apple.com',
]);

const VIDEO_STREAMING_DOMAINS = new Set([
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'vimeo.com',
  'netflix.com',
]);

const YOUTUBE_WEB_DOMAINS = new Set(['youtube.com', 'youtu.be']);

export function isYouTubeMediaHost(domainInfo: ExtractedDomainInfo): boolean {
  return (
    (YOUTUBE_WEB_DOMAINS.has(domainInfo.rootDomain) ||
      YOUTUBE_WEB_DOMAINS.has(domainInfo.hostname)) &&
    domainInfo.hostname !== 'music.youtube.com'
  );
}

export function isAudioStreamingHost(domainInfo: ExtractedDomainInfo): boolean {
  return (
    AUDIO_STREAMING_DOMAINS.has(domainInfo.hostname) ||
    AUDIO_STREAMING_DOMAINS.has(domainInfo.rootDomain)
  );
}

export function extractPlatformCluster(domainInfo: ExtractedDomainInfo): PlatformClusterMatch | null {
  if (domainInfo.isInternalBrowserUrl) return null;

  const { hostname, rootDomain, pathSegments } = domainInfo;
  const firstSegment = pathSegments[0]?.toLowerCase() ?? '';

  // 1. Search Engines -> `🔍 Research & Search`
  const isGoogleSearch =
    (rootDomain === 'google.com' ||
      rootDomain.startsWith('google.') ||
      hostname.startsWith('google.')) &&
    (firstSegment === 'search' || domainInfo.pathname.startsWith('/search'));

  const isBingSearch =
    rootDomain === 'bing.com' && (pathSegments.length === 0 || firstSegment === 'search');

  const isYandexSearch =
    (rootDomain === 'yandex.ru' || rootDomain === 'yandex.com' || rootDomain === 'ya.ru') &&
    (hostname === 'ya.ru' ||
      ((hostname === 'yandex.ru' || hostname === 'yandex.com') &&
        (firstSegment === 'search' || domainInfo.pathname.startsWith('/search'))));

  const isDedicatedSearchEngine =
    SEARCH_ENGINE_ROOT_DOMAINS.has(rootDomain) || SEARCH_ENGINE_ROOT_DOMAINS.has(hostname);

  if (isGoogleSearch || isBingSearch || isYandexSearch || isDedicatedSearchEngine) {
    return {
      bucketKey: 'platform:search:research-and-search',
      groupName: 'Research & Search',
      emoji: '🔍',
      color: 'cyan',
      reasoning: 'Unified search & research queries (Google, Bing, Yandex, DuckDuckGo, Perplexity)',
    };
  }

  // 2. Music & Audio Streaming -> `🎧 Music & Audio`
  if (isAudioStreamingHost(domainInfo)) {
    return {
      bucketKey: 'platform:audio:music-and-audio',
      groupName: 'Music & Audio',
      emoji: '🎧',
      color: 'pink',
      reasoning: 'Music & audio streaming tabs',
    };
  }

  // 3. YouTube & Video Streaming -> `🎬 YouTube` / `🎬 Video`
  if (isYouTubeMediaHost(domainInfo)) {
    return {
      bucketKey: 'platform:media:youtube',
      groupName: 'YouTube',
      emoji: '🎬',
      color: 'red',
      reasoning: 'YouTube video tabs',
    };
  }

  if (VIDEO_STREAMING_DOMAINS.has(hostname) || VIDEO_STREAMING_DOMAINS.has(rootDomain)) {
    return {
      bucketKey: 'platform:media:video-streaming',
      groupName: 'Video & Streams',
      emoji: '📺',
      color: 'red',
      reasoning: 'Video streaming & broadcast tabs',
    };
  }

  // 4. Google Workspace (`docs.google.com`, `sheets.google.com`, `slides.google.com`, `forms.google.com`)
  if (hostname === 'sheets.google.com') {
    return {
      bucketKey: 'platform:gworkspace:spreadsheets',
      groupName: 'Sheets',
      emoji: '📊',
      color: 'green',
      reasoning: 'Google Workspace Spreadsheets',
    };
  }
  if (hostname === 'slides.google.com') {
    return {
      bucketKey: 'platform:gworkspace:presentation',
      groupName: 'Slides',
      emoji: '📽️',
      color: 'yellow',
      reasoning: 'Google Workspace Presentations',
    };
  }
  if (hostname === 'forms.google.com') {
    return {
      bucketKey: 'platform:gworkspace:forms',
      groupName: 'Forms',
      emoji: '📝',
      color: 'purple',
      reasoning: 'Google Workspace Forms',
    };
  }
  if (hostname === 'docs.google.com') {
    if (firstSegment === 'document') {
      return {
        bucketKey: 'platform:gworkspace:document',
        groupName: 'Docs',
        emoji: '📄',
        color: 'blue',
        reasoning: 'Google Workspace Documents',
      };
    }
    if (firstSegment === 'spreadsheets') {
      return {
        bucketKey: 'platform:gworkspace:spreadsheets',
        groupName: 'Sheets',
        emoji: '📊',
        color: 'green',
        reasoning: 'Google Workspace Spreadsheets',
      };
    }
    if (firstSegment === 'presentation') {
      return {
        bucketKey: 'platform:gworkspace:presentation',
        groupName: 'Slides',
        emoji: '📽️',
        color: 'yellow',
        reasoning: 'Google Workspace Presentations',
      };
    }
    if (firstSegment === 'forms') {
      return {
        bucketKey: 'platform:gworkspace:forms',
        groupName: 'Forms',
        emoji: '📝',
        color: 'purple',
        reasoning: 'Google Workspace Forms',
      };
    }
  }

  // 5. GitHub & GitLab -> repository-level clustering (`owner/repo`)
  if (hostname === 'github.com' || hostname === 'gitlab.com') {
    const owner = pathSegments[0];
    const second = pathSegments[1];
    if (owner && second) {
      const rawRepo = second.replace(/\.git$/i, '');
      if (
        rawRepo &&
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

export interface DomainGroupMeta {
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  isKnownBrand: boolean;
  canonicalKey?: string;
  conceptId?: ConceptId;
}

export function formatDomainGroupMeta(
  domainKey: string,
  firstPathSegment?: string,
  exactHostname?: string,
): DomainGroupMeta {
  const known =
    (exactHostname ? KNOWN_BRAND_NAMES[exactHostname] : undefined) ?? KNOWN_BRAND_NAMES[domainKey];
  const domainFirstPart = domainKey.split('.')[0] ?? domainKey;
  const baseLabel = known
    ? known.label
    : domainFirstPart.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

  const groupName = firstPathSegment
    ? `${baseLabel} / ${firstPathSegment.slice(0, 16)}`
    : baseLabel || 'Web';

  const emoji = known?.emoji ?? inferEmojiFromDomain(domainKey);
  const color = known?.color ?? deterministicColorForKey(domainKey);

  return {
    groupName,
    emoji,
    color,
    isKnownBrand: Boolean(known),
    canonicalKey: known?.canonicalKey,
    conceptId: known?.conceptId,
  };
}
