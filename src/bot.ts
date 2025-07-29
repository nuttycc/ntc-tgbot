import { Bot, session } from 'grammy';
import { emojiParser } from '@grammyjs/emoji';
import { conversations, createConversation } from '@grammyjs/conversations';
import type { AppContext, SessionData } from '@/types/bot.types.ts';
import autoTagFeature from './features/auto-tag.feature.ts';
import channelRulesFeature from './features/channel-rules.feature.ts';
import { channelRuleMenu } from './menus/channel-rules.menu.ts';
import { manageChannelMenu } from './menus/manage-channel.menu.ts';
import { createRuleConversation } from './conversations/create-rule.conversation.ts';
import { patchedFreeStorage } from './utils/patch.ts';
import { initializeCloudStorage } from './storage/channel-rules.storage.ts';
import { setupBotCommands } from './commands.ts';

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

// Register conversations
bot.use(createConversation(createRuleConversation, 'createRuleConversation'));

// Register menus
bot.use(channelRuleMenu);
bot.use(manageChannelMenu);

// Features
bot.use(autoTagFeature);
bot.use(channelRulesFeature);

bot.catch((err) => {
  console.error(
    `Error in bot \n Message: ${err.message} \n Stack: ${err.stack}`,
  );
});

setupBotCommands(bot);

if (process.env.LOCAL_DEV === '1') {
  bot.start({
    onStart: async (botInfo) => {
      console.log(
        `Bot @${botInfo.username} started at ${new Date().toUTCString()}`,
      );
    },
  });
}

export default bot;
