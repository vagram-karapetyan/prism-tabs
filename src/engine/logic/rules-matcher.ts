import type { DeterministicRule, TabMetadata } from '../../domain/types';
import { extractDomainInfo, type ExtractedDomainInfo } from '../shared/url-classifier';

export function matchesRule(
  tab: TabMetadata,
  rule: DeterministicRule,
  precomputedDomainInfo?: ExtractedDomainInfo,
): boolean {
  if (!rule.enabled || !rule.pattern.trim()) {
    return false;
  }

  const domainInfo = precomputedDomainInfo ?? extractDomainInfo(tab.url);
  let targetValue: string;

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
