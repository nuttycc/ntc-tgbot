// Note: This file is only used to test the bot in a group

import type { AppContext } from '@/types/bot.types.ts';
import { Composer, InlineKeyboard, Keyboard } from 'grammy';
import { getLogger } from '@/utils/logset.ts';
import { Router } from '@grammyjs/router';

const logger = getLogger(['features', 'test-group']);

const composer = new Composer<AppContext>();

const router = new Router<AppContext>((ctx) => {
  if (ctx.message?.text === '1') {
    return 'start-test';
  }

  return undefined;
});

router.route('start-test', async (ctx) => {
  await ctx.reply('Ready to test', {
    reply_markup: new InlineKeyboard()
      .text('add-custom-keyboard', 'add-custom-keyboard')
      .text('remove-keyboard', 'remove-keyboard')
      .toFlowed(2, { fillLastRow: true }),
  });
});

// handle callback data

composer.callbackQuery('add-custom-keyboard', async (ctx) => {
  await ctx.answerCallbackQuery('Adding custom keyboard...');
  await ctx.reply('Add custom keyboard', {
    reply_markup: new Keyboard()
      .text('custom-keyboard-1')
      .text('custom-keyboard-2')
      .text('custom-keyboard-3')
      .resized()
      .oneTime()
      .placeholder('Select an option')
      .toFlowed(2, { fillLastRow: true }),
  });
});

composer.callbackQuery('remove-keyboard', async (ctx) => {
  await ctx.answerCallbackQuery('Removing keyboard...');
  await ctx.reply('Remove keyboard', {
    reply_markup: { remove_keyboard: true },
  });
});

composer.use(router);

export default composer;
