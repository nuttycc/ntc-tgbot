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

const bot = new Bot<AppContext>(process.env.BOT_TOKEN || '');

// Session middleware must be installed before conversations
bot.use(
  session({
    initial(): SessionData {
      return {};
    },
    storage: patchedFreeStorage<SessionData>(bot.token),
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

if (process.env.LOCAL_DEV === '1') {
  bot.start({
    onStart: async (botInfo) => {
      console.log(
        `Bot @${botInfo.username} started at ${new Date().toUTCString()}`,
      );

      // Set bot commands for better UX
      await bot.api.setMyCommands([
        {
          command: 'manage_rules',
          description: '管理频道的自动标签规则 (仅私聊)',
        },
      ]);

      console.log('Bot commands registered successfully');
    },
  });
}

export default bot;
