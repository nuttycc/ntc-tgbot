import type { Strategy } from '@/types/tag.types.ts';

/**
 * Escape special characters for MarkdownV2 format
 * @param text The text to escape
 * @returns Escaped text safe for MarkdownV2
 */
export function escapeMarkdownV2(text: string): string {
  // Characters that need to be escaped in MarkdownV2
  const specialChars = [
    '_',
    '*',
    '[',
    ']',
    '(',
    ')',
    '~',
    '`',
    '>',
    '#',
    '+',
    '-',
    '=',
    '|',
    '{',
    '}',
    '.',
    '!',
  ];

  let escaped = text;

  // Escape each special character
  for (const char of specialChars) {
    escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  }

  return escaped;
}

/**
 * Format a list of items for MarkdownV2 display
 * @param items Array of items to format
 * @param prefix Prefix for each item (e.g., '•', '1.', etc.)
 * @returns Formatted list string
 */
export function formatListForMarkdownV2(
  items: string[],
  prefix: string = '•',
): string {
  return items
    .map((item) => `${escapeMarkdownV2(prefix)} ${escapeMarkdownV2(item)}`)
    .join('\n');
}

/**
 * Format domain list for MarkdownV2 display
 * @param domains Array of domain strings
 * @returns Formatted domain string with backticks
 */
export function formatDomainsForMarkdownV2(domains: string[]): string {
  return domains.map((domain) => `\`${escapeMarkdownV2(domain)}\``).join(', ');
}

/**
 * Format strategy for display
 * @param strategy The strategy to format
 * @param index The index of the strategy
 * @returns Formatted strategy string
 */
export function formatStrategy(strategy: Strategy, index: number): string {
  switch (strategy.type) {
    case 'sld':
      return `${index + 1}. 二级域名 (SLD)`;
    case 'path':
      return `${index + 1}. 路径段 (位置 ${strategy.segment})`;
    case 'path_last':
      return `${index + 1}. 最后路径段`;
    case 'path_after':
      return `${index + 1}. 路径后缀 (${strategy.prefix})`;
    default:
      return `${index + 1}. 未知策略`;
  }
}

/**
 * Format strategies list for MarkdownV2 display
 * @param strategies Array of strategies
 * @param indent Indentation prefix for each strategy
 * @returns Formatted strategies string
 */
export function formatStrategiesForMarkdownV2(
  strategies: Strategy[],
  indent: string = '      ',
): string {
  const strategyItems = strategies.map(
    (strategy, index) => `${indent}${formatStrategy(strategy, index)}`,
  );
  return formatListForMarkdownV2(strategyItems, '');
}
