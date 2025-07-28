import type { TagRule } from './tag.types';

/**
 * Central storage for channel-specific rules
 * Key: channel ID, Value: array of rules for that channel
 */
export type ChannelRulesStorage = Map<number, TagRule[]>;

/**
 * User authorization state for channel management
 */
export interface ChannelAuthState {
  channelId: number;
  channelTitle: string;
  userId: number;
  isAuthorized: boolean;
}
