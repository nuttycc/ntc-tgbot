import type { Context, SessionFlavor } from 'grammy';
import type { EmojiFlavor } from '@grammyjs/emoji';
import type { ConversationFlavor } from '@grammyjs/conversations';

/**
 * Session data structure for storing temporary state
 */
export interface SessionData {
  /** ID of the channel currently being configured */
  configuringChannelId?: number | undefined;
}

/**
 * Extended context type that includes all necessary flavors
 */
export type AppContext = ConversationFlavor<
  EmojiFlavor<Context> & SessionFlavor<SessionData>
>;
