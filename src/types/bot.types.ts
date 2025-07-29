import type { Context, SessionFlavor } from 'grammy';
import type { EmojiFlavor } from '@grammyjs/emoji';
import type { ConversationFlavor } from '@grammyjs/conversations';
import type { TagRule, Strategy } from './tag.types.ts';

/**
 * Session data structure for storing temporary state and persistent data
 */
export interface SessionData {
  /**
   * A list of channels that the user has proven to be an administrator of.
   */
  managedChannels?: {
    id: number;
    title: string;
    username?: string;
  }[];
  /** ID of the channel currently being configured */
  configuringChannelId?: number | undefined;
  /** Count of messages sent by the user */
  count?: number;
  /**
   * Channel-specific rules stored in cloud storage
   * Key: channel ID (as string for JSON compatibility), Value: array of rules
   */
  channelRules?: Record<string, TagRule[]>;

  // Rule deletion flow state
  /** Available domains for deletion selection */
  deletionDomains?: string[];
  /** Currently selected domain for deletion */
  selectedDeletionDomain?: string;
  /** Rules under selected domain for deletion */
  domainRulesForDeletion?: TagRule[];
  /** Index of selected rule for individual deletion */
  selectedRuleIndex?: number;
  /** Individual strategies for granular deletion */
  strategyItemsForDeletion?: Array<{
    ruleIndex: number;
    strategyIndex: number;
    strategy: Strategy;
    domains: string[];
    isFullRule: boolean;
  }>;
  /** Selected strategy item for deletion */
  selectedStrategyItem?: {
    ruleIndex: number;
    strategyIndex: number;
    strategy: Strategy;
    domains: string[];
    isFullRule: boolean;
  };
}

/**
 * Cloud storage configuration for channel rules
 */
export interface CloudStorageConfig {
  /** Storage adapter instance */
  adapter: any;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Enable local caching */
  enableCache?: boolean;
}

/**
 * Extended context type that includes all necessary flavors
 */
export type AppContext = ConversationFlavor<
  EmojiFlavor<Context> & SessionFlavor<SessionData>
>;
