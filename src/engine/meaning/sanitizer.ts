import type { SanitizedTabPayload, TabMetadata } from '../../domain/types';
import { extractDomainInfo } from '../shared/url-classifier';

/**
 * Sanitizes tab metadata for privacy before sending to any LLM provider.
 * - Excludes internal browser URLs (`chrome://`, `edge://`, `about:`, `file://`, etc.).
 * - Never sends query strings, hashes, session tokens, or auth parameters.
 * - Truncates up to 3 path segments and replaces >32-char hex/UUID segments with `:id`.
 */
export function sanitizeTabMetadata(tab: TabMetadata): SanitizedTabPayload | null {
  const domainInfo = extractDomainInfo(tab.url);
  if (domainInfo.isInternalBrowserUrl) {
    return null;
  }

  const sanitizedSegments = domainInfo.pathSegments.slice(0, 3).map((seg) => {
    if (seg.length > 32 && /^[a-f0-9-]+$/i.test(seg)) {
      return ':id';
    }
    return seg.slice(0, 28);
  });

  const cleanPath = sanitizedSegments.length > 0 ? `/${sanitizedSegments.join('/')}` : '/';

  const cleanTitle = (tab.title || domainInfo.hostname)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);

  return {
    tabId: tab.id,
    title: cleanTitle,
    hostname: domainInfo.hostname,
    cleanPath,
  };
}
