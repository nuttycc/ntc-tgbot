import type { Context, SessionFlavor } from 'grammy';
import type { EmojiFlavor } from '@grammyjs/emoji';
import type { ConversationFlavor } from '@grammyjs/conversations';

/**
 * Session data structure for storing temporary state
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
}

/**
 * Extended context type that includes all necessary flavors
 */
export type AppContext = ConversationFlavor<
  EmojiFlavor<Context> & SessionFlavor<SessionData>
>;
