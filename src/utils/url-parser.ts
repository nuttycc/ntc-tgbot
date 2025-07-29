import { parse } from 'tldts';
import { camelCase } from '@es-toolkit/es-toolkit';
import { defaultRule } from '@/config/tag.rules.ts';
import type { Strategy, TagRule } from '@/types/tag.types.ts';

function getRuleForUrl(domain: string, rules: TagRule[]): TagRule {
  return rules.find((rule) => rule.domains.includes(domain)) || defaultRule;
}

function applyStrategy(
  strategy: Strategy,
  tldInfo: ReturnType<typeof parse>,
  path: string | null,
): string | null {
  const { domainWithoutSuffix } = tldInfo;

  switch (strategy.type) {
    case 'sld':
      return domainWithoutSuffix || null;
    case 'path':
      return path?.split('/').filter(Boolean)[strategy.segment] || null;
    case 'path_last': {
      const segments = path?.split('/').filter(Boolean);
      return segments?.[segments.length - 1] || null;
    }
    case 'path_after': {
      if (path?.startsWith(strategy.prefix)) {
        return path.substring(strategy.prefix.length).split('/')[0] || null;
      }
      return null;
    }
    default:
      return null;
  }
}

export function generateTagsFromUrl(url: string, rules: TagRule[]): string[] {
  const parsedUrl = parse(url);
  const { domain } = parsedUrl;

  if (!domain) return [];

  let pathname: string | null = null;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Gracefully handle invalid URLs that URL constructor can't parse.
  }

  const rule = getRuleForUrl(domain, rules);
  const tags = new Set<string>();

  for (const strategy of rule.strategies) {
    const tag = applyStrategy(strategy, parsedUrl, pathname);
    if (tag) {
      tags.add(camelCase(tag));
    }
  }

  return Array.from(tags);
}
