import type { ChannelRulesStorage } from '@/types/channel-rules.types.ts';
import type { TagRule } from '@/types/tag.types.ts';

/**
 * Central storage for all channel-specific rules
 * This is an in-memory storage that will be reset when the bot restarts
 */
export const channelRules: ChannelRulesStorage = new Map();

/**
 * Get rules for a specific channel
 * @param channelId The channel ID to get rules for
 * @returns Array of rules for the channel, or empty array if none exist
 */
export function getChannelRules(channelId: number): TagRule[] {
  return channelRules.get(channelId) || [];
}

/**
 * Add a new rule to a channel
 * @param channelId The channel ID to add the rule to
 * @param rule The rule to add
 */
export function addChannelRule(channelId: number, rule: TagRule): void {
  const existingRules = getChannelRules(channelId);
  const updatedRules = [...existingRules, rule];
  channelRules.set(channelId, updatedRules);
}

/**
 * Remove a rule from a channel by index
 * @param channelId The channel ID to remove the rule from
 * @param ruleIndex The index of the rule to remove
 * @returns True if the rule was removed, false if the index was invalid
 */
export function removeChannelRule(
  channelId: number,
  ruleIndex: number,
): boolean {
  const existingRules = getChannelRules(channelId);
  if (ruleIndex < 0 || ruleIndex >= existingRules.length) {
    return false;
  }

  const updatedRules = existingRules.filter((_, index) => index !== ruleIndex);
  channelRules.set(channelId, updatedRules);
  return true;
}

/**
 * Clear all rules for a channel
 * @param channelId The channel ID to clear rules for
 */
export function clearChannelRules(channelId: number): void {
  channelRules.delete(channelId);
}

/**
 * Get statistics about stored rules
 * @returns Object containing channel count and total rule count
 */
export function getStorageStats() {
  const channelCount = channelRules.size;
  const totalRules = Array.from(channelRules.values()).reduce(
    (sum, rules) => sum + rules.length,
    0,
  );

  return {
    channelCount,
    totalRules,
  };
}
