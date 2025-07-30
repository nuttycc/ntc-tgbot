import autoTagFeature from '@/features/auto-tag.feature.ts';
import channelRulesFeature from '@/features/channel-rules.feature.ts';
import requestChatFeature from '@/features/request-chat.feature.ts';
import type { AppContext, SessionData } from '@/types/bot.types.ts';
import { Bot, GrammyError, HttpError, session } from 'grammy';
import { emojiParser } from '@grammyjs/emoji';
import { conversations, createConversation } from '@grammyjs/conversations';
import { channelRuleMenu } from '@/menus/channel-rules.menu.ts';
import { manageChannelMenu } from '@/menus/manage-channel.menu.ts';
import { createRuleConversation } from '@/conversations/create-rule.conversation.ts';
import { patchedFreeStorage } from '@/utils/patch.ts';
import { initializeCloudStorage } from '@/storage/channel-rules.storage.ts';
import { setupBotCommands } from '@/commands.ts';
import { getLogger } from '@/utils/logset.ts';
import testGroupFeature from '@/features/test-group.ts';
import startFeature from '@/features/start.feature.ts';

const logger = getLogger(['bot']);

const bot = new Bot<AppContext>(process.env.BOT_TOKEN || '');

// Create storage adapter
const storageAdapter = patchedFreeStorage<SessionData>(bot.token);

// Initialize cloud storage for channel rules
initializeCloudStorage(storageAdapter);

// Session middleware must be installed before conversations
bot.use(
  session({
    initial(): SessionData {
      return {};
    },
    storage: storageAdapter,
  }),
);

// Emoji middleware
bot.use(emojiParser());

// Conversations middleware
bot.use(conversations());

// Register conversation
bot.use(createConversation(createRuleConversation, 'createRuleConversation'));

// Register keyboard menus
bot.use(channelRuleMenu);
bot.use(manageChannelMenu);

// Register features
bot.use(autoTagFeature);
bot.use(channelRulesFeature);
bot.use(requestChatFeature);
bot.use(testGroupFeature);
bot.use(startFeature);

// Register bot commands
setupBotCommands(bot);

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(
    `Error while handling update ${ctx.update.message?.text?.slice(0, 10)}...`,
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    logger.error(`Error in request: ${e.description}`);
  } else if (e instanceof HttpError) {
    logger.error(`Could not contact Telegram: ${e.message}`);
  } else {
    logger.error(`Unknown error:`, { error: e });
  }
});

if (process.env.LOCAL_DEV === '1') {
  bot.start({
    onStart: async (botInfo) => {
      logger.info(
        `Bot @${botInfo.username} running in ${process.env.NODE_ENV} mode`,
      );
    },
  });
}

export default bot;
