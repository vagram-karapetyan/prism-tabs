export interface ExtractedDomainInfo {
  protocol: string;
  hostname: string;
  rootDomain: string;
  subdomain: string;
  pathSegments: string[];
  /** Path segments with leading locale/version/app noise prefixes removed. */
  meaningfulPathSegments: string[];
  pathname: string;
  isInternalBrowserUrl: boolean;
}

const INTERNAL_PROTOCOLS = new Set([
  'chrome',
  'chrome-extension',
  'chrome-search',
  'edge',
  'brave',
  'vivaldi',
  'opera',
  'about',
  'file',
]);

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

const EMPTY_TAB_URL_PATTERNS: readonly RegExp[] = [
  /^chrome:\/\/newtab\/?$/i,
  /^chrome:\/\/new-tab-page\/?$/i,
  /^chrome-search:\/\/local-ntp/i,
  /^edge:\/\/newtab\/?$/i,
  /^brave:\/\/newtab\/?$/i,
  /^vivaldi:\/\/newtab\/?$/i,
  /^opera:\/\/startpage\/?$/i,
  /^about:(newtab|blank|home)$/i,
];

const EMPTY_TAB_TITLES = new Set([
  'new tab',
  'новая вкладка',
  'нова вкладка',
  'untitled',
  'untitled tab',
  'about:blank',
]);

export function stripNoisePathPrefixes(segments: readonly string[]): string[] {
  let idx = 0;
  while (idx < segments.length) {
    const seg = segments[idx];
    if (!seg || !NOISE_PATH_PREFIXES.has(seg.toLowerCase())) break;
    idx++;
  }
  return segments.slice(idx);
}

const DOMAIN_INFO_CACHE = new Map<string, ExtractedDomainInfo>();

function cacheAndReturnDomainInfo(urlStr: string, info: ExtractedDomainInfo): ExtractedDomainInfo {
  if (DOMAIN_INFO_CACHE.size >= 1024) {
    DOMAIN_INFO_CACHE.clear();
  }
  DOMAIN_INFO_CACHE.set(urlStr, info);
  return info;
}

export function extractDomainInfo(urlStr: string): ExtractedDomainInfo {
  const cached = DOMAIN_INFO_CACHE.get(urlStr);
  if (cached) return cached;

  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();

    if (INTERNAL_PROTOCOLS.has(protocol)) {
      const rawSegments = parsed.pathname.split('/').filter(Boolean);
      return cacheAndReturnDomainInfo(urlStr, {
        protocol,
        hostname: parsed.hostname || protocol,
        rootDomain: parsed.hostname || protocol,
        subdomain: '',
        pathSegments: rawSegments,
        meaningfulPathSegments: stripNoisePathPrefixes(rawSegments),
        pathname: parsed.pathname,
        isInternalBrowserUrl: true,
      });
    }

    const rawHostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const meaningfulPathSegments = stripNoisePathPrefixes(pathSegments);

    if (
      rawHostname === 'localhost' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(rawHostname) ||
      rawHostname.startsWith('[')
    ) {
      return cacheAndReturnDomainInfo(urlStr, {
        protocol,
        hostname: rawHostname,
        rootDomain: rawHostname,
        subdomain: '',
        pathSegments,
        meaningfulPathSegments,
        pathname: parsed.pathname,
        isInternalBrowserUrl: false,
      });
    }

    const parts = rawHostname.split('.');
    if (parts.length <= 2) {
      return cacheAndReturnDomainInfo(urlStr, {
        protocol,
        hostname: rawHostname,
        rootDomain: rawHostname,
        subdomain: '',
        pathSegments,
        meaningfulPathSegments,
        pathname: parsed.pathname,
        isInternalBrowserUrl: false,
      });
    }

    const secondLast = parts[parts.length - 2] ?? '';
    const last = parts[parts.length - 1] ?? '';
    const lastTwo = `${secondLast}.${last}`;
    const rootPartsCount = MULTI_PART_TLDS.has(lastTwo) ? 3 : 2;
    const rootDomain = parts.slice(-rootPartsCount).join('.');
    const subdomain = parts.slice(0, -rootPartsCount).join('.');

    return cacheAndReturnDomainInfo(urlStr, {
      protocol,
      hostname: rawHostname,
      rootDomain,
      subdomain,
      pathSegments,
      meaningfulPathSegments,
      pathname: parsed.pathname,
      isInternalBrowserUrl: false,
    });
  } catch {
    return cacheAndReturnDomainInfo(urlStr, {
      protocol: 'unknown',
      hostname: 'unknown',
      rootDomain: 'unknown',
      subdomain: '',
      pathSegments: [],
      meaningfulPathSegments: [],
      pathname: '/',
      isInternalBrowserUrl: true,
    });
  }
}

export interface DisposableTabLike {
  url?: string;
  pendingUrl?: string;
  title?: string;
  pinned?: boolean;
}

export function isEmptyBrowserTab(tab: DisposableTabLike): boolean {
  if (tab.pinned) return false;

  const rawUrl = (tab.url ?? tab.pendingUrl ?? '').trim();
  const rawTitle = (tab.title ?? '').trim().toLowerCase();

  if (!rawUrl) {
    return !rawTitle || EMPTY_TAB_TITLES.has(rawTitle);
  }

  return EMPTY_TAB_URL_PATTERNS.some((rx) => rx.test(rawUrl));
}

export function isYouTubeHomeTab(tab: DisposableTabLike): boolean {
  if (tab.pinned) return false;

  const raw = (tab.url ?? tab.pendingUrl ?? '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'youtube.com' && host !== 'm.youtube.com') {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return (
      path === '/' &&
      !parsed.searchParams.has('v') &&
      !parsed.searchParams.has('list') &&
      !parsed.searchParams.has('search_query')
    );
  } catch {
    return false;
  }
}

export function isDisposableTab(
  tab: DisposableTabLike,
  options: { closeEmptyTabs?: boolean; closeYouTubeHomeTabs?: boolean } = {},
): boolean {
  if (tab.pinned) return false;
  if (options.closeEmptyTabs !== false && isEmptyBrowserTab(tab)) {
    return true;
  }
  if (options.closeYouTubeHomeTabs && isYouTubeHomeTab(tab)) {
    return true;
  }
  return false;
}

export function hasCyrillicText(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text);
}
