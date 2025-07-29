import type { StorageAdapter } from 'grammy';
import type { TagRule } from '@/types/tag.types.ts';
import type { SessionData } from '@/types/bot.types.ts';

/**
 * Cloud storage instance for channel rules
 */
let storageAdapter: StorageAdapter<SessionData> | null = null;

/**
 * Local cache for performance optimization
 */
const localCache = new Map<string, { data: TagRule[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the cloud storage adapter
 * @param adapter The storage adapter to use
 */
export function initializeCloudStorage(
  adapter: StorageAdapter<SessionData>,
): void {
  storageAdapter = adapter;
}

/**
 * Get the storage key for a channel's rules
 * @param channelId The channel ID
 * @returns Storage key string
 */
function getStorageKey(channelId: number): string {
  return `channel_rules_${channelId}`;
}

/**
 * Get rules from cache if valid
 * @param channelId The channel ID
 * @returns Cached rules or null if not found/expired
 */
function getCachedRules(channelId: number): TagRule[] | null {
  const key = getStorageKey(channelId);
  const cached = localCache.get(key);

  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
  if (isExpired) {
    localCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Cache rules for a channel
 * @param channelId The channel ID
 * @param rules The rules to cache
 */
function setCachedRules(channelId: number, rules: TagRule[]): void {
  const key = getStorageKey(channelId);
  localCache.set(key, {
    data: [...rules],
    timestamp: Date.now(),
  });
}

/**
 * Get session data from cloud storage
 * @param channelId The channel ID (used as session key)
 * @returns Session data or empty object
 */
async function getSessionData(channelId: number): Promise<SessionData> {
  if (!storageAdapter) {
    throw new Error(
      'Cloud storage not initialized. Call initializeCloudStorage first.',
    );
  }

  try {
    const key = getStorageKey(channelId);
    const data = await storageAdapter.read(key);
    return data || {};
  } catch (error) {
    console.error(
      `Failed to read from cloud storage for channel ${channelId}:`,
      error,
    );
    return {};
  }
}

/**
 * Save session data to cloud storage
 * @param channelId The channel ID (used as session key)
 * @param data The session data to save
 */
async function saveSessionData(
  channelId: number,
  data: SessionData,
): Promise<void> {
  if (!storageAdapter) {
    throw new Error(
      'Cloud storage not initialized. Call initializeCloudStorage first.',
    );
  }

  try {
    const key = getStorageKey(channelId);
    await storageAdapter.write(key, data);
  } catch (error) {
    console.error(
      `Failed to write to cloud storage for channel ${channelId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Get rules for a specific channel
 * @param channelId The channel ID to get rules for
 * @returns Array of rules for the channel, or empty array if none exist
 */
export async function getChannelRules(channelId: number): Promise<TagRule[]> {
  // Try cache first
  const cached = getCachedRules(channelId);
  if (cached) {
    return cached;
  }

  try {
    const sessionData = await getSessionData(channelId);
    const rules = sessionData.channelRules?.[channelId.toString()] || [];

    // Cache the result
    setCachedRules(channelId, rules);

    return rules;
  } catch (error) {
    console.error(`Failed to get channel rules for ${channelId}:`, error);
    return [];
  }
}

/**
 * Add a new rule to a channel
 * @param channelId The channel ID to add the rule to
 * @param rule The rule to add
 */
export async function addChannelRule(
  channelId: number,
  rule: TagRule,
): Promise<void> {
  try {
    const sessionData = await getSessionData(channelId);

    // Initialize channelRules if it doesn't exist
    if (!sessionData.channelRules) {
      sessionData.channelRules = {};
    }

    const channelKey = channelId.toString();
    const existingRules = sessionData.channelRules[channelKey] || [];
    const updatedRules = [...existingRules, rule];

    sessionData.channelRules[channelKey] = updatedRules;

    await saveSessionData(channelId, sessionData);

    // Update cache
    setCachedRules(channelId, updatedRules);
  } catch (error) {
    console.error(`Failed to add channel rule for ${channelId}:`, error);
    throw error;
  }
}

/**
 * Remove a rule from a channel by index
 * @param channelId The channel ID to remove the rule from
 * @param ruleIndex The index of the rule to remove
 * @returns True if the rule was removed, false if the index was invalid
 */
export async function removeChannelRule(
  channelId: number,
  ruleIndex: number,
): Promise<boolean> {
  try {
    const sessionData = await getSessionData(channelId);
    const channelKey = channelId.toString();
    const existingRules = sessionData.channelRules?.[channelKey] || [];

    if (ruleIndex < 0 || ruleIndex >= existingRules.length) {
      return false;
    }

    const updatedRules = existingRules.filter(
      (_, index) => index !== ruleIndex,
    );

    if (!sessionData.channelRules) {
      sessionData.channelRules = {};
    }

    sessionData.channelRules[channelKey] = updatedRules;

    await saveSessionData(channelId, sessionData);

    // Update cache
    setCachedRules(channelId, updatedRules);

    return true;
  } catch (error) {
    console.error(`Failed to remove channel rule for ${channelId}:`, error);
    throw error;
  }
}

/**
 * Remove a specific strategy from a rule
 * @param channelId The channel ID
 * @param ruleIndex The index of the rule containing the strategy
 * @param strategyIndex The index of the strategy to remove
 * @returns True if the strategy was removed, false if indices were invalid
 */
export async function removeChannelRuleStrategy(
  channelId: number,
  ruleIndex: number,
  strategyIndex: number,
): Promise<boolean> {
  try {
    const sessionData = await getSessionData(channelId);
    const channelKey = channelId.toString();
    const existingRules = sessionData.channelRules?.[channelKey] || [];

    if (ruleIndex < 0 || ruleIndex >= existingRules.length) {
      return false;
    }

    const rule = existingRules[ruleIndex];
    if (!rule || strategyIndex < 0 || strategyIndex >= rule.strategies.length) {
      return false;
    }

    // Create updated rule with strategy removed
    const updatedStrategies = rule.strategies.filter(
      (_, index) => index !== strategyIndex,
    );

    // If no strategies left, remove the entire rule
    if (updatedStrategies.length === 0) {
      return await removeChannelRule(channelId, ruleIndex);
    }

    // Update the rule with remaining strategies
    const updatedRule: TagRule = {
      domains: rule.domains,
      strategies: updatedStrategies,
    };

    const updatedRules = existingRules.map((r, index) =>
      index === ruleIndex ? updatedRule : r,
    );

    if (!sessionData.channelRules) {
      sessionData.channelRules = {};
    }

    sessionData.channelRules[channelKey] = updatedRules;

    await saveSessionData(channelId, sessionData);

    // Update cache
    setCachedRules(channelId, updatedRules);

    return true;
  } catch (error) {
    console.error(
      `Failed to remove channel rule strategy for ${channelId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Clear all rules for a channel
 * @param channelId The channel ID to clear rules for
 */
export async function clearChannelRules(channelId: number): Promise<void> {
  try {
    const sessionData = await getSessionData(channelId);

    if (sessionData.channelRules) {
      delete sessionData.channelRules[channelId.toString()];
      await saveSessionData(channelId, sessionData);
    }

    // Clear cache
    const key = getStorageKey(channelId);
    localCache.delete(key);
  } catch (error) {
    console.error(`Failed to clear channel rules for ${channelId}:`, error);
    throw error;
  }
}

/**
 * Get statistics about stored rules
 * @returns Object containing channel count and total rule count
 */
export async function getStorageStats(): Promise<{
  channelCount: number;
  totalRules: number;
  cacheSize: number;
}> {
  try {
    // Note: Since FreeStorage doesn't support key listing, we can only provide cache stats
    // In a production environment, you might want to maintain a separate index
    const cacheSize = localCache.size;

    // Calculate stats from cache (limited view)
    let totalRules = 0;
    for (const cached of localCache.values()) {
      totalRules += cached.data.length;
    }

    return {
      channelCount: cacheSize,
      totalRules,
      cacheSize,
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      channelCount: 0,
      totalRules: 0,
      cacheSize: localCache.size,
    };
  }
}

/**
 * Clear local cache (useful for testing or memory management)
 */
export function clearCache(): void {
  localCache.clear();
}
