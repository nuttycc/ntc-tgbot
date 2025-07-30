import { Router } from '@grammyjs/router';
import type { AppContext } from '@/types/bot.types.ts';
import { b, fmt, i, link, mentionUser } from '@grammyjs/parse-mode';

const router = new Router<AppContext>((ctx) => {
  if (ctx.hasCommand('start')) {
    return 'start_slash_command';
  }

  return undefined;
});

router.route('start_slash_command', async (ctx) => {
  const message = fmt`
Hello ${b}world${b}!
This is ${i}formatted${i} text.
${link('https://example.com')}Example${link}
${mentionUser('contact', ctx.from?.id ?? 0)}
This bot helps you manage channel tags automatically.`;

  await ctx.reply(message.text, {
    entities: message.entities,
    reply_markup: {
      remove_keyboard: true,
    },
  });
});

export default router;
